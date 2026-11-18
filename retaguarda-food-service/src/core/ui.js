// Componentes visuais compartilhados por Matriz e Loja.
import {e} from "./format.js";
import {icon} from "./icons.js";

export const STATUS={
 draft:["Rascunho","neutral"],finalized:["Finalizada","ok"],cancelled:["Cancelado","muted"],
 pending:["Pendente","warn"],received:["Recebida","ok"],sent:["Enviado","info"],
 realizing:["Em andamento","warn"],realized:["Realizado","ok"],issued:["Emitida","ok"],recorded:["Registrada","ok"],
 paid:["Pago","ok"],open:["Em aberto","warn"],overdue:["Vencido","danger"]
};
export function statusPill(status){
 const [label,tone]=STATUS[status]||[status||"—","neutral"];
 return '<span class="pill pill-'+tone+'">'+e(label)+'</span>';
}
export function pageHead(title,subtitle="",actions=""){
 return '<header class="page-head"><div><h1>'+e(title)+'</h1>'+(subtitle?'<p>'+e(subtitle)+'</p>':'')+'</div>'+(actions?'<div class="page-actions">'+actions+'</div>':'')+'</header>';
}
export function backLink(href,label="Voltar"){
 return '<a class="back-link" href="'+e(href)+'">'+icon("chevronLeft",16)+e(label)+'</a>';
}
export function kpi(label,value,hint="",opts={}){
 const tag=opts.href?'a href="'+e(opts.href)+'"':'div';
 return '<'+tag+' class="kpi'+(opts.tone?' kpi-'+opts.tone:'')+'">'+(opts.icon?'<span class="kpi-icon">'+icon(opts.icon,20)+'</span>':'')+
  '<div><small>'+e(label)+'</small><strong>'+e(value)+'</strong>'+(hint?'<span>'+e(hint)+'</span>':'')+'</div></'+(opts.href?'a':'div')+'>';
}
export function emptyState(iconName,title,text="",action=""){
 return '<div class="empty-state"><span class="empty-icon">'+icon(iconName,28)+'</span><strong>'+e(title)+'</strong>'+(text?'<p>'+e(text)+'</p>':'')+action+'</div>';
}
export function card(title,body,opts={}){
 return '<section class="card'+(opts.cls?' '+opts.cls:'')+'">'+(title?'<header class="card-head"><h2>'+e(title)+'</h2>'+(opts.actions||"")+'</header>':'')+'<div class="card-body'+(opts.flush?' flush':'')+'">'+body+'</div></section>';
}
/** Tabela: columns=[{label,render(row)->html,cls}] ; rows ; rowHref(row) opcional. */
export function dataTable(columns,rows,opts={}){
 if(!rows.length)return opts.empty||emptyState("list","Nenhum registro encontrado");
 return '<div class="table-wrap"><table class="table"><thead><tr>'+columns.map(c=>'<th class="'+(c.cls||"")+'">'+e(c.label)+'</th>').join("")+'</tr></thead><tbody>'+
  rows.map(r=>{
   const href=opts.rowHref?opts.rowHref(r):null;
   return '<tr'+(href?' class="row-link" data-href="'+e(href)+'" tabindex="0"':'')+(opts.rowAttrs?' '+opts.rowAttrs(r):'')+'>'+columns.map(c=>'<td class="'+(c.cls||"")+'" data-label="'+e(c.label)+'">'+c.render(r)+'</td>').join("")+'</tr>';
  }).join("")+'</tbody></table></div>';
}
export function btn(label,opts={}){
 const cls="btn "+(opts.variant?"btn-"+opts.variant:"btn-primary")+(opts.sm?" btn-sm":"");
 const ic=opts.icon?icon(opts.icon,16):"";
 const attrs=(opts.attrs||"")+(opts.disabled?" disabled":"")+(opts.title?' title="'+e(opts.title)+'"':"");
 if(opts.href)return '<a class="'+cls+'" href="'+e(opts.href)+'" '+attrs+'>'+ic+'<span>'+e(label)+'</span></a>';
 return '<button type="'+(opts.type||"button")+'" class="'+cls+'" '+attrs+'>'+ic+'<span>'+e(label)+'</span></button>';
}
export function field(label,control,hint=""){
 return '<label class="field"><span class="field-label">'+e(label)+'</span>'+control+(hint?'<small class="field-hint">'+e(hint)+'</small>':'')+'</label>';
}
export function input(name,value="",opts={}){
 return '<input class="control'+(opts.cls?" "+opts.cls:"")+'" name="'+e(name)+'" type="'+(opts.type||"text")+'" value="'+e(value??"")+'"'+
  (opts.required?" required":"")+(opts.placeholder?' placeholder="'+e(opts.placeholder)+'"':"")+(opts.inputmode?' inputmode="'+opts.inputmode+'"':"")+
  (opts.disabled?" disabled":"")+(opts.attrs?" "+opts.attrs:"")+' autocomplete="off">';
}
export function textarea(name,value="",opts={}){
 return '<textarea class="control" name="'+e(name)+'" rows="'+(opts.rows||3)+'"'+(opts.disabled?" disabled":"")+(opts.placeholder?' placeholder="'+e(opts.placeholder)+'"':"")+'>'+e(value??"")+'</textarea>';
}
export function select(name,options,value="",opts={}){
 return '<select class="control" name="'+e(name)+'"'+(opts.required?" required":"")+(opts.disabled?" disabled":"")+(opts.attrs?" "+opts.attrs:"")+'>'+
  (opts.placeholder!==false?'<option value="">'+e(opts.placeholder||"Selecione")+'</option>':'')+
  options.map(([v,l])=>'<option value="'+e(v)+'"'+(String(v)===String(value??"")?" selected":"")+'>'+e(l)+'</option>').join("")+'</select>';
}
export function toggle(name,checked,label){
 return '<label class="switch"><input type="checkbox" name="'+e(name)+'"'+(checked?" checked":"")+'><span class="switch-track"></span><span>'+e(label)+'</span></label>';
}
export function searchBox(id,placeholder="Buscar",value=""){
 return '<label class="search">'+icon("search",16)+'<input id="'+e(id)+'" type="search" placeholder="'+e(placeholder)+'" value="'+e(value)+'" autocomplete="off"></label>';
}
export function tabs(items,active){
 return '<nav class="tabs">'+items.map(([id,label,href])=>'<a class="tab'+(id===active?" active":"")+'" href="'+e(href)+'">'+e(label)+'</a>').join("")+'</nav>';
}
export function loading(text="Carregando..."){
 return '<div class="loading-state"><span class="spinner"></span>'+e(text)+'</div>';
}
export function alertBox(text,tone="danger"){
 return '<div class="alert alert-'+tone+'" role="'+(tone==="danger"?"alert":"status")+'">'+icon(tone==="danger"?"alert":"info",18)+'<span>'+e(text)+'</span></div>';
}

