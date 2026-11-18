// Matriz · Pedidos de todas as lojas, com filtros, agrupamento por fornecedor e mudança de status.
import {list,update} from "../../core/db.js";
import {e,money,dateBR,today,addDays,round2} from "../../core/format.js";
import {pageHead,dataTable,kpi,statusPill,emptyState,toast,errorMessage,confirmDialog,btn,searchBox,searchKey,card} from "../../core/ui.js";
import {loadSuppliers,byId} from "../shared/catalog.js";
import {NEXT} from "../loja/pedidos.js";

export async function render(ctx){
 const [orders,lines,suppliers]=await Promise.all([
  list("purchase_orders",{order:"created_at",gte:{created_at:addDays(today(),-120)}}),
  list("purchase_order_items",{select:"order_id,supplier_id,line_total,requested_quantity",gte:{created_at:addDays(today(),-120)}}),
  loadSuppliers()
 ]);
 if(!ctx.isCurrent())return;
 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");const sname=id=>stores.find(s=>s.id===id)?.name||id;
 const sup=byId(suppliers);
 const tot=id=>round2(lines.filter(l=>l.order_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const supsOf=id=>[...new Set(lines.filter(l=>l.order_id===id&&Number(l.requested_quantity)>0).map(l=>sup.get(l.supplier_id)?.name||"Sem fornecedor"))];
 const open=orders.filter(o=>["sent","realizing"].includes(o.status));
 const late=open.filter(o=>o.delivery_date<today());
 const bySup=new Map();for(const l of lines){const o=orders.find(x=>x.id===l.order_id);if(!o||!["sent","realizing"].includes(o.status))continue;const k=l.supplier_id||"";bySup.set(k,round2((bySup.get(k)||0)+Number(l.line_total||0)))}
 const supRows=[...bySup.entries()].sort((a,b)=>b[1]-a[1]);
 ctx.el.innerHTML=pageHead("Pedidos das lojas","Acompanhe e atualize os pedidos de compra de todas as unidades (últimos 120 dias).")+
  '<div class="kpis">'+kpi("Em aberto",open.length,money(open.reduce((s,o)=>s+tot(o.id),0)),{icon:"cart"})+kpi("Atrasados",late.length,"entrega vencida",{icon:"alert",tone:late.length?"warn":"ok"})+
  kpi("Rascunhos nas lojas",orders.filter(o=>o.status==="draft").length,"",{icon:"edit",tone:"info"})+kpi("Realizados (30 dias)",orders.filter(o=>o.status==="realized"&&String(o.realized_at||"")>=addDays(today(),-30)).length,"",{icon:"check",tone:"ok"})+'</div>'+
  '<div class="grid-3"><section class="card"><div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Pedido ou fornecedor")+
  '<select class="control" id="f-store"><option value="">Todas as lojas</option>'+stores.map(s=>'<option value="'+e(s.id)+'">'+e(s.name)+'</option>').join("")+'</select>'+
  '<select class="control" id="f-st"><option value="open">Em aberto</option><option value="">Todos</option><option value="draft">Rascunho</option><option value="sent">Enviado</option><option value="realizing">Em andamento</option><option value="realized">Realizado</option><option value="cancelled">Cancelado</option></select></div>'+
  (orders.length?dataTable([
   {label:"Pedido",render:o=>'<span class="strong">'+e(o.number)+'</span><small class="sub">'+e(sname(o.store_id))+'</small>'},
   {label:"Fornecedores",render:o=>e(supsOf(o.id).join(", ")||"—")},
   {label:"Entrega",render:o=>dateBR(o.delivery_date)+(["sent","realizing"].includes(o.status)&&o.delivery_date<today()?' <span class="pill pill-danger">Atrasado</span>':'')},
   {label:"Total",cls:"num",render:o=>money(tot(o.id))},{label:"Situação",render:o=>statusPill(o.status)},
   {label:"",cls:"act",render:o=>(NEXT[o.status]||[]).filter(([s])=>s!=="sent").map(([s,l])=>btn(l.replace("Marcar como ","").replace("Marcar ",""),{variant:"secondary",sm:true,attrs:'data-st="'+s+'" data-id="'+e(o.id)+'"'})).join(" ")}
  ],orders,{rowHref:o=>"#/loja/"+encodeURIComponent(o.store_id)+"/pedidos/"+o.id,rowAttrs:o=>'data-search="'+e(searchKey(o.number,supsOf(o.id).join(" ")))+'" data-store="'+e(o.store_id)+'" data-status="'+e(o.status)+'"'}).replace('class="table"','class="table stack"'):emptyState("cart","Nenhum pedido nas lojas"))+'</section>'+
  card("Em aberto por fornecedor",supRows.length?'<ul class="list-plain">'+supRows.map(([k,v])=>'<li><span class="label">'+e(sup.get(k)?.name||"Sem fornecedor")+'</span><strong>'+money(v)+'</strong></li>').join("")+'</ul>':emptyState("truck","Nada em aberto"),{flush:true})+'</div>';
 const filter=()=>{const q=searchKey(ctx.el.querySelector("#q").value).trim(),st=ctx.el.querySelector("#f-store").value,s2=ctx.el.querySelector("#f-st").value;
  ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!((!q||r.dataset.search.includes(q))&&(!st||r.dataset.store===st)&&(!s2||(s2==="open"?["sent","realizing"].includes(r.dataset.status):r.dataset.status===s2))))};
 ["#q","#f-store","#f-st"].forEach(s=>ctx.el.querySelector(s)?.addEventListener("input",filter));filter();
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.addEventListener("click",ev=>{if(!ev.target.closest("button"))ctx.go(tr.dataset.href)}));
 ctx.el.querySelectorAll("[data-st]").forEach(b=>b.onclick=async ev=>{
  ev.stopPropagation();const o=orders.find(x=>x.id===b.dataset.id);const st=b.dataset.st;
  if(!await confirmDialog({title:"Atualizar pedido "+o.number+"?",text:sname(o.store_id)+" → "+(st==="realized"?"Realizado":"Em andamento"),confirmLabel:"Confirmar"}))return;
  try{await update("purchase_orders",o.id,st==="realized"?{status:st,realized_at:new Date().toISOString()}:{status:st},{status:o.status});toast("Pedido atualizado.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 });
}
