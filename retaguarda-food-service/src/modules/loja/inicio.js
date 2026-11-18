// Loja · Início: números do dia, pendências e atalhos.
import {list} from "../../core/db.js";
import {e,money,num,dateBR,today,addDays,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {kpi,card,dataTable,emptyState,statusPill} from "../../core/ui.js";
import {loadItems,byId,loadBalances,loadLastCosts,unitCost} from "../shared/catalog.js";
import {enabledModules} from "../../areas/loja/shell.js";

export async function render(ctx){
 const on=new Set(enabledModules(ctx.app,ctx.storeId).map(m=>m.id));
 const [items,balances,lastCosts,counts,orders,invoices,pays,moves]=await Promise.all([
  loadItems(),loadBalances(ctx.storeId),loadLastCosts(ctx.storeId),
  list("stock_counts",{select:"id,display_id,count_date,status",eq:{store_id:ctx.storeId},order:"count_date",limit:20}),
  list("purchase_orders",{select:"id,number,delivery_date,status",eq:{store_id:ctx.storeId},in:{status:["draft","sent","realizing"]},order:"delivery_date",asc:true}),
  list("invoices",{select:"id,invoice_number,entry_date,status",eq:{store_id:ctx.storeId,status:"pending"}}),
  list("invoice_payments",{eq:{store_id:ctx.storeId},lte:{due_date:addDays(today(),7)},order:"due_date",asc:true}),
  list("stock_movements",{eq:{store_id:ctx.storeId},order:"occurred_at",limit:8})
 ]);
 if(!ctx.isCurrent())return;
 const map=byId(items);
 const stockValue=round2([...balances.entries()].reduce((s,[id,q])=>s+Math.max(0,q)*unitCost(id,lastCosts,map).cost,0));
 const low=items.filter(i=>i.active!==false&&Number(i.minimum_stock)>0&&balances.has(i.id)&&balances.get(i.id)<Number(i.minimum_stock));
 const openPays=pays.filter(p=>!p.paid_at&&p.status!=="paid");
 const overdue=openPays.filter(p=>p.due_date<today());
 const late=orders.filter(o=>o.status!=="draft"&&o.delivery_date<today());
 const draftCount=counts.find(c=>c.status==="draft");
 const lastCount=counts.find(c=>c.status==="finalized");
 const greet=new Date().getHours()<12?"Bom dia":new Date().getHours()<18?"Boa tarde":"Boa noite";
 const name=(ctx.app.profile?.display_name||"").split(" ")[0];
 const todo=[];
 if(draftCount&&on.has("contagem"))todo.push(["clipboard","Contagem "+draftCount.display_id+" em andamento","Continue e finalize para atualizar o estoque.",ctx.base+"/contagem/"+draftCount.id]);
 if(overdue.length&&on.has("notas"))todo.push(["alert",overdue.length+" parcela(s) vencida(s)",money(overdue.reduce((s,p)=>s+Number(p.amount||0),0)),ctx.base+"/notas"]);
 if(late.length&&on.has("pedidos"))todo.push(["truck",late.length+" pedido(s) com entrega atrasada","Confira com o fornecedor.",ctx.base+"/pedidos/"+late[0].id]);
 if(invoices.length&&on.has("notas"))todo.push(["receipt",invoices.length+" nota(s) aguardando entrada","Dê entrada para atualizar o estoque.",ctx.base+"/notas"]);
 if(low.length&&on.has("pedidos"))todo.push(["box",low.length+" item(ns) abaixo do estoque mínimo","Considere incluir no próximo pedido.",ctx.base+"/pedidos"]);
 if(!lastCount&&on.has("contagem"))todo.push(["clipboard","Nenhuma contagem finalizada","Faça o primeiro inventário da loja.",ctx.base+"/contagem"]);
 const shortcuts=[["contagem","clipboard","Nova contagem"],["pedidos","cart","Novo pedido"],["notas","receipt","Lançar nota"],["perdas","trash","Registrar perda"]].filter(s=>on.has(s[0]));
 const MV={count_adjustment:"Ajuste de contagem",invoice_receipt:"Entrada de nota",transfer_out:"Transferência enviada",transfer_in:"Transferência recebida",loss:"Perda"};
 ctx.el.innerHTML='<header class="page-head"><div><h1>'+e(greet+(name?", "+name:""))+'</h1><p>'+e(ctx.store.name)+' · '+new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})+'</p></div>'+
  '<div class="page-actions">'+shortcuts.map(([m,ic,l])=>'<a class="btn btn-secondary" href="'+ctx.base+'/'+m+'">'+icon(ic,16)+'<span>'+e(l)+'</span></a>').join("")+'</div></header>'+
  '<div class="kpis">'+kpi("Valor em estoque",money(stockValue),lastCount?"Base: contagem de "+dateBR(lastCount.count_date)+" e movimentos":"Sem contagem finalizada",{icon:"box"})+
  kpi("Pedidos em aberto",orders.filter(o=>o.status!=="draft").length,late.length?late.length+" atrasado(s)":"Nenhum atraso",{icon:"cart",tone:late.length?"warn":"info",href:on.has("pedidos")?ctx.base+"/pedidos":""})+
  kpi("A pagar em 7 dias",money(openPays.filter(p=>p.due_date>=today()).reduce((s,p)=>s+Number(p.amount||0),0)),overdue.length?overdue.length+" vencida(s)":"Sem vencidas",{icon:"calendar",tone:overdue.length?"warn":"ok"})+
  kpi("Abaixo do mínimo",low.length,"itens",{icon:"alert",tone:low.length?"warn":"ok"})+'</div>'+
  '<div class="grid-2">'+card("Pendências",todo.length?'<ul class="list-plain">'+todo.map(([ic,t,s,h])=>'<li><a href="'+h+'" style="display:flex;gap:12px;align-items:center;color:inherit;flex:1"><span class="kpi-icon" style="width:34px;height:34px">'+icon(ic,17)+'</span><span><span class="label">'+e(t)+'</span><br><small>'+e(s)+'</small></span></a>'+icon("chevronRight",16)+'</li>').join("")+'</ul>'
   :emptyState("check","Tudo em dia","Nenhuma pendência na loja agora."),{flush:true})+
  card("Itens abaixo do mínimo",low.length?dataTable([
   {label:"Item",render:i=>'<span class="strong">'+e(i.name)+'</span>'},{label:"Em estoque",cls:"num",render:i=>'<span class="text-warn">'+num(balances.get(i.id))+'</span> '+e(i.base_unit||"")},
   {label:"Mínimo",cls:"num",render:i=>num(i.minimum_stock)}],low.slice(0,8)):emptyState("box","Nenhum item abaixo do mínimo"),{flush:true})+'</div>'+
  card("Últimas movimentações de estoque",moves.length?dataTable([
   {label:"Data",render:m=>dateBR(m.occurred_at)},{label:"Item",render:m=>e(map.get(m.item_id)?.name||"Item")},
   {label:"Movimento",render:m=>e(MV[m.movement_type]||m.movement_type)},
   {label:"Quantidade",cls:"num",render:m=>'<span class="'+(Number(m.quantity_delta)<0?"text-danger":"text-ok")+'">'+(Number(m.quantity_delta)>0?"+":"")+num(m.quantity_delta)+'</span>'}],moves)
   :emptyState("layers","Sem movimentações","Contagens, notas, perdas e transferências aparecerão aqui."),{flush:true});
 void statusPill;
}
