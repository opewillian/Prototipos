// Estrutura única da Retaguarda (Matriz e Loja): menu lateral recolhível com busca e grupos,
// barra superior com Ambiente e Loja pesquisável. Trocar de loja mantém o módulo atual.
import {e,initials,normalizeText} from "../core/format.js";
import {icon} from "../core/icons.js";
import {LOGO} from "./access.js";
import {matrizModules} from "./matriz/shell.js";
import {enabledModules} from "./loja/shell.js";

const COLLAPSE_KEY="rfs-sidebar-collapsed";
function getPref(k){try{return localStorage.getItem(k)}catch{return null}}
function setPref(k,v){try{localStorage.setItem(k,v)}catch{}}

export function shops(app){return app.stores.filter(s=>s.store_type==="operational")}

export function appShell(app){
 const name=app.profile?.display_name||app.session?.user?.email||"";
 const collapsed=getPref(COLLAPSE_KEY)==="1";
 return '<div class="app'+(collapsed?" collapsed":"")+'" id="shell">'+
  '<aside class="sb" aria-label="Menu principal"><a class="sb-brand" href="#/" title="Início"><span class="sb-logo"><img src="'+LOGO+'" alt="MFT"></span><span class="nav-label"><strong>Retaguarda</strong><small data-area-label></small></span></a>'+
  '<label class="sb-search">'+icon("search",16)+'<input id="menu-search" type="search" placeholder="Pesquisar no menu" autocomplete="off"></label>'+
  '<nav class="sb-nav" id="nav"></nav>'+
  '<div class="sb-foot"><button class="sb-link" data-signout title="Sair">'+icon("logout",18)+'<span class="nav-label">Sair</span></button></div></aside>'+
  '<div class="main"><header class="topbar">'+
  '<button class="icon-btn tb-toggle" data-toggle-nav aria-label="Recolher ou abrir o menu">'+icon("menu")+'</button>'+
  '<div class="tb-field" data-env-field><span class="tb-label">Ambiente</span><select id="env" class="tb-select" aria-label="Ambiente"></select></div>'+
  '<div class="tb-field tb-store"><span class="tb-label">Loja</span><div class="combo" id="store-combo"><button type="button" class="combo-btn" id="store-btn" aria-haspopup="listbox" aria-expanded="false"></button>'+
  '<div class="combo-pop" id="store-pop" hidden><label class="combo-search">'+icon("search",15)+'<input id="store-q" placeholder="Buscar loja por nome ou código" autocomplete="off"></label><ul class="combo-list" role="listbox" id="store-list"></ul></div></div></div>'+
  '<span class="tb-spacer"></span>'+
  '<div class="tb-user" title="'+e(name)+'"><span class="avatar">'+e(initials(name))+'</span><span class="tb-user-name">'+e(name)+'</span></div>'+
  '</header><main class="content" id="content"></main></div><div class="sb-scrim" data-close-nav></div></div>';
}

function navItems(app,area,storeId){
 if(area==="matriz")return matrizModules.map(m=>({...m,href:"#/matriz/"+m.id}));
 return enabledModules(app,storeId).map(m=>({...m,href:"#/loja/"+encodeURIComponent(storeId)+"/"+m.id}));
}

/** Atualiza menu, ambiente e loja conforme a rota atual. */
export function updateShell(root,app,{area,storeId,moduleId}){
 const items=navItems(app,area,storeId);
 let html="",group=null;
 for(const m of items){
  if(m.group&&m.group!==group){
   if(group)html+='</div></div>';
   group=m.group;
   const open=getPref("rfs-group-"+area+"-"+group)!=="0"||items.some(x=>x.group===group&&x.id===moduleId);
   html+='<div class="sb-group'+(open?" open":"")+'" data-group="'+e(group)+'"><button class="sb-group-head" data-group-toggle title="'+e(group)+'">'+icon(m.groupIcon||"layers",18)+'<span class="nav-label">'+e(group)+'</span><span class="nav-label chev">'+icon("chevronRight",14)+'</span></button><div class="sb-group-items">';
  }else if(!m.group&&group){html+='</div></div>';group=null}
  html+='<a class="sb-link'+(m.id===moduleId?" active":"")+'" href="'+m.href+'" data-label="'+e(normalizeText(m.label+" "+(m.group||"")))+'" title="'+e(m.label)+'">'+icon(m.icon,18)+'<span class="nav-label">'+e(m.label)+'</span></a>';
 }
 if(group)html+='</div></div>';
 root.querySelector("#nav").innerHTML=html;
 root.querySelector("[data-area-label]").textContent=area==="matriz"?"Matriz":"Operação da loja";
 // Ambiente
 const env=root.querySelector("#env");
 const opts=(app.isAdmin?[["matriz","Matriz"]]:[]).concat(shops(app).length?[["loja","Loja"]]:[]);
 env.innerHTML=opts.map(([v,l])=>'<option value="'+v+'"'+(v===area?" selected":"")+'>'+e(l)+'</option>').join("");
 root.querySelector("[data-env-field]").hidden=opts.length<2;
 // Loja
 const store=shops(app).find(s=>s.id===storeId);
 root.querySelector("#store-btn").innerHTML=store?'<span class="combo-value">'+e(store.name)+(store.code?' <small>['+e(store.code)+']</small>':'')+'</span>'+icon("chevronRight",14):
  '<span class="combo-value muted">'+(area==="matriz"?"Todas as lojas · ir para uma loja":"Selecione a loja")+'</span>'+icon("chevronRight",14);
 root.querySelector("#shell").dataset.area=area;
 root.querySelector("#menu-search").value="";
 root.querySelector("#shell").classList.remove("nav-open");
}

