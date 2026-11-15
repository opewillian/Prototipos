import {supabase} from "../../core/supabase.js";
import {demoList} from "../../core/store.js";
export async function isMatrixAdmin(mode,userId){
 if(mode==="demo")return true;
 if(!userId)return false;
 const {data,error}=await supabase.from("store_memberships").select("role,active").eq("user_id",userId).eq("store_id","matriz").maybeSingle();
 if(error)throw error;
 return data?.role==="matrix_admin"&&data?.active===true;
}
export async function getMatrixHome(mode,stores){
 const shops=stores.filter(s=>s.store_type==="operational"||String(s.id||"").startsWith("demo-"));
 if(mode==="demo")return {stores:shops,items:demoList("items").length,suppliers:demoList("suppliers").length,orders:demoList("purchase_orders").slice(0,200)};
 const responses=await Promise.all([
  supabase.from("items").select("id",{head:true,count:"exact"}),
  supabase.from("suppliers").select("id",{head:true,count:"exact"}),
  supabase.from("purchase_orders").select("id,number,store_id,delivery_date,status,created_at").order("created_at",{ascending:false}).limit(200)
 ]);
 for(const r of responses)if(r.error)throw r.error;
 return {stores:shops,items:responses[0].count||0,suppliers:responses[1].count||0,orders:responses[2].data||[]};
}
export async function getMatrixOrders(mode){
 if(mode==="demo")return demoList("purchase_orders").slice(0,200);
 const {data,error}=await supabase.from("purchase_orders").select("id,number,store_id,delivery_date,status,created_at").order("created_at",{ascending:false}).limit(200);
 if(error)throw error;
 return data||[];
}
