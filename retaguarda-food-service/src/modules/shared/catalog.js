// Catálogo central e dados de estoque por loja, com regras de custo compartilhadas.
import {list} from "../../core/db.js";
import {round2} from "../../core/format.js";

/**
 * Itens do catálogo. Com `store` (tela de loja): a loja só usa itens da marca dela + da marca global; item sem marca
 * não aparece em loja nenhuma. Os demais voltam marcados como inativos (_offBrand) — somem das escolhas, mas
 * documentos antigos continuam achando o nome do item pelo id.
 */
export async function loadItems({activeOnly=false,store=null}={}){
 const [items,brands]=await Promise.all([list("items",{order:"name",asc:true,eq:activeOnly?{active:true}:{}}),store&&store.store_type!=="matrix"?list("brands",{select:"id,is_global"}):null]);
 if(!brands)return items;
 const ok=new Set(brands.filter(b=>b.is_global).map(b=>b.id));if(store.brand_id)ok.add(store.brand_id);
 return items.map(i=>ok.has(i.brand_id)?i:{...i,active:false,_offBrand:true});
}
export async function loadSuppliers({activeOnly=false}={}){
 return list("suppliers",{order:"name",asc:true,eq:activeOnly?{active:true}:{}});
}
export function byId(rows,key="id"){return new Map(rows.map(r=>[r[key],r]))}
export async function loadBalances(storeId){
 const rows=await list("store_stock_balance",{eq:{store_id:storeId}});
 return new Map(rows.map(r=>[r.item_id,Number(r.quantity_on_hand||0)]));
}
export async function loadLastCosts(storeId){
 const rows=await list("store_last_purchase_cost",{eq:{store_id:storeId}});
 return new Map(rows.filter(r=>r.unit_cost!==null).map(r=>[r.item_id,{cost:Number(r.unit_cost),date:r.entry_date||r.received_at}]));
}
/** Custo unitário: última compra recebida na mesma loja; senão custo padrão do cadastro. */
export function unitCost(itemId,lastCosts,itemsById){
 const last=lastCosts?.get(itemId);
 if(last)return {cost:last.cost,source:"Última compra"};
 const item=itemsById?.get(itemId);
 return {cost:Number(item?.default_unit_cost||0),source:"Custo padrão"};
}
export function lineTotal(qty,cost){return round2(Number(qty||0)*Number(cost||0))}
export function itemOptions(items){return items.filter(i=>i.active!==false).map(i=>[i.id,i.name+(i.code?" · "+i.code:"")])}
export function unitLabel(item){return item?.base_unit||""}
