// Ambiente Matriz: menu lateral grafite, identidade administrativa.
import {e} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {LOGO,userChip} from "../access.js";
import * as painel from "../../modules/matriz/painel.js";
import * as unidades from "../../modules/matriz/unidades.js";
import * as itens from "../../modules/matriz/itens.js";
import * as fornecedores from "../../modules/matriz/fornecedores.js";
import * as usuarios from "../../modules/matriz/usuarios.js";
import * as pedidos from "../../modules/matriz/pedidos.js";

export const matrizModules=[
 {id:"painel",label:"Painel",icon:"home",group:"Gestão",mod:painel},
 {id:"pedidos",label:"Pedidos das lojas",icon:"cart",group:"Gestão",mod:pedidos},
 {id:"itens",label:"Itens",icon:"box",group:"Cadastros",mod:itens},
 {id:"fornecedores",label:"Fornecedores",icon:"truck",group:"Cadastros",mod:fornecedores},
 {id:"unidades",label:"Unidades",icon:"store",group:"Cadastros",mod:unidades},
 {id:"usuarios",label:"Usuários e acessos",icon:"users",group:"Cadastros",mod:usuarios}
];

export function matrizShell(app,activeId){
 let group="";
 const nav=matrizModules.map(m=>{
  const head=m.group!==group?'<h4>'+e(group=m.group)+'</h4>':"";
  return head+'<a href="#/matriz/'+m.id+'" data-nav="'+m.id+'"'+(m.id===activeId?' class="active"':'')+'>'+icon(m.icon)+'<span>'+e(m.label)+'</span></a>';
 }).join("");
 const stores=app.stores.filter(s=>s.store_type==="operational");
 return '<div class="mat" id="shell" data-shell="matriz">'+
  '<aside class="mat-sidebar"><div class="mat-brand"><span class="logo-chip"><img src="'+LOGO+'" alt="MFT"></span><div><strong>Retaguarda</strong><small>Matriz</small></div></div>'+
  '<nav class="mat-nav" aria-label="Menu da Matriz">'+nav+
  (stores.length?'<h4>Ir para loja</h4>'+stores.map(s=>'<a href="#/loja/'+encodeURIComponent(s.id)+'">'+icon("store")+'<span>'+e(s.name)+'</span></a>').join(""):'')+
  '</nav><div class="mat-side-foot">'+userChip(app)+'<button class="btn btn-ghost btn-sm" data-signout>'+icon("logout",16)+'<span>Sair</span></button></div></aside>'+
  '<div class="mat-main"><header class="mat-top"><button class="icon-btn" data-nav-toggle aria-label="Abrir menu">'+icon("menu")+'</button><img src="'+LOGO+'" alt="MFT"><strong>Matriz</strong></header>'+
  '<main class="content" id="content"></main></div></div>';
}
export function setMatrizActive(root,id){
 root.querySelectorAll(".mat-nav a[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===id));
 root.querySelector("#shell")?.classList.remove("nav-open");
 root.querySelector(".mat-scrim")?.remove();
}
export function bindMatrizShell(root){
 root.querySelector("[data-nav-toggle]")?.addEventListener("click",()=>{
  const shell=root.querySelector("#shell");shell.classList.add("nav-open");
  const scrim=document.createElement("div");scrim.className="mat-scrim";scrim.onclick=()=>{shell.classList.remove("nav-open");scrim.remove()};shell.appendChild(scrim);
 });
}
