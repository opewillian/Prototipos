// Ambiente Loja: barra vinho com seletor de unidade e navegação horizontal.
import {e} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {LOGO,userChip} from "../access.js";
import * as inicio from "../../modules/loja/inicio.js";
import * as contagem from "../../modules/loja/contagem.js";
import * as listas from "../../modules/loja/listas.js";
import * as notas from "../../modules/loja/notas.js";
import * as pedidos from "../../modules/loja/pedidos.js";
import * as transferencias from "../../modules/loja/transferencias.js";
import * as perdas from "../../modules/loja/perdas.js";
import * as cmv from "../../modules/loja/cmv.js";

// feature = código em store_feature_flags; módulos sem liberação não aparecem.
export const lojaModules=[
 {id:"inicio",label:"Início",icon:"home",mod:inicio},
 {id:"contagem",label:"Contagem",icon:"clipboard",feature:"counts",mod:contagem},
 {id:"listas",label:"Listas",icon:"list",feature:"lists",mod:listas},
 {id:"pedidos",label:"Pedidos de compra",icon:"cart",feature:"orders",mod:pedidos},
 {id:"notas",label:"Notas fiscais",icon:"receipt",feature:"notes",mod:notas},
 {id:"transferencias",label:"Transferências",icon:"swap",feature:"transfers",mod:transferencias},
 {id:"perdas",label:"Perdas",icon:"trash",feature:"losses",mod:perdas},
 {id:"cmv",label:"CMV",icon:"chart",feature:"cmv",mod:cmv}
];
export function enabledModules(app,storeId){
 const flags=app.flags[storeId]||{};
 return lojaModules.filter(m=>!m.feature||flags[m.feature]===true);
}
export function lojaShell(app,storeId,activeId){
 const shops=app.stores.filter(s=>s.store_type==="operational");
 const store=shops.find(s=>s.id===storeId);
 const nav=enabledModules(app,storeId).map(m=>'<a href="#/loja/'+encodeURIComponent(storeId)+'/'+m.id+'" data-nav="'+m.id+'"'+(m.id===activeId?' class="active"':'')+'>'+icon(m.icon,17)+e(m.label)+'</a>').join("");
 return '<div id="shell" data-shell="loja" data-store="'+e(storeId)+'"><header class="loja-top"><div class="loja-bar">'+
  '<a href="#/" class="logo-chip" title="Trocar ambiente"><img src="'+LOGO+'" alt="MFT"></a>'+
  '<div class="store-switch">'+icon("store",18)+'<div><small>Loja</small>'+(shops.length>1?
   '<select id="store-switch" aria-label="Trocar de loja">'+shops.map(s=>'<option value="'+e(s.id)+'"'+(s.id===storeId?" selected":"")+'>'+e(s.name)+'</option>').join("")+'</select>':
   '<strong>'+e(store?.name||storeId)+'</strong>')+'</div></div><span class="spacer"></span>'+
  (app.isAdmin?'<a class="btn btn-ghost btn-sm" href="#/matriz">'+icon("grid",16)+'<span class="hide-sm">Matriz</span></a>':'')+
  userChip(app)+'<button class="btn btn-ghost btn-sm" data-signout title="Sair">'+icon("logout",16)+'</button></div></header>'+
  '<nav class="loja-nav" aria-label="Menu da loja"><div class="loja-nav-inner">'+nav+'</div></nav>'+
  '<main class="content" id="content"></main></div>';
}
export function setLojaActive(root,id){
 root.querySelectorAll(".loja-nav a[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===id));
}
