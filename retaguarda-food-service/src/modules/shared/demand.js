// Demanda e sugestão de compra, calculadas apenas com dados reais da loja.
import {list} from "../../core/db.js";
import {daysBetween,round2} from "../../core/format.js";

/**
 * Consumo médio em 10 dias por item, a partir das duas últimas contagens finalizadas:
 * consumo = estoque inicial + entradas/saídas registradas (notas, transferências, perdas) − estoque final.
 * Perdas já reduzem o estoque por movimento próprio, então não entram como consumo.
 */
export async function consumption10(storeId){
 const counts=await list("stock_counts",{select:"id,count_date,finalized_at",eq:{store_id:storeId,status:"finalized"},order:"count_date",order2:"finalized_at",limit:2});
 if(counts.length<2)return {map:new Map(),period:null};
 const [c2,c1]=counts;const days=daysBetween(c1.count_date,c2.count_date);
 if(days<=0)return {map:new Map(),period:null};
 const [l1,l2,mv]=await Promise.all([
  list("stock_count_items",{select:"item_id,counted_quantity",eq:{count_id:c1.id}}),
  list("stock_count_items",{select:"item_id,counted_quantity",eq:{count_id:c2.id}}),
  list("stock_movements",{select:"item_id,quantity_delta,movement_type,occurred_at",eq:{store_id:storeId},gt:{occurred_at:c1.finalized_at},lte:{occurred_at:c2.finalized_at}})
 ]);
 const q1=new Map(l1.map(r=>[r.item_id,Number(r.counted_quantity)])),q2=new Map(l2.map(r=>[r.item_id,Number(r.counted_quantity)]));
 const flow=new Map();
 for(const m of mv){if(m.movement_type==="count_adjustment")continue;flow.set(m.item_id,(flow.get(m.item_id)||0)+Number(m.quantity_delta||0))}
 const map=new Map();
 for(const id of new Set([...q1.keys(),...q2.keys()])){
  if(!q1.has(id)||!q2.has(id))continue; // só itens contados nas duas contagens
  const used=q1.get(id)+(flow.get(id)||0)-q2.get(id);
  map.set(id,round2(Math.max(0,used)/days*10*1000)/1000);
 }
 return {map,period:{from:c1.count_date,to:c2.count_date,days}};
}

/** Quantidade em pedidos enviados/em andamento criados após a contagem (exceto o pedido atual). */
export async function openAfterCount(storeId,since,excludeOrderId){
 const orders=await list("purchase_orders",{select:"id,created_at",eq:{store_id:storeId},in:{status:["sent","realizing"]},gt:since?{created_at:since}:{}});
 const ids=orders.map(o=>o.id).filter(id=>id!==excludeOrderId);
 if(!ids.length)return new Map();
 const lines=await list("purchase_order_items",{select:"item_id,requested_quantity,order_id",in:{order_id:ids}});
 const map=new Map();for(const l of lines)map.set(l.item_id,(map.get(l.item_id)||0)+Number(l.requested_quantity||0));
 return map;
}

const WHOLE=new Set(["un","cx","pct","fd","dz"]);
/**
 * Sugestão = (média de 10 dias + estoque mínimo) − estoque projetado na entrega.
 * Estoque projetado = contado + pedidos em aberto − consumo diário × dias até a entrega.
 */
export function suggest({counted,avg10,open,minimum,daysToDelivery,unit}){
 if(counted===null||counted===undefined)return {value:null,projected:null,flags:["Item sem contagem de referência"]};
 const daily=Number(avg10||0)/10;
 const projected=Number(counted)+Number(open||0)-daily*Math.max(0,daysToDelivery||0);
 const target=Number(avg10||0)+Number(minimum||0);
 let value=Math.max(0,target-Math.max(projected,0));
 value=WHOLE.has(unit)?Math.ceil(value-1e-9):Math.ceil(value*1000-1e-6)/1000;
 const flags=[];
 if(projected<0)flags.push("Risco de faltar antes da entrega");
 if(!avg10)flags.push("Sem histórico de consumo (2 contagens)");
 return {value,projected:round2(projected),flags};
}
export function memory({counted,avg10,open,minimum,daysToDelivery},s){
 return "Contado "+(counted??"—")+" + em aberto "+(open||0)+" − consumo "+(round2(Number(avg10||0)/10*Math.max(0,daysToDelivery||0)))+" ("+daysToDelivery+" dias até a entrega) = projetado "+(s.projected??"—")+
  ". Alvo: média 10 dias "+(avg10||0)+" + mínimo "+(minimum||0)+". Sugerido "+(s.value??"—")+".";
}