export function bindAppShell(root,app,{onStore,onEnv,onSignOut}){
 const shell=root.querySelector("#shell");
 root.querySelector("[data-toggle-nav]").onclick=()=>{
  if(window.matchMedia("(max-width:960px)").matches){shell.classList.toggle("nav-open");return}
  const c=!shell.classList.contains("collapsed");shell.classList.toggle("collapsed",c);setPref(COLLAPSE_KEY,c?"1":"0");
 };
 root.querySelector("[data-close-nav]").onclick=()=>shell.classList.remove("nav-open");
 root.querySelectorAll("[data-signout]").forEach(b=>b.onclick=onSignOut);
 root.querySelector("#nav").addEventListener("click",ev=>{
  const t=ev.target.closest("[data-group-toggle]");
  if(t){
   if(shell.classList.contains("collapsed")){shell.classList.remove("collapsed");setPref(COLLAPSE_KEY,"0")}
   const g=t.closest(".sb-group");g.classList.toggle("open");
   setPref("rfs-group-"+shell.dataset.area+"-"+g.dataset.group,g.classList.contains("open")?"1":"0");return;
  }
  if(ev.target.closest("a.sb-link"))shell.classList.remove("nav-open");
 });
 const ms=root.querySelector("#menu-search");
 ms.addEventListener("focus",()=>{if(shell.classList.contains("collapsed")){shell.classList.remove("collapsed");setPref(COLLAPSE_KEY,"0")}});
 ms.addEventListener("input",()=>{
  const q=normalizeText(ms.value).trim();
  root.querySelectorAll("#nav .sb-link").forEach(a=>a.hidden=!!q&&!a.dataset.label.includes(q));
  root.querySelectorAll("#nav .sb-group").forEach(g=>{const any=[...g.querySelectorAll(".sb-link")].some(a=>!a.hidden);g.hidden=!any;if(q)g.classList.add("open")});
 });
 ms.addEventListener("keydown",ev=>{if(ev.key==="Enter"){const a=root.querySelector("#nav .sb-link:not([hidden])");if(a){location.hash=a.getAttribute("href");ms.blur()}}});
 root.querySelector("#env").addEventListener("change",ev=>onEnv(ev.target.value));
 // Loja pesquisável
 const btn=root.querySelector("#store-btn"),pop=root.querySelector("#store-pop"),q=root.querySelector("#store-q"),ul=root.querySelector("#store-list");
 let active=0;
 const draw=()=>{
  const t=normalizeText(q.value).trim();
  const list=shops(app).filter(s=>!t||normalizeText(s.name+" "+(s.code||"")).includes(t));
  active=Math.min(active,Math.max(0,list.length-1));
  ul.innerHTML=list.length?list.map((s,i)=>'<li role="option" data-id="'+e(s.id)+'" class="'+(i===active?"hl ":"")+(s.id===shell.dataset.store?"current":"")+'">'+icon("store",15)+'<span>'+e(s.name)+'</span><small>'+e(s.code||"")+'</small></li>').join(""):'<li class="empty-opt">Nenhuma loja encontrada</li>';
 };
 const open=()=>{pop.hidden=false;btn.setAttribute("aria-expanded","true");q.value="";active=0;draw();q.focus()};
 const close=()=>{pop.hidden=true;btn.setAttribute("aria-expanded","false")};
 btn.onclick=()=>pop.hidden?open():close();
 q.addEventListener("input",()=>{active=0;draw()});
 q.addEventListener("keydown",ev=>{
  const n=ul.querySelectorAll("li[data-id]").length;
  if(ev.key==="ArrowDown"){ev.preventDefault();active=Math.min(n-1,active+1);draw()}
  else if(ev.key==="ArrowUp"){ev.preventDefault();active=Math.max(0,active-1);draw()}
  else if(ev.key==="Enter"){ev.preventDefault();const li=ul.querySelectorAll("li[data-id]")[active];if(li){close();onStore(li.dataset.id)}}
  else if(ev.key==="Escape"){close();btn.focus()}
 });
 ul.addEventListener("mousedown",ev=>{const li=ev.target.closest("li[data-id]");if(li){ev.preventDefault();close();onStore(li.dataset.id)}});
 current={pop,open,close};
 if(!docBound){
  docBound=true;
  document.addEventListener("mousedown",ev=>{if(current&&!current.pop.hidden&&!ev.target.closest("#store-combo"))current.close()});
  // Atalho: Ctrl+K abre a busca de loja.
  document.addEventListener("keydown",ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==="k"&&current&&document.contains(current.pop)){ev.preventDefault();current.open()}});
 }
}
let current=null,docBound=false;
export function markStore(root,storeId){const s=root.querySelector("#shell");if(s)s.dataset.store=storeId||""}
