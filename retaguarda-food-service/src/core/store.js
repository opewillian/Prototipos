// Estado editável LOCAL somente no modo demonstração. Jamais envia registros fictícios ao Supabase.
import {demoStores,demoTables} from "./demo-data.js";
const STORAGE_KEY="retaguarda_food_service_demo_v2";
const initial=()=>({stores:structuredClone(demoStores),tables:structuredClone(demoTables)});
let cache;
function read(){
 if(cache)return cache;
 try{
  const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
  cache=data && Array.isArray(data.stores) && data.tables ? data : initial();
 }catch{cache=initial();}
 return cache;
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(read()));}
export function demoList(table,storeId,model){
 const data=read();
 if(table==="stores")return data.stores.filter(x=>x.active!==false);
 let rows=(data.tables[table]||[]).slice();
 if(table==="transfers"&&storeId)return rows.filter(x=>x.from_store_id===storeId||x.to_store_id===storeId);
 if(model?.scope && storeId)return rows.filter(x=>x.store_id===storeId);
 return rows;
}
export function demoSave(table,payload,idField="id",existing){
 const data=read(), rows=table==="stores"?data.stores:(data.tables[table]??=[]);
 if(existing){
  const i=rows.findIndex(x=>String(x[idField])===String(existing));
  if(i<0)throw Error("Registro não encontrado.");
  rows[i]={...rows[i],...payload};
  persist();return rows[i];
 }
 const row={[idField]:payload[idField]||crypto.randomUUID(),...payload,created_at:new Date().toISOString()};
 rows.unshift(row);persist();return row;
}
export function demoDelete(table,id,idField="id"){
 const data=read(), rows=table==="stores"?data.stores:(data.tables[table]||[]);
 const i=rows.findIndex(x=>String(x[idField])===String(id));
 if(i<0)throw Error("Registro não encontrado.");
 rows.splice(i,1);persist();
}
export function demoReset(){cache=initial();persist();}
