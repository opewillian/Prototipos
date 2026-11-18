import {escapeHtml,displayValue} from "../core/format.js";
import {statusLabels,models} from "../core/models.js";
export function renderTable(rows,columns){
 if(!rows?.length)return '<div class="empty"><div class="empty-icon">▤</div><strong>Nenhum registro disponível</strong><p>Crie um registro ou verifique o acesso à unidade.</p></div>';
 const head=columns.map(c=>'<th>'+escapeHtml(c.label)+'</th>').join("");
 const body=rows.map(row=>'<tr>'+columns.map(col=>{
  const raw=row[col.key];const value=col.kind==="status"?(statusLabels[raw]||raw):displayValue(raw,col.kind);
  return '<td>'+(col.kind==="status"?'<span class="status-pill">'+escapeHtml(value)+'</span>':escapeHtml(value))+'</td>';
 }).join("")+'</tr>').join("");
 return '<div class="table-scroll"><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
export function renderList(descriptor,rows,_mode,canEdit=false){
 const editable=canEdit&&!!models[descriptor.id]&&!models[descriptor.id].readOnly;
 return '<div class="section-head"><div><span class="eyebrow">MÓDULO / '+escapeHtml(descriptor.label.toUpperCase())+
 '</span><h2>'+escapeHtml(descriptor.title)+'</h2><p>'+escapeHtml(descriptor.description)+'</p></div>'+
 '<div class="list-tools"><span class="number-chip">'+rows.length+' registros</span>'+
 (editable?'<button type="button" class="primary-btn" data-new-record>+ Novo registro</button>':"")+'</div></div>'+
 '<section class="panel"><div class="panel-head"><strong>Registros'+(rows.length?" · selecione para editar":"")+'</strong><small>'+
 "Supabase · Dados autorizados"+'</small></div>'+
 (rows.length?'<div class="table-scroll"><table><thead><tr>'+descriptor.columns.map(c=>'<th>'+escapeHtml(c.label)+'</th>').join("")+
 '<th>Ação</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+descriptor.columns.map(c=>{
  const raw=r[c.key],text=c.kind==="status"?(statusLabels[raw]||raw):displayValue(raw,c.kind);
  return '<td>'+escapeHtml(text)+'</td>';
 }).join("")+'<td>'+(editable?'<button type="button" class="table-edit" data-edit-record="'+escapeHtml(r.id)+'">Abrir</button>':"—")+'</td></tr>').join("")+
 '</tbody></table></div>':renderTable([],descriptor.columns))+'</section>'+(!canEdit&&!!models[descriptor.id]&&!models[descriptor.id].readOnly?'<div class="note">Gravações ainda não liberadas para esta unidade.</div>':"");
}
