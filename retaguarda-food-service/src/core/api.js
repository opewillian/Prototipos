import {supabase} from "./supabase.js";
import {demoList} from "./store.js";

export async function getStores(mode){
 if(mode==="demo")return demoList("stores");
 const {data,error}=await supabase.from("stores").select("id,code,name,active,store_type").eq("active",true).order("name");
 if(error)throw error;return data||[];
}
export async function getRows(descriptor,mode,storeId){
 if(mode==="demo")return demoList(descriptor.table,storeId,{scope:descriptor.requiresStore});
 if(descriptor.requiresStore&&!storeId)return [];
 let query=supabase.from(descriptor.table).select("*").limit(200);
 if(descriptor.storeColumn&&storeId)query=query.eq(descriptor.storeColumn,storeId);
 if(descriptor.table==="transfers"&&storeId)query=query.or("from_store_id.eq."+storeId+",to_store_id.eq."+storeId);
 if(descriptor.orderBy)query=query.order(descriptor.orderBy,{ascending:descriptor.ascending===true});
 const {data,error}=await query;if(error)throw error;return data||[];
}
export async function getDashboard(mode,storeId){
 const rs=[
  {table:"stock_counts",storeColumn:"store_id",orderBy:"count_date",requiresStore:true},
  {table:"purchase_orders",storeColumn:"store_id",orderBy:"created_at",requiresStore:true},
  {table:"invoices",storeColumn:"store_id",orderBy:"entry_date",requiresStore:true},
  {table:"cmv_closings",storeColumn:"store_id",orderBy:"end_date",requiresStore:true}
 ];
 const values=await Promise.all(rs.map(r=>getRows(r,mode,storeId)));
 return Object.fromEntries(rs.map((r,i)=>[r.table,values[i]]));
}

export async function getSetup(mode,storeId){
  const stores=await getStores(mode);
  if(mode==="demo"){
    return {
      operationalStores:stores.filter(s=>s.store_type==="operational" || (s.id||"").startsWith("demo-")).length,
      items:demoList("items").length,
      suppliers:demoList("suppliers").length,
      lists:storeId?demoList("purchase_lists",storeId,{scope:true}).length:demoList("purchase_lists").length
    };
  }
  const counts=[
    supabase.from("items").select("id",{count:"exact",head:true}),
    supabase.from("suppliers").select("id",{count:"exact",head:true}),
    storeId
      ? supabase.from("purchase_lists").select("id",{count:"exact",head:true}).eq("store_id",storeId)
      : supabase.from("purchase_lists").select("id",{count:"exact",head:true})
  ];
  const results=await Promise.all(counts);
  for(const result of results) if(result.error) throw result.error;
  return {
    operationalStores:stores.filter(s=>s.store_type==="operational").length,
    items:results[0].count||0,
    suppliers:results[1].count||0,
    lists:results[2].count||0
  };
}
