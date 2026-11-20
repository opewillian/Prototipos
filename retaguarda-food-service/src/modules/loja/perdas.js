// Loja · Perdas: validade, quebra, avaria e descarte. Registrar reduz o estoque (gatilho do banco).
import {list,get,insert,update} from "../../core/db.js";
import {e,money,dateBR,today,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,field,input,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,alertBox,searchKey} from "../../core/ui.js";
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
  filterBar({search:"Motivo ou detalhe",dates:true,noun:["perda","perdas"],selects:[
   {key:"reason",all:"Todos os motivos",options:REASONS.map(r=>[r,r])},
   {key:"st",all:"Todas as situações",options:[["draft","Rascunho"],["recorded","Registrada"],["cancelled","Cancelada"]]}]})+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Data",render:r=>dateBR(r.loss_date)},{label:"Motivo",render:r=>r.reason?'<span class="strong">'+e(r.reason)+'</span>':'<span class="muted">Sem motivo</span>'},
   {label:"Valor",cls:"num",render:r=>money(tot(r.id))},{label:"Situação",render:r=>statusPill(r.status)}
  ],rows,{rowHref:r=>ctx.base+"/perdas/"+r.id,rowAttrs:r=>'data-search="'+e(searchKey(r.reason||""))+'" data-reason="'+e(String(r.reason||"").split(" — ")[0])+'" data-st="'+e(r.status)+'" data-date="'+e(String(r.loss_date).slice(0,10))+'" data-total="'+tot(r.id)+'"'}).replace('class="table"','class="table stack"'):emptyState("trash","Nenhuma perda registrada","Registre itens vencidos, quebrados ou descartados para manter o estoque correto."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 bindFilters(ctx.el,{noun:["perda","perdas"]});
 // Sem formulário: cria o rascunho na hora (data de hoje) e abre; data, motivo e detalhe ficam no lançamento.
 // Se já existe um rascunho vazio (sem motivo e sem itens), reabre ele.
 let creating=false;
 ctx.el.querySelector("[data-new]").onclick=async()=>{
  if(creating)return;creating=true;
  try{
   const empty=rows.find(r=>r.status==="draft"&&!r.reason&&!lines.some(l=>l.loss_id===r.id));
   if(empty)return ctx.go(ctx.base+"/perdas/"+empty.id);
   const l=await insert("losses",{store_id:ctx.storeId,loss_date:today(),reason:"",status:"draft",created_by:ctx.userId});
   ctx.go(ctx.base+"/perdas/"+l.id);
  }catch(error){toast(errorMessage(error),"danger")}
  finally{creating=false}
 };
}

async function detail(ctx,id){
 const [loss,lines,items,lastCosts,balances]=await Promise.all([get("losses",id),list("loss_items",{eq:{loss_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),loadBalances(ctx.storeId)]);
 if(!ctx.isCurrent())return;
 if(loss.store_id!==ctx.storeId)throw Error("Registro de outra loja.");
 const editable=loss.status==="draft";const map=byId(items);
 ctx.el.innerHTML=backLink(ctx.base+"/perdas","Perdas")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Perda de '+dateBR(loss.loss_date)+'</h1>'+statusPill(loss.status)+'</div>'+(editable?'':'<p class="muted" style="margin:6px 0 0">'+e(loss.reason||"Sem motivo")+'</p>')+'</div>'+
  '<div class="page-actions">'+(editable?btn("Cancelar",{variant:"ghost",attrs:"data-cancel"})+btn("Registrar baixa",{variant:"ok",icon:"check",attrs:"data-record"}):'')+'</div></div>'+
  (editable?(()=>{const [mot,...det]=String(loss.reason||"").split(" — ");return '<section class="card"><div class="card-body"><div class="form-grid loss-head">'+
    field("Data da perda",input("loss_date",String(loss.loss_date||"").slice(0,10),{type:"date",required:true,attrs:"data-head"}))+
    field("Motivo",'<select class="control" name="motivo" data-head><option value="">Selecione</option>'+REASONS.map(r=>'<option'+(r===mot?" selected":"")+'>'+e(r)+'</option>').join("")+'</select>')+
    field("Detalhe (opcional)",input("detalhe",det.join(" — "),{placeholder:"Ex.: lote 123, freezer desligado",attrs:"data-head"}))+'</div></div></section>'})():'')+
  (loss.status==="recorded"?alertBox("Baixa registrada no estoque da loja.","ok"):'')+card("Itens perdidos",'<div data-lines></div>',{flush:true});
 const ui=mountLines({el:ctx.el.querySelector("[data-lines]"),table:"loss_items",parentKey:"loss_id",parentId:id,extra:{store_id:ctx.storeId},lines,items:map,editable,balances:editable?balances:null,costFor:itemId=>unitCost(itemId,lastCosts,map)});
 if(!editable)return;
 // Data, motivo e detalhe gravam ao sair do campo (motivo e detalhe ficam juntos em losses.reason: "Motivo — detalhe").
 const headVal=n=>ctx.el.querySelector('[data-head][name="'+n+'"]')?.value||"";
 ctx.el.querySelectorAll("[data-head]").forEach(el=>el.addEventListener("change",async()=>{
  try{
   if(el.name==="loss_date"){if(!el.value){el.value=String(loss.loss_date||"").slice(0,10);return toast("Informe a data.","danger")}
    Object.assign(loss,await update("losses",id,{loss_date:el.value},{status:"draft"}));ctx.el.querySelector(".doc-title h1").textContent="Perda de "+dateBR(loss.loss_date);toast("Data atualizada.");return}
   const mot=headVal("motivo"),det=headVal("detalhe").trim();
   Object.assign(loss,await update("losses",id,{reason:mot?(mot+(det?" — "+det:"")):(det?"Outros — "+det:"")},{status:"draft"}));
   if(!mot&&det){ctx.el.querySelector('[data-head][name="motivo"]').value="Outros"}
   toast(el.name==="motivo"?"Motivo salvo.":"Detalhe salvo.");
  }catch(error){toast(errorMessage(error),"danger")}
 }));
 ctx.el.querySelector("[data-record]").onclick=async()=>{
  if(document.activeElement?.matches?.("[data-head]"))document.activeElement.blur();
  await new Promise(r=>setTimeout(r,250));
  if(!loss.reason)return toast("Escolha o motivo da perda.","danger");
  if(!ui.lines.length)return toast("Inclua os itens perdidos.","danger");
  if(!await confirmDialog({title:"Registrar baixa?",text:ui.lines.length+" item(ns), "+money(ui.total())+". O estoque será reduzido e o registro não poderá ser alterado.",confirmLabel:"Registrar"}))return;
  try{await update("losses",id,{status:"recorded"},{status:"draft"});toast("Perda registrada.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-cancel]").onclick=async()=>{
  if(!await confirmDialog({title:"Cancelar registro?",confirmLabel:"Cancelar registro",danger:true}))return;
  try{await update("losses",id,{status:"cancelled"},{status:"draft"});toast("Registro cancelado.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
}
