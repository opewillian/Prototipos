import {escapeHtml as e} from "../../core/format.js";
import {storeModules} from "./config.js";
import {featureByModule} from "../../core/feature-map.js";
import {commonActions,sourceControl,accessBody,modeNote} from "../shared.js";
export function storeLayout(state,content){
 const current=storeModules.find(x=>x.id===state.moduleId)||storeModules[0];
 const operational=state.stores.filter(s=>s.store_type==="operational");
 const store=operational.find(s=>s.id===state.storeId);
 const nav=storeModules.map(m=>'<button class="loja-nav-item '+(state.moduleId===m.id?"selected":"")+'" data-module="'+e(m.id)+'"><small>'+e(m.initials)+'</small>'+e(m.label)+(featureByModule[m.id]&&!state.features?.[featureByModule[m.id]]?' · Aguardando liberação':'')+'</button>').join("");
 const options=operational.map(s=>'<option value="'+e(s.id)+'"'+(s.id===state.storeId?" selected":"")+'>'+e(s.name)+'</option>').join("");
 return '<div class="loja-shell"><header class="loja-top"><div class="loja-brand"><b>FS</b><span>Retaguarda<small>OPERAÇÃO DE LOJA</small></span></div>'+commonActions(state)+'</header>'+
 '<div class="loja-unit"><div><small>UNIDADE OPERACIONAL</small><h2>'+e(store?.name||"Selecione uma loja")+'</h2></div><div class="loja-unit-select"><label for="store">Unidade</label><select id="store">'+options+'</select><button id="choose-store">Escolher loja</button></div></div>'+
 '<nav class="loja-nav" aria-label="Menu da Loja">'+nav+'</nav>'+
 '<main class="loja-content"><div class="loja-heading"><div><small>ROTINA OPERACIONAL</small><h1>'+e(current.label)+'</h1><p>Atividades e documentos exclusivos desta loja.</p></div>'+sourceControl(state)+'</div>'+
 modeNote(state)+(state.error?'<div class="error-box" role="alert">'+e(state.error)+'</div>':"")+accessBody(state,content)+
 '<footer class="loja-footer">Retaguarda Food Service · Loja · Dados por unidade</footer></main></div>';
}
