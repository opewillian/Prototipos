// Loja · Perdas: validade, quebra, avaria e descarte. Registrar reduz o estoque (gatilho do banco).
import {list,get,insert,update} from "../../core/db.js";
import {e,money,dateBR,today,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,openDrawer,field,input,select,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,alertBox,searchKey} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,loadBalances,unitCost} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";
import {filterBar,bindFilters} from "../../core/filters.js";

export const REASONS=["Validade vencida","Quebra","Avaria","Descarte por qualidade","Erro de preparo","Furto ou desvio","Outros"];

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [rows,lines]=await Promise.all([list("losses",{eq:{store_id:ctx.storeId},order:"loss_date",order2:"created_at"}),list("loss_items",{select:"loss_id,line_total",eq:{store_id:ctx.storeId}})]);
 if(!ctx.isCurrent())return;
 const tot=id=>round2(lines.filter(l=>l.loss_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const month=today().slice(0,7);const rec=rows.filter(r=>r.status==="recorded");
 const monthRows=rec.filter(r=>String(r.loss_date).startsWith(month));
 const byReason={};for(const r of monthRows){const k=String(r.reason).split(" — ")[0];byReason[k]=(byReason[k]||0)+tot(r.id)}
 const top=Object.entries(byReason).sort((a,b)=>b[1]-a[1])[0];
 ctx.el.innerHTML=pageHead("Perdas","Registro de perdas com baixa no estoque e valor para o CMV.",btn("Registrar perda",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Perdas no mês",money(monthRows.reduce((s,r)=>s+tot(r.id),0)),monthRows.length+" registro(s)",{icon:"trash",tone:"warn"})+
  kpi("Principal motivo",top?top[0]:"—",top?money(top[1]):"",{icon:"alert"})+
  kpi("Rascunhos",rows.filter(r=>r.status==="draft").length,"",{icon:"edit",tone:"info"})+kpi("Total registrado",money(rec.reduce((s,r)=>s+tot(r.id),0)),"",{icon:"chart",tone:"ok"})+'</div>'+
  filterBar({search:"Motivo ou detalhe",dates:true,noun:["perda","perdas"],selects:[
   {key:"reason",all:"Todos os motivos",options:REASONS.map(r=>[r,r])},
   {key:"st",all:"Todas as situações",options:[["draft","Rascunho"],["recorded","Registrada"],["cancelled","Cancelada"]]}]})+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Data",render:r=>dateBR(r.loss_date)},{label:"Motivo",render:r=>'<span class="strong">'+e(r.reason)+'</span>'},
   {label:"Valor",cls:"num",render:r=>money(tot(r.id))},{label:"Situação",render:r=>statusPill(r.status)}
  ],rows,{rowHref:r=>ctx.base+"/perdas/"+r.id,rowAttrs:r=>'data-search="'+e(searchKey(r.reason||""))+'" data-reason="'+e(String(r.reason||"").split(" — ")[0])+'" data-st="'+e(r.status)+'" data-date="'+e(String(r.loss_date).slice(0,10))+'" data-total="'+tot(r.id)+'"'}).replace('class="table"','class="table stack"'):emptyState("trash","Nenhuma perda registrada","Registre itens vencidos, quebrados ou descartados para manter o estoque correto."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 bindFilters(ctx.el,{noun:["perda","perdas"]});
 ctx.el.querySelector("[data-new]").onclick=()=>openDrawer({title:"Registrar perda",submitLabel:"Criar e incluir itens",body:'<div class="form-grid">'+
  field("Data",input("loss_date",today(),{type:"date",required:true}))+field("Motivo",select("reason",REASONS.map(r=>[r,r]),"",{required:true}))+
  '<div class="span-2">'+field("Detalhe (opcional)",input("detail","",{placeholder:"Ex.: lote 123, freezer desligado"}))+'</div></div>',
  onSubmit:async form=>{const f=form.elements;if(!f.reason.value||!f.loss_date.value)throw Error("Informe data e motivo.");
   const l=await insert("losses",{store_id:ctx.storeId,loss_date:f.loss_date.value,reason:f.reason.value+(f.detail.value.trim()?" — "+f.detail.value.trim():""),status:"draft",created_by:ctx.userId});
   toast("Perda criada. Inclua os itens.");ctx.go(ctx.base+"/perdas/"+l.id)}});
}

async function detail(ctx,id){
 const [loss,lines,items,lastCosts,balances]=await Promise.all([get("losses",id),list("loss_items",{eq:{loss_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),loadBalances(ctx.storeId)]);
 if(!ctx.isCurrent())return;
 if(loss.store_id!==ctx.storeId)throw Error("Registro de outra loja.");
 const editable=loss.status==="draft";const map=byId(items);
 ctx.el.innerHTML=backLink(ctx.base+"/perdas","Perdas")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Perda de '+dateBR(loss.loss_date)+'</h1>'+statusPill(loss.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(loss.reason)+'</p></div>'+
  '<div class="page-actions">'+(editable?btn("Cancelar",{variant:"ghost",attrs:"data-cancel"})+btn("Registrar baixa",{variant:"ok",icon:"check",attrs:"data-record"}):'')+'</div></div>'+
  (loss.status==="recorded"?alertBox("Baixa registrada no estoque da loja.","ok"):'')+card("Itens perdidos",'<div data-lines></div>',{flush:true});
 const ui=mountLines({el:ctx.el.querySelector("[data-lines]"),table:"loss_items",parentKey:"loss_id",parentId:id,extra:{store_id:ctx.storeId},lines,items:map,editable,balances:editable?balances:null,costFor:itemId=>unitCost(itemId,lastCosts,map)});
 if(!editable)return;
 ctx.el.querySelector("[data-record]").onclick=async()=>{
  if(!ui.lines.length)return toast("Inclua os itens perdidos.","danger");
  if(!await confirmDialog({title:"Registrar baixa?",text:ui.lines.length+" item(ns), "+money(ui.total())+". O estoque será reduzido e o registro não poderá ser alterado.",confirmLabel:"Registrar"}))return;
  try{await update("losses",id,{status:"recorded"},{status:"draft"});toast("Perda registrada.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-cancel]").onclick=async()=>{
  if(!await confirmDialog({title:"Cancelar registro?",confirmLabel:"Cancelar registro",danger:true}))return;
  try{await update("losses",id,{status:"cancelled"},{status:"draft"});toast("Registro cancelado.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
}