// ---- Toasts ----
export function toast(message,tone="ok"){
 let host=document.getElementById("toasts");
 if(!host){host=document.createElement("div");host.id="toasts";host.setAttribute("aria-live","polite");document.body.appendChild(host);}
 const el=document.createElement("div");el.className="toast toast-"+tone;
 el.innerHTML=icon(tone==="ok"?"check":tone==="danger"?"alert":"info",18)+'<span>'+e(message)+'</span>';
 host.appendChild(el);
 setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),300)},tone==="danger"?6000:3200);
}
export function errorMessage(error){
 const m=String(error?.message||error||"Erro inesperado.");
 if(/row-level security|permission denied/i.test(m))return "Você não tem permissão para esta operação nesta unidade.";
 if(/duplicate key/i.test(m))return "Registro duplicado: já existe um cadastro com esses dados.";
 if(/violates foreign key/i.test(m))return "Este registro está vinculado a outros documentos e não pode ser alterado assim.";
 if(/Failed to fetch|NetworkError/i.test(m))return "Sem conexão com o servidor. Verifique a internet e tente novamente.";
 if(/JWT|token/i.test(m))return "Sua sessão expirou. Entre novamente.";
 return m;
}

// ---- Diálogo de confirmação (sem window.confirm) ----
export function confirmDialog({title,text="",confirmLabel="Confirmar",danger=false}){
 return new Promise(resolve=>{
  const wrap=document.createElement("div");wrap.className="overlay";
  wrap.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><h2 id="dlg-title">'+e(title)+'</h2>'+(text?'<p>'+e(text)+'</p>':'')+
   '<div class="dialog-actions">'+btn("Cancelar",{variant:"ghost",attrs:"data-no"})+btn(confirmLabel,{variant:danger?"danger":"primary",attrs:"data-yes"})+'</div></div>';
  const done=v=>{wrap.remove();document.removeEventListener("keydown",onKey);resolve(v)};
  const onKey=ev=>{if(ev.key==="Escape")done(false)};
  wrap.addEventListener("click",ev=>{if(ev.target===wrap)done(false)});
  wrap.querySelector("[data-no]").onclick=()=>done(false);
  wrap.querySelector("[data-yes]").onclick=()=>done(true);
  document.addEventListener("keydown",onKey);document.body.appendChild(wrap);
  wrap.querySelector("[data-yes]").focus();
 });
}

