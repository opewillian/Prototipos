import {supabase} from "../../core/supabase.js";
export async function isMatrixAdmin(_mode,userId){
 if(!userId)return false;
 const {data,error}=await supabase.from("store_memberships").select("role,active").eq("user_id",userId).eq("store_id","matriz").maybeSingle();
 if(error)throw error;return data?.role==="matrix_admin"&&data?.active===true;
}
export async function getMatrixHome(_mode,stores){
 const shops=stores.filter(s=>s.store_type==="operational");
 const r=await Promise.all([
  supabase.from("items").select("id",{count:"exact",head:true}),
  supabase.from("suppliers").select("id",{count:"exact",head:true}),
  supabase.from("purchase_orders").select("id,number,store_id,delivery_date,status,created_at").order("created_at",{ascending:false}).limit(200)
 ]);
 for(const x of r)if(x.error)throw x.error;
 return {stores:shops,items:r[0].count||0,suppliers:r[1].count||0,orders:r[2].data||[]};
}
export async function getMatrixOrders(){
 const {data,error}=await supabase.from("purchase_orders").select("id,number,store_id,delivery_date,status,created_at").order("created_at",{ascending:false}).limit(200);
 if(error)throw error;return data||[];
}
