// Loja · Transferências entre lojas. Emitir gera saída na origem e entrada no destino (gatilho do banco).
// "Nova transferência" cria o rascunho na hora; destino, data e observação ficam na própria transferência.
// Custo unitário = última compra recebida na loja de origem; sem compra, custo padrão do item (não é digitado).
import {list,get,insert,update,nextNumber} from "../../core/db.js";
import {e,money,dateBR,round2,today} from "../../core/format.js";
import {pageHead,btn,dataTable,field,input,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,alertBox} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,loadBalances,unitCost} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";

const destinations=ctx=>ctx.app.stores.filter(s=>s.store_type==="operational"&&s.id!==ctx.storeId&&(ctx.app.flags[s.id]||{}).transfers);
const storeLabel=s=>s?s.name+(s.everest_code?" ("+s.everest_code+")":""):"";

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
 const others=destinations(ctx);
 ctx.el.innerHTML=pageHead("Transferências","Envio de mercadorias entre lojas, com saída e entrada automáticas no estoque.",
   btn("Imprimir formulário",{variant:"secondary",icon:"printer",attrs:"data-print-form"})+(others.length?btn("Nova transferência",{icon:"plus",attrs:"data-new"}):""))+
  '<div class="kpis">'+kpi("Enviadas",out.filter(r=>r.status==="issued").length,money(out.filter(r=>r.status==="issued").reduce((s,r)=>s+tot(r.id),0)),{icon:"swap"})+
  kpi("Recebidas",inn.filter(r=>r.status==="issued").length,money(inn.filter(r=>r.status==="issued").reduce((s,r)=>s+tot(r.id),0)),{icon:"box",tone:"ok"})+
  kpi("Rascunhos",out.filter(r=>r.status==="draft").length,"",{icon:"edit",tone:"warn"})+kpi("Lojas habilitadas",others.length,"para receber/enviar",{icon:"store",tone:"info"})+'</div>'+
  (others.length?'':alertBox("Nenhuma outra loja está habilitada para transferências no momento.","info"))+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Transferência",render:r=>'<span class="strong">'+e(r.number)+'</span>'+(r.observation?'<small class="sub">'+e(r.observation)+'</small>':'')},
   {label:"Direção",render:r=>r.from_store_id===ctx.storeId?'<span class="tag">Saída</span> para '+e(name(r.to_store_id)):'<span class="tag">Entrada</span> de '+e(name(r.from_store_id))},
   {label:"Data",render:r=>dateBR(r.transfer_date||r.issued_at||r.created_at)},
   {label:"Valor",cls:"num",render:r=>money(tot(r.id))},{label:"Situação",render:r=>statusPill(r.status)}
  ],rows,{rowHref:r=>ctx.base+"/transferencias/"+r.id}).replace('class="table"','class="table stack"'):emptyState("swap","Nenhuma transferência","As transferências enviadas e recebidas pela loja aparecem aqui."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelector("[data-print-form]").onclick=async()=>{
  try{printBlankForm(ctx,await loadItems({store:ctx.store}))}catch(error){toast(errorMessage(error),"danger")}
 };
 let creating=false;
 ctx.el.querySelector("[data-new]")?.addEventListener("click",async()=>{
  if(creating)return;creating=true;
  try{
   const number=await nextNumber("transfers","number","from_store_id",ctx.storeId,"TR");
   // O banco exige destino: começa com a primeira loja habilitada; a pessoa troca na própria transferência.
   const t=await insert("transfers",{number,from_store_id:ctx.storeId,to_store_id:others[0].id,transfer_date:today(),status:"draft",created_by:ctx.userId});
   toast("Transferência "+number+" criada. Confira a loja de destino.");ctx.go(ctx.base+"/transferencias/"+t.id);
  }catch(error){toast(errorMessage(error),"danger")}
  finally{creating=false}
 });
}

