import {escapeHtml as e} from "../../core/format.js";
import {matrixModules} from "./config.js";
import {commonActions,sourceControl,accessBody,modeNote} from "../shared.js";
export function matrixLayout(state,content){
 const current=matrixModules.find(x=>x.id===state.moduleId)||matrixModules[0];
 let group="";
 const nav=matrixModules.map(m=>{
  let heading="";
  if(group!==m.group){group=m.group;heading='<div class="mat-nav-caption">'+e(group)+'</div>';}
  return heading+'<button class="mat-nav-item '+(state.moduleId===m.id?"selected":"")+'" data-module="'+e(m.id)+'"><span>'+e(m.initials)+'</span>'+e(m.label)+'</button>';
 }).join("");
 return '<div class="mat-shell"><aside class="mat-sidebar"><div class="mat-brand"><b>M</b><span>Retaguarda<small>ADMINISTRAÇÃO CENTRAL</small></span></div>'+
  '<div class="mat-context"><small>AMBIENTE</small><strong>Matriz</strong><span>Gestão corporativa</span></div><nav class="mat-nav" aria-label="Menu da Matriz">'+nav+'</nav>'+
  '<div class="mat-sidebar-foot">Painel administrativo</div></aside><div class="mat-work"><header class="mat-top"><span>Administração / <strong>'+e(current.label)+'</strong></span>'+commonActions(state)+'</header>'+
  '<main class="mat-content"><div class="mat-heading"><div><small>RETAgUARDA / MATRIZ</small><h1>'+e(current.label)+'</h1><p>Cadastros e acompanhamento central da operação.</p></div>'+sourceControl(state)+'</div>'+
  modeNote(state)+(state.error?'<div class="error-box" role="alert">'+e(state.error)+'</div>':"")+accessBody(state,content)+
  '<footer class="mat-footer">Retaguarda Food Service · Matriz</footer></main></div></div>';
}
