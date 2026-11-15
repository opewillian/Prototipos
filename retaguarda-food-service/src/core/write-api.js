import {supabase} from "./supabase.js";
import {demoSave,demoDelete,demoList} from "./store.js";

export async function saveRow(model,payload,id,mode,{child=false}={}){
 const table=child?model.line.table:model.table, pk="id";
 if(mode==="demo")return demoSave(table,payload,pk,id);
 const q=id?supabase.from(table).update(payload).eq(pk,id):supabase.from(table).insert(payload);
 const {data,error}=await q.select("*").single();
 if(error)throw error;
 return data;
}
export async function removeRow(model,id,mode,{child=false}={}){
 const table=child?model.line.table:model.table;
 if(mode==="demo")return demoDelete(table,id);
 const {data,error}=await supabase.from(table).delete().eq("id",id).select("id");
 if(error)throw error;
 if(!data?.length)throw Error("Exclusão não autorizada ou registro inexistente.");
}
export async function changeStatus(model,row,status,mode){
 if(!model.status?.allowed.includes(status))throw Error("Status inválido.");
 if(model.locked?.includes(row.status))throw Error("Este registro já está bloqueado.");
 const patch={status};
 if(model.table==="stock_counts" && status==="finalized")patch.finalized_at=new Date().toISOString();
 if(model.table==="purchase_orders" && status==="realized")patch.realized_at=new Date().toISOString();
 if(model.table==="transfers" && status==="issued")patch.issued_at=new Date().toISOString();
 if(model.table==="invoices" && status==="received")patch.received_at=new Date().toISOString();
 if(model.table==="losses" && status==="recorded")patch.recorded_at=new Date().toISOString();
 if(mode==="demo")return demoSave(model.table,patch,"id",row.id);
 const {data,error}=await supabase.from(model.table).update(patch)
   .eq("id",row.id).eq("status",row.status).select("*").single();
 if(error)throw error;
 return data;
}
export async function getLines(model,parentId,storeId,mode){
 if(!model.line||!parentId)return [];
 if(mode==="demo")return demoList(model.line.table).filter(r=>r[model.line.fk]===parentId);
 const {data,error}=await supabase.from(model.line.table).select("*").eq(model.line.fk,parentId).limit(500);
 if(error)throw error;
 return data||[];
}
export async function getLookupRows(table,mode,storeId){
 if(mode==="demo")return demoList(table,storeId,{scope:["stock_counts","purchase_lists"].includes(table)});
 let query=supabase.from(table).select("*").limit(500);
 if(["stock_counts","purchase_lists"].includes(table)&&storeId)query=query.eq("store_id",storeId);
 const {data,error}=await query;
 if(error)throw error;
 return data||[];
}
