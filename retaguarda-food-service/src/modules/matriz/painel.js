// Matriz · Painel: visão consolidada das lojas (somente dados reais).
import {list,count} from "../../core/db.js";
import {e,money,dateBR,today,addDays} from "../../core/format.js";
import {pageHead,kpi,card,dataTable,statusPill,emptyState} from "../../core/ui.js";

export async function render(ctx){
 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const since=addDays(today(),-30);
 const [items,suppliers,orders,invoices,counts,closings]=await Promise.all([
  count("items",{eq:{active:true}}),count("suppliers",{eq:{active:true}}),
  list("purchase_orders",{select:"id,number,store_id,delivery_date,status,created_at",order:"created_at"}),
  list("invoices",{select:"id,store_id,status,entry_date",gte:{entry_date:since}}),
  list("stock_counts",{select:"id,store_id,status,count_date",order:"count_date"}),
  list("cmv_closings",{select:"*",order:"end_date"})
 ]);
 if(!ctx.isCurrent())return;
 const open=orders.filter(o=>["draft","sent","realizing"].includes(o.status));
 const late=open.filter(o=>o.delivery_date&&o.delivery_date<today()&&o.status!=="draft");
 const pendingInv=invoices.filter(i=>i.status==="pending");
 const name=id=>stores.find(s=>s.id===id)?.name||id;
 const rows=stores.map(s=>{
  const c=counts.filter(x=>x.store_id===s.id&&x.status==="finalized");
  const last=c[0];const cmv=closings.find(x=>x.store_id===s.id);
  return {store:s,open:open.filter(o=>o.store_id===s.id).length,pending:pendingInv.filter(i=>i.store_id===s.id).length,lastCount:last?.count_date,cmv};
 });
 ctx.el.innerHTML=pageHead("Painel da Matriz","Visão geral das "+stores.length+" loja(s) em operação.")+
  '<div class="kpis">'+kpi("Pedidos em aberto",open.length,late.length?late.length+" com entrega atrasada":"Nenhum atraso",{icon:"cart",tone:late.length?"warn":"",href:"#/matriz/pedidos"})+
  kpi("Notas pendentes (30 dias)",pendingInv.length,"Aguardando recebimento",{icon:"receipt",tone:"info"})+
  kpi("Itens ativos",items,"Catálogo central",{icon:"box",tone:"ok",href:"#/matriz/itens"})+
  kpi("Fornecedores ativos",suppliers,"Cadastro central",{icon:"truck",href:"#/matriz/fornecedores"})+'</div>'+
  '<div class="grid-3">'+card("Lojas",rows.length?dataTable([
   {label:"Loja",render:r=>'<span class="strong">'+e(r.store.name)+'</span><small class="sub">'+e(r.store.code||"")+'</small>'},
   {label:"Pedidos abertos",cls:"num",render:r=>String(r.open)},
   {label:"Notas pendentes",cls:"num",render:r=>String(r.pending)},
   {label:"Última contagem",render:r=>r.lastCount?dateBR(r.lastCount):'<span class="muted">Nenhuma</span>'},
   {label:"Último CMV",cls:"num",render:r=>r.cmv?money(r.cmv.cmv_value):'<span class="muted">—</span>'}
  ],rows,{rowHref:r=>"#/loja/"+encodeURIComponent(r.store.id)}):emptyState("store","Nenhuma loja em operação"),{flush:true})+
  card("Pedidos recentes",open.length||orders.length?dataTable([
   {label:"Pedido",render:o=>'<span class="strong">'+e(o.number)+'</span><small class="sub">'+e(name(o.store_id))+'</small>'},
   {label:"Entrega",render:o=>dateBR(o.delivery_date)},
   {label:"",render:o=>statusPill(o.status)}
  ],orders.slice(0,6),{rowHref:o=>"#/loja/"+encodeURIComponent(o.store_id)+"/pedidos/"+o.id}):emptyState("cart","Nenhum pedido ainda"),{flush:true,actions:'<a class="btn btn-ghost btn-sm" href="#/matriz/pedidos">Ver todos</a>'})+'</div>';
 bindRows(ctx.el);
}
function bindRows(el){
 el.querySelectorAll("tr[data-href]").forEach(tr=>tr.addEventListener("click",()=>{location.hash=tr.dataset.href.replace(/^#/,"")}));
}
