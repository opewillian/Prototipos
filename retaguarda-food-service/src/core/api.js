import {supabase} from "./supabase.js";
export async function getStores(){
 const {data,error}=await supabase.from("stores").select("id,code,name,active,store_type").eq("active",true).order("name");
 if(error)throw error;return data||[];
}
export async function getRows(descriptor,_mode,storeId){
 if(descriptor.requiresStore&&!storeId)return [];
 let query=supabase.from(descriptor.table).select("*").limit(200);
 if(descriptor.storeColumn){if(!storeId)return [];query=query.eq(descriptor.storeColumn,storeId)}
 if(descriptor.table==="transfers"&&storeId)query=query.or("from_store_id.eq."+storeId+",to_store_id.eq."+storeId);
 if(descriptor.orderBy)query=query.order(descriptor.orderBy,{ascending:descriptor.ascending===true});
 const {data,error}=await query;if(error)throw error;return data||[];
}
export async function getDashboard(_mode,storeId){
 if(!storeId)throw Error("Selecione uma loja.");
 const resources=[
  {table:"stock_counts",storeColumn:"store_id",orderBy:"count_date",requiresStore:true},
  {table:"purchase_orders",storeColumn:"store_id",orderBy:"created_at",requiresStore:true},
  {table:"invoices",storeColumn:"store_id",orderBy:"entry_date",requiresStore:true},
  {table:"cmv_closings",storeColumn:"store_id",orderBy:"end_date",requiresStore:true}
 ];
 const rows=await Promise.all(resources.map(r=>getRows(r,"live",storeId)));
 return Object.fromEntries(resources.map((r,i)=>[r.table,rows[i]]));
}
export async function getSetup(){
 const stores=await getStores();
 const result=await Promise.all([
  supabase.from("items").select("id",{count:"exact",head:true}),
  supabase.from("suppliers").select("id",{count:"exact",head:true}),
  supabase.from("purchase_lists").select("id",{count:"exact",head:true})
 ]);
 for(const r of result)if(r.error)throw r.error;
 return {operationalStores:stores.filter(s=>s.store_type==="operational").length,items:result[0].count||0,
  suppliers:result[1].count||0,lists:result[2].count||0};
}
