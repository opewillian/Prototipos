import {supabase} from "./supabase.js";
export async function saveRow(model,payload,id,_mode,{child=false}={}){
 const table=child?model.line.table:model.table;
 if(table==="stores")throw Error("O cadastro de unidades é bloqueado na retaguarda.");
 const query=id?supabase.from(table).update(payload).eq("id",id):supabase.from(table).insert(payload);
 const {data,error}=await query.select("*").single();if(error)throw error;return data;
}
export async function removeRow(model,id,_mode,{child=false}={}){
 const table=child?model.line.table:model.table;
 if(table==="stores")throw Error("As unidades são gerenciadas fora da retaguarda.");
 const {data,error}=await supabase.from(table).delete().eq("id",id).select("id");
 if(error)throw error;
 if(!data?.length)throw Error("Exclusão não autorizada ou registro inexistente.");
}
export async function changeStatus(model,row,status){
 if(!model.status?.allowed.includes(status))throw Error("Status inválido.");
 if(model.locked?.includes(row.status))throw Error("Registro bloqueado.");
 const patch={status};
 if(model.table==="stock_counts"&&status==="finalized")patch.finalized_at=new Date().toISOString();
 if(model.table==="purchase_orders"&&status==="realized")patch.realized_at=new Date().toISOString();
 if(model.table==="transfers"&&status==="issued")patch.issued_at=new Date().toISOString();
 if(model.table==="invoices"&&status==="received")patch.received_at=new Date().toISOString();
 if(model.table==="losses"&&status==="recorded")patch.recorded_at=new Date().toISOString();
 const {data,error}=await supabase.from(model.table).update(patch).eq("id",row.id).eq("status",row.status).select("*").single();
 if(error)throw error;return data;
}
export async function getLines(model,parentId){
 if(!model.line||!parentId)return [];
 const {data,error}=await supabase.from(model.line.table).select("*").eq(model.line.fk,parentId).limit(500);
 if(error)throw error;return data||[];
}
export async function getListItemIds(listId){
 const {data,error}=await supabase.from("purchase_list_items").select("item_id,sort_order").eq("list_id",listId)
  .order("sort_order",{ascending:true,nullsFirst:false}).limit(1000);
 if(error)throw error;return (data||[]).map(r=>r.item_id);
}
export async function getLookupRows(table,_mode,storeId){
 let query=supabase.from(table).select("*").limit(500);
 if(["stock_counts","purchase_lists","store_last_purchase_cost"].includes(table)){
  if(!storeId)return [];
  query=query.eq("store_id",storeId);
 }
 if(table==="stores")query=query.eq("store_type","operational").eq("active",true);
 const {data,error}=await query;
 if(error)throw error;return data||[];
}
