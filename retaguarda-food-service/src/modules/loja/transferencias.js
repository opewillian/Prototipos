// Loja · Transferências entre lojas. Emitir gera saída na origem e entrada no destino (gatilho do banco).
import {list,get,insert,update,nextNumber} from "../../core/db.js";
import {e,money,dateBR,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,openDrawer,field,select,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,alertBox} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,loadBalances,unitCost} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [rows,lines]=await Promise.all([
  list("transfers",{or:"from_store_id.eq."+ctx.storeId+",to_store_id.eq."+ctx.storeId,order:"created_at"}),
  list("transfer_items",{select:"transfer_id,line_total",or:"from_store_id.eq."+ctx.storeId+",to_store_id.eq."+ctx.storeId})
 ]);
 if(!ctx.isCurrent())return;
 const name=id=>ctx.app.stores.find(s=>s.id===id)?.name||id;
 const tot=id=>round2(lines.filter(l=>l.transfer_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const out=rows.filter(r=>r.from_store_id===ctx.storeId),inn=rows.filter(r=>r.to_store_id===ctx.storeId);
 const others=ctx.app.stores.filter(s=>s.store_type==="operational"&&s.id!==ctx.storeId&&(ctx.app.flags[s.id]||{}).transfers);
 ctx.el.innerHTML=pageHead("Transferências","Envio de mercadorias entre lojas, com saída e entrada automáticas no estoque.",others.length?btn("Nova transferência",{icon:"plus",attrs:"data-new"}):"")+
  '<div class="kpis">'+kpi("Enviadas",out.filter(r=>r.status==="issued").length,money(out.filter(r=>r.status==="issued").reduce((s,r)=>s+tot(r.id),0)),{icon:"swap"})+
  kpi("Recebidas",inn.filter(r=>r.status==="issued").length,money(inn.filter(r=>r.status==="issued").reduce((s,r)=>s+tot(r.id),0)),{icon:"box",tone:"ok"})+
  kpi("Rascunhos",out.filter(r=>r.status==="draft").length,"",{icon:"edit",tone:"warn"})+kpi("Lojas habilitadas",others.length,"para receber/enviar",{icon:"store",tone:"info"})+'</div>'+
  (others.length?'':alertBox("Nenhuma outra loja está habilitada para transferências no momento.","info"))+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Transferência",render:r=>'<span class="strong">'+e(r.number)+'</span>'+(r.observation?'<small class="sub">'+e(r.observation)+'</small>':'')},
   {label:"Direção",render:r=>r.from_store_id===ctx.storeId?'<span class="tag">Saída</span> para '+e(name(r.to_store_id)):'<span class="tag">Entrada</span> de '+e(name(r.from_store_id))},
   {label:"Data",render:r=>dateBR(r.issued_at||r.created_at)},
   {label:"Valor",cls:"num",render:r=>money(tot(r.id))},{label:"Situação",render:r=>statusPill(r.status)}
  ],rows,{rowHref:r=>ctx.base+"/transferencias/"+r.id}).replace('class="table"','class="table stack"'):emptyState("swap","Nenhuma transferência","As transferências enviadas e recebidas pela loja aparecem aqui."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelector("[data-new]")?.addEventListener("click",()=>openDrawer({title:"Nova transferência",submitLabel:"Criar e incluir itens",body:'<div class="form-grid">'+
  '<div class="span-2">'+field("Loja de destino",select("to_store_id",others.map(s=>[s.id,s.name]),"",{required:true}))+'</div>'+
  '<div class="span-2">'+field("Observação",textarea("observation","",{rows:2}))+'</div></div>',
  onSubmit:async form=>{const f=form.elements;if(!f.to_store_id.value)throw Error("Escolha a loja de destino.");
   const number=await nextNumber("transfers","number","from_store_id",ctx.storeId,"TR");
   const t=await insert("transfers",{number,from_store_id:ctx.storeId,to_store_id:f.to_store_id.value,observation:f.observation.value.trim()||null,status:"draft",created_by:ctx.userId});
   toast("Transferência "+number+" criada.");ctx.go(ctx.base+"/transferencias/"+t.id)}}));
}

async function detail(ctx,id){
 const [t,lines,items,lastCosts,balances]=await Promise.all([get("transfers",id),list("transfer_items",{eq:{transfer_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),loadBalances(ctx.storeId)]);
 if(!ctx.isCurrent())return;
 if(t.from_store_id!==ctx.storeId&&t.to_store_id!==ctx.storeId)throw Error("Transferência de outra loja.");
 const name=sid=>ctx.app.stores.find(s=>s.id===sid)?.name||sid;
 const isOrigin=t.from_store_id===ctx.storeId;const editable=isOrigin&&t.status==="draft";
 const map=byId(items);
 ctx.el.innerHTML=backLink(ctx.base+"/transferencias","Transferências")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Transferência '+e(t.number)+'</h1>'+statusPill(t.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(name(t.from_store_id))+' → '+e(name(t.to_store_id))+'</p></div>'+
  '<div class="page-actions">'+(editable?btn("Cancelar",{variant:"ghost",attrs:"data-cancel"})+btn("Emitir transferência",{variant:"ok",icon:"check",attrs:"data-issue"}):'')+'</div></div>'+
  (t.observation?alertBox(t.observation,"info"):'')+(t.status==="issued"?alertBox("Emitida em "+dateBR(t.issued_at)+". Saída registrada em "+name(t.from_store_id)+" e entrada em "+name(t.to_store_id)+".","ok"):'')+
  card("Itens",'<div data-lines></div>',{flush:true});
 const ui=mountLines({el:ctx.el.querySelector("[data-lines]"),table:"transfer_items",parentKey:"transfer_id",parentId:id,extra:{from_store_id:t.from_store_id,to_store_id:t.to_store_id},
  lines,items:map,editable,balances:editable?balances:null,costFor:itemId=>unitCost(itemId,lastCosts,map)});
 if(!editable)return;
 ctx.el.querySelector("[data-issue]").onclick=async()=>{
  if(!ui.lines.length)return toast("Inclua itens antes de emitir.","danger");
  const short=ui.lines.filter(l=>(balances.get(l.item_id)??0)<Number(l.quantity));
  if(short.length)return toast(short.length+" item(ns) com quantidade maior que o estoque disponível.","danger");
  if(!await confirmDialog({title:"Emitir transferência para "+name(t.to_store_id)+"?",text:ui.lines.length+" item(ns), "+money(ui.total())+". O estoque sai desta loja e entra no destino imediatamente.",confirmLabel:"Emitir"}))return;
  try{await update("transfers",id,{status:"issued",issued_at:new Date().toISOString()},{status:"draft"});toast("Transferência emitida.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-cancel]").onclick=async()=>{
  if(!await confirmDialog({title:"Cancelar transferência?",confirmLabel:"Cancelar transferência",danger:true}))return;
  try{await update("transfers",id,{status:"cancelled"},{status:"draft"});toast("Transferência cancelada.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
}