// ---- Painel lateral (drawer) para formulários ----
export function openDrawer({title,body,submitLabel="Salvar",onSubmit,wide=false,readOnly=false}){
 const wrap=document.createElement("div");wrap.className="overlay overlay-drawer";
 wrap.innerHTML='<form class="drawer'+(wide?" drawer-wide":"")+'" novalidate><header class="drawer-head"><h2>'+e(title)+'</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">'+icon("x")+'</button></header>'+
  '<div class="drawer-body">'+body+'<div class="drawer-error"></div></div>'+
  '<footer class="drawer-foot">'+btn(readOnly?"Fechar":"Cancelar",{variant:"ghost",attrs:"data-close"})+(readOnly?"":btn(submitLabel,{type:"submit",icon:"check"}))+'</footer></form>';
 const form=wrap.querySelector("form");
 const close=()=>{wrap.remove();document.removeEventListener("keydown",onKey)};
 const onKey=ev=>{if(ev.key==="Escape")close()};
 wrap.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);
 wrap.addEventListener("mousedown",ev=>{if(ev.target===wrap)close()});
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();
  const errBox=form.querySelector(".drawer-error");errBox.innerHTML="";
  const submit=form.querySelector("[type=submit]");if(submit)submit.disabled=true;
  try{const ok=await onSubmit?.(form);if(ok!==false)close();}
  catch(error){errBox.innerHTML=alertBox(errorMessage(error));}
  finally{if(submit)submit.disabled=false;}
 });
 document.addEventListener("keydown",onKey);document.body.appendChild(wrap);
 form.querySelector("input:not([type=hidden]),select,textarea")?.focus();
 return {el:form,close};
}

/** Liga clique/Enter nas linhas com data-href. */
export function bindRowLinks(root){
 root.querySelectorAll("tr[data-href]").forEach(tr=>{
  const go=()=>{location.hash=tr.dataset.href.replace(/^#/,"")};
  tr.addEventListener("click",ev=>{if(!ev.target.closest("a,button,input,select"))go()});
  tr.addEventListener("keydown",ev=>{if(ev.key==="Enter")go()});
 });
}
/** Filtro de linhas em memória por texto (data-search) . */
export function bindSearch(root,inputId,rowSelector="tr[data-search]"){
 const inp=root.querySelector("#"+inputId);if(!inp)return;
 const run=()=>{const t=inp.value.trim().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  let shown=0;root.querySelectorAll(rowSelector).forEach(r=>{const ok=!t||r.dataset.search.includes(t);r.hidden=!ok;if(ok)shown++});
  const c=root.querySelector("[data-search-count]");if(c)c.textContent=shown;};
 inp.addEventListener("input",run);run();
}
export function searchKey(...parts){return parts.join(" ").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}
