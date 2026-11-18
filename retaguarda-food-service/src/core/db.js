// Acesso a dados no Supabase. Toda autorização é aplicada pelo banco (RLS);
// estas funções apenas padronizam consultas e erros.
import {supabase} from "./supabase.js";
import {trackWrite} from "./audit.js";

function apply(q,opts){
 for(const [k,v] of Object.entries(opts.eq||{}))q=v===null?q.is(k,null):q.eq(k,v);
 for(const [k,v] of Object.entries(opts.in||{}))q=q.in(k,v.length?v:["00000000-0000-0000-0000-000000000000"]);
 for(const [k,v] of Object.entries(opts.gte||{}))q=q.gte(k,v);
 for(const [k,v] of Object.entries(opts.lte||{}))q=q.lte(k,v);
 for(const [k,v] of Object.entries(opts.gt||{}))q=q.gt(k,v);
 for(const [k,v] of Object.entries(opts.lt||{}))q=q.lt(k,v);
 for(const [k,v] of Object.entries(opts.neq||{}))q=q.neq(k,v);
 if(opts.or)q=q.or(opts.or);
 if(opts.order)q=q.order(opts.order,{ascending:opts.asc===true,nullsFirst:false});
 if(opts.order2)q=q.order(opts.order2,{ascending:opts.asc2===true,nullsFirst:false});
 return q;
}
export async function list(table,opts={}){
 // Pagina de 1000 em 1000 para não truncar silenciosamente.
 const all=[];const page=1000;const max=opts.limit||10000;
 for(let from=0;from<max;from+=page){
  let q=supabase.from(table).select(opts.select||"*").range(from,Math.min(from+page,max)-1);
  q=apply(q,opts);
  const {data,error}=await q;if(error)throw error;
  all.push(...(data||[]));
  if(!data||data.length<page)break;
 }
 return all;
}
export async function count(table,opts={}){
 let q=supabase.from(table).select("id",{count:"exact",head:true});
 q=apply(q,opts);
 const {count:c,error}=await q;if(error)throw error;return c||0;
}
export async function get(table,id,select="*",key="id"){
 const {data,error}=await supabase.from(table).select(select).eq(key,id).maybeSingle();
 if(error)throw error;if(!data)throw Error("Registro não encontrado ou sem permissão de acesso.");return data;
}
export async function insert(table,row){
 if(table==="stores")throw Error("Unidades são gerenciadas fora da retaguarda.");
  const {data,error}=await supabase.from(table).insert(row).select("*").single();
 if(error)throw error;trackWrite("insert",table,data);return data;
}
export async function insertMany(table,rows){
 if(!rows.length)return [];
  const {data,error}=await supabase.from(table).insert(rows).select("*");
 if(error)throw error;for(const r of data||[])trackWrite("insert",table,r);return data||[];
}
export async function update(table,id,patch,extra={}){
 if(table==="stores")throw Error("Unidades são gerenciadas fora da retaguarda.");
 let q=supabase.from(table).update(patch).eq("id",id);
 for(const [k,v] of Object.entries(extra))q=q.eq(k,v);
 const {data,error}=await q.select("*");
 if(error)throw error;
  if(!data?.length)throw Error("O registro mudou ou você não tem permissão para alterá-lo. Recarregue a página.");
 trackWrite("update",table,data[0],patch);return data[0];
}
export async function remove(table,id){
 if(table==="stores")throw Error("Unidades são gerenciadas fora da retaguarda.");
  const {data,error}=await supabase.from(table).delete().eq("id",id).select("*");
 if(error)throw error;
  if(!data?.length)throw Error("Não foi possível excluir: registro bloqueado ou sem permissão.");
 trackWrite("delete",table,data[0]);
}
/** Próximo número sequencial amigável por loja (ex.: CT-0007). */
export async function nextNumber(table,column,storeColumn,storeId,prefix){
 const {data,error}=await supabase.from(table).select(column).eq(storeColumn,storeId).ilike(column,prefix+"-%").order("created_at",{ascending:false}).limit(200);
 if(error)throw error;
 const max=(data||[]).reduce((m,r)=>{const n=parseInt(String(r[column]).split("-").pop(),10);return Number.isFinite(n)&&n>m?n:m},0);
 return prefix+"-"+String(max+1).padStart(4,"0");
}
export {supabase};