async function detail(ctx,id){
 const [t,lines,items,lastCosts,balances]=await Promise.all([get("transfers",id),list("transfer_items",{eq:{transfer_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),loadBalances(ctx.storeId)]);
 if(!ctx.isCurrent())return;
 if(t.from_store_id!==ctx.storeId&&t.to_store_id!==ctx.storeId)throw Error("Transferência de outra loja.");
 const name=sid=>ctx.app.stores.find(s=>s.id===sid)?.name||sid;
 const isOrigin=t.from_store_id===ctx.storeId;const editable=isOrigin&&t.status==="draft";
 const map=byId(items);
 const others=destinations(ctx);
 const dest=others.some(s=>s.id===t.to_store_id)?others:others.concat(ctx.app.stores.filter(s=>s.id===t.to_store_id));
 ctx.el.innerHTML=backLink(ctx.base+"/transferencias","Transferências")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Transferência '+e(t.number)+'</h1>'+statusPill(t.status)+'</div>'+
  (editable?'':'<p class="muted" style="margin:6px 0 0">'+e(name(t.from_store_id))+' → '+e(name(t.to_store_id))+' · '+e(dateBR(t.transfer_date||t.created_at))+'</p>')+'</div>'+
  '<div class="page-actions">'+(editable?btn("Cancelar",{variant:"ghost",attrs:"data-cancel"})+btn("Emitir transferência",{variant:"ok",icon:"check",attrs:"data-issue"}):'')+'</div></div>'+
  (editable?'<section class="card"><div class="card-body"><div class="form-grid transfer-head">'+
    field("Loja de destino",'<select class="control" name="to_store_id" data-head>'+dest.map(s=>'<option value="'+e(s.id)+'"'+(s.id===t.to_store_id?" selected":"")+'>'+e(storeLabel(s))+'</option>').join("")+'</select>')+
    field("Data da transferência",input("transfer_date",t.transfer_date||today(),{type:"date",required:true,attrs:"data-head"}))+
    field("Observação",input("observation",t.observation||"",{placeholder:"Opcional",attrs:"data-head"}))+'</div></div></section>'
   :(t.observation?alertBox(t.observation,"info"):''))+
  (t.status==="issued"?alertBox("Emitida em "+dateBR(t.issued_at)+". Saída registrada em "+name(t.from_store_id)+" e entrada em "+name(t.to_store_id)+".","ok"):'')+
  card("Itens",'<div data-lines></div>',{flush:true});
 // extra é lido a cada linha nova: trocar o destino aqui já vale para os próximos itens.
 const extra={from_store_id:t.from_store_id,to_store_id:t.to_store_id};
 const ui=mountLines({el:ctx.el.querySelector("[data-lines]"),table:"transfer_items",parentKey:"transfer_id",parentId:id,extra,
  lines,items:map,editable,fixedCost:true,balances:editable?balances:null,costFor:itemId=>unitCost(itemId,lastCosts,map)});
 if(!editable)return;
 // Destino, data e observação gravam ao sair do campo. Trocar o destino também atualiza as linhas já lançadas.
 ctx.el.querySelectorAll("[data-head]").forEach(el=>el.addEventListener("change",async()=>{
  const k=el.name;
  if(k==="transfer_date"&&!el.value){el.value=t.transfer_date;return toast("Informe a data da transferência.","danger")}
  const patch=k==="observation"?{observation:el.value.trim()||null}:{[k]:el.value};
  try{
   if(k==="to_store_id")for(const l of ui.lines)Object.assign(l,await update("transfer_items",l.id,{to_store_id:el.value}));
   Object.assign(t,await update("transfers",id,patch,{status:"draft"}));
   if(k==="to_store_id")extra.to_store_id=el.value;
   toast(k==="to_store_id"?"Destino: "+name(el.value)+".":k==="transfer_date"?"Data atualizada.":"Observação salva.");
  }catch(error){toast(errorMessage(error),"danger");el.value=t[k]||""}
 }));
 ctx.el.querySelector("[data-issue]").onclick=async()=>{
  if(document.activeElement?.matches?.("[data-head]"))document.activeElement.blur();
  await new Promise(r=>setTimeout(r,250));
  if(!ui.lines.length)return toast("Inclua itens antes de emitir.","danger");
  const short=ui.lines.filter(l=>(balances.get(l.item_id)??0)<Number(l.quantity));
  if(short.length)return toast(short.length+" item(ns) com quantidade maior que o estoque disponível.","danger");
  if(!await confirmDialog({title:"Emitir transferência para "+name(t.to_store_id)+"?",text:ui.lines.length+" item(ns), "+money(ui.total())+", data "+dateBR(t.transfer_date)+". O estoque sai desta loja e entra no destino imediatamente.",confirmLabel:"Emitir"}))return;
  try{await update("transfers",id,{status:"issued",issued_at:new Date().toISOString()},{status:"draft"});toast("Transferência emitida.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-cancel]").onclick=async()=>{
  if(!await confirmDialog({title:"Cancelar transferência?",confirmLabel:"Cancelar transferência",danger:true}))return;
  try{await update("transfers",id,{status:"cancelled"},{status:"draft"});toast("Transferência cancelada.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
}

// Formulário em branco para preencher à mão: todos os itens liberados para a loja, com quantidade e destino em branco.
function printBlankForm(ctx,items){
 const rows=items.filter(i=>i.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
 document.querySelector(".print-sheet")?.remove();
 const sheet=document.createElement("div");sheet.className="print-sheet";
 sheet.innerHTML='<h1>Formulário de transferência</h1>'+
  '<p class="ps-meta">Loja de origem: <strong>'+e(storeLabel(ctx.store))+'</strong> · Loja de destino: ______________________________ · Data: ____/____/______</p>'+
  '<p class="ps-meta">Responsável pelo envio: ______________________________ · Recebido por: ______________________________</p>'+
  '<table><thead><tr><th class="ps-n">#</th><th>Item</th><th>Unidade</th><th>Quantidade</th></tr></thead><tbody>'+
  rows.map((i,n)=>'<tr><td class="ps-n">'+(n+1)+'</td><td><strong>'+e(i.name)+'</strong><small>'+e(i.code||"")+'</small></td><td>'+e(i.base_unit||"")+'</td><td><span class="ps-blank"></span></td></tr>').join("")+
  '</tbody></table>';
 document.body.appendChild(sheet);document.body.classList.add("printing-sheet");
 const done=()=>{document.body.classList.remove("printing-sheet");sheet.remove();removeEventListener("afterprint",done)};
 addEventListener("afterprint",done);
 window.print();
}
