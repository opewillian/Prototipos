import {escapeHtml,displayValue} from "../core/format.js";
import {models,statusLabels,TODAY} from "../core/models.js";
import {renderTable} from "./table.js";
import {renderCountLines} from "../modules/contagem/lines.js";

const safe=escapeHtml;
function control(field,record,lookups,editing){
 const current=record?.[field.key];
 const value=current??(field.type==="date"?TODAY():"");
 const req=field.required?" required":"";
 const disabled=(editing && field.key==="id")?" disabled":"";
 const common=' name="'+safe(field.key)+'" id="field-'+safe(field.key)+'"';
 if(field.type==="checkbox")return '<label class="check-field"><input type="checkbox"'+common+(current===true||(!record&&["active","composes_cmv"].includes(field.key))?" checked":"")+' '+disabled+'> '+safe(field.label)+'</label>';
 if(field.type==="select"||field.type==="lookup"){
  let options=field.options||[];
  // Itens/fornecedores/listas inativos não são oferecidos, exceto se já estiverem gravados no registro.
  if(field.type==="lookup")options=(lookups[field.lookup]||[]).filter(r=>r.active!==false||String(r.id)===String(value)).map(r=>[r.id,r.name||r.display_id||r.number||r.code||r.id]);
  return '<label class="form-field">'+safe(field.label)+'<select'+common+req+disabled+'><option value="">Selecione</option>'+
   options.map(([id,name])=>'<option value="'+safe(id)+'"'+(String(id)===String(value)?" selected":"")+'>'+safe(name)+'</option>').join("")+
   '</select></label>';
 }
 return '<label class="form-field">'+safe(field.label)+'<input'+common+' type="'+(field.type==="number"?"number":field.type==="date"?"date":"text")+
  '" value="'+safe(value)+'"'+req+disabled+(field.min!==undefined?' min="'+field.min+'"':'')+
  (field.step?' step="'+field.step+'"':'')+' autocomplete="off"></label>';
}
function fieldsHTML(fields,record,lookups,editing){return '<div class="form-grid">'+fields.map(f=>control(f,record,lookups,editing)).join("")+'</div>';}
export function renderEditor(state){
 const model=models[state.moduleId];
 if(!model||model.readOnly)return "";
 const row=state.editor?.record||null;
 const isLocked=row&&model.locked?.includes(row.status);
 const isNew=!row;
 const title=isNew?"Novo registro":"Editar registro";
 let html='<section class="editor panel"><div class="panel-head"><div><span class="eyebrow">FORMULÁRIO</span><h3>'+title+'</h3></div><button class="close-editor" type="button" data-close-editor aria-label="Fechar">Fechar ×</button></div>'+
  '<form id="record-form"><div class="editor-content">'+fieldsHTML(model.fields,row,state.lookups||{},!!row);
 if(isLocked)html+='<div class="note">Registro com status finalizado: edição bloqueada.</div>';
 html+='</div><div class="form-actions"><button type="button" class="secondary-btn" data-close-editor>Cancelar</button>'+
   (!isLocked?'<button type="submit" class="primary-btn">Salvar registro</button>':"")+'</div></form>';
 if(row&&model.status){
  html+='<div class="status-control"><strong>Situação: '+safe(statusLabels[row.status]||row.status||"Rascunho")+'</strong>';
  if(!isLocked)html+='<div class="status-buttons">'+model.status.allowed.filter(s=>s!==row.status&&s!=="draft"&&s!=="pending").map(s=>
   '<button class="secondary-btn" type="button" data-status="'+safe(s)+'">'+safe(statusLabels[s]||s)+'</button>').join("")+'</div>';
  html+='</div>';
 }
 if(row&&model.line&&state.moduleId==="contagem"){
  html+=renderCountLines(state,isLocked);
 }else if(row&&model.line){
  html+='<div class="editor-lines"><div class="panel-head"><strong>Itens vinculados</strong><small>'+state.lines.length+' registros</small></div>'+
   renderTable(state.lines.map(line=>Object.fromEntries(Object.entries(line).map(([key,value])=>{
     const lookupField=model.line.fields.find(field=>field.key===key && field.type==="lookup");
     return [key,lookupField?(state.lookups?.[lookupField.lookup]||[]).find(item=>item.id===value)?.name||value:value];
   }))),model.line.fields.map(f=>({key:f.key,label:f.label})).concat(model.line.table==="purchase_list_items"?[]:[{key:"line_total",label:"Total",kind:"money"}]))+
   (!isLocked?'<div class="line-actions"><button type="button" class="secondary-btn" data-new-line>+ Adicionar item</button></div>':"");
  if(state.editor?.lineEditor&&!isLocked){
   html+='<form id="line-form" class="line-form"><h4>Novo item</h4>'+fieldsHTML(model.line.fields,null,state.lookups||{},false)+
    '<div class="form-actions"><button class="secondary-btn" type="button" data-cancel-line>Cancelar</button><button class="primary-btn" type="submit">Salvar item</button></div></form>';
  }
  if(!isLocked&&state.lines.length)html+='<div class="line-delete"><label>Remover item pelo ID</label><select id="line-remove-id"><option value="">Selecione o item</option>'+
   state.lines.map(r=>'<option value="'+safe(r.id)+'">'+safe((state.lookups.items||[]).find(i=>i.id===r.item_id)?.name||r.item_id)+'</option>').join("")+
   '</select><button type="button" class="secondary-btn" data-remove-line>Remover</button></div>';
  html+='</div>';
 }
 html+='</section>';
 return html;
}
