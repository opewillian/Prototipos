// Linhas da contagem: carregar listas, digitar quantidades e custos, totais.
// Regra: campo vazio = item NÃO contado (não é gravado); zero = contagem válida.
// O banco exige counted_quantity NOT NULL, por isso itens pendentes vivem só na tela
// até receberem quantidade; cada quantidade digitada é gravada imediatamente.
import {escapeHtml as e,money} from "../../core/format.js";

/** Converte texto pt-BR em número. "" → null (não contado); inválido → NaN. */
export function parseQty(text){
 const t=String(text??"").trim().replace(/\s/g,"").replace(",",".");
 if(t==="")return null;
 if(!/^\d+(\.\d+)?$/.test(t))return NaN;
 return Number(t);
}
/** Número para exibição/edição em pt-BR, sem separador de milhar (evita "1.000" ambíguo). */
export function fmtQty(value,maxDigits=3){
 if(value===null||value===undefined||value==="")return "";
 return new Intl.NumberFormat("pt-BR",{maximumFractionDigits:maxDigits,useGrouping:false}).format(Number(value));
}
export function lineTotal(qty,cost){return Math.round(Number(qty||0)*Number(cost||0)*100)/100}

/** Custo unitário sugerido: última compra recebida da mesma loja; senão, custo padrão do item. */
export function costFor(itemId,lookups={}){
 const last=(lookups.store_last_purchase_cost||[]).find(r=>r.item_id===itemId&&r.unit_cost!==null&&r.unit_cost!==undefined);
 if(last)return {cost:Number(last.unit_cost),source:"Última compra da loja"};
 const item=(lookups.items||[]).find(i=>i.id===itemId);
 return {cost:Number(item?.default_unit_cost||0),source:"Custo padrão do cadastro"};
}

/** Acrescenta à lista de pendentes os itens ausentes (sem duplicar linhas gravadas nem pendentes). */
export function mergePending(lines,pending,itemIds){
 const present=new Set(lines.map(l=>l.item_id).concat(pending.map(p=>p.item_id)));
 const added=[];
 for(const id of itemIds){if(id&&!present.has(id)){present.add(id);added.push({item_id:id})}}
 return {pending:pending.concat(added),added:added.length,skipped:itemIds.length-added.length};
}

/** Resumo da contagem: itens contados, pendentes e valor total. */
export function countSummary(lines,pending){
 return {counted:lines.length,pending:pending.length,total:Math.round(lines.reduce((s,l)=>s+Number(l.line_total||0),0)*100)/100};
}

function itemOf(id,lookups){return (lookups.items||[]).find(i=>i.id===id)||{}}

function summaryHTML(lines,pending){
 const s=countSummary(lines,pending);
 return '<div class="count-summary" data-count-summary><div><small>Itens contados</small><strong>'+s.counted+'</strong></div>'+
  '<div><small>Sem contagem</small><strong'+(s.pending?' class="is-pending"':'')+'>'+s.pending+'</strong></div>'+
  '<div><small>Valor do estoque contado</small><strong>'+e(money(s.total))+'</strong></div></div>';
}

export function renderCountLines(state,locked){
 const lookups=state.lookups||{},lines=state.lines||[],pending=state.editor?.pending||[];
 const lists=(lookups.purchase_lists||[]).filter(l=>l.active!==false&&l.list_type!=="order");
 const rows=lines.map(l=>({key:"line:"+l.id,item_id:l.item_id,qty:l.counted_quantity,cost:l.unit_cost,total:l.line_total,saved:true}))
  .concat(pending.map(p=>{const c=costFor(p.item_id,lookups);return {key:"pending:"+p.item_id,item_id:p.item_id,qty:null,cost:c.cost,total:null,saved:false,source:c.source}}))
  .map(r=>({...r,item:itemOf(r.item_id,lookups)}))
  .sort((a,b)=>String(a.item.name||"").localeCompare(String(b.item.name||""),"pt-BR"));
 let html='<div class="editor-lines count-lines"><div class="panel-head"><strong>Itens da contagem</strong><small>Vazio = não contado · 0 = contado sem estoque</small></div>';
 html+=summaryHTML(lines,pending);
 if(!locked){
  const activeItems=(lookups.items||[]).filter(i=>i.active!==false);
  html+='<div class="count-tools">'+
   '<label class="form-field">Carregar lista<span class="count-inline"><select id="count-list"><option value="">'+(lists.length?"Selecione a lista":"Nenhuma lista de contagem nesta loja")+'</option>'+
   lists.map(l=>'<option value="'+e(l.id)+'">'+e(l.name)+'</option>').join("")+'</select><button type="button" class="secondary-btn" data-load-list'+(lists.length?"":" disabled")+'>Adicionar itens</button></span></label>'+
   '<label class="form-field">Incluir item avulso<span class="count-inline"><select id="count-item"><option value="">Selecione o item</option>'+
   activeItems.map(i=>'<option value="'+e(i.id)+'">'+e(i.name)+(i.code?' · '+e(i.code):'')+'</option>').join("")+'</select><button type="button" class="secondary-btn" data-add-item>Incluir</button></span></label>'+
   '<label class="form-field">Buscar na contagem<input id="count-search" type="search" placeholder="Nome ou código" autocomplete="off"></label></div>';
 }
 if(!rows.length){
  html+='<div class="empty"><strong>Nenhum item na contagem</strong><p>'+(locked?"Esta contagem não possui itens.":"Carregue uma lista da loja ou inclua itens avulsos.")+'</p></div></div>';
  return html;
 }
 html+='<div class="table-scroll"><table class="count-table"><thead><tr><th>Item</th><th>Unid.</th><th>Quantidade</th><th>Custo unitário</th><th>Total</th>'+(locked?'':'<th aria-label="Remover"></th>')+'</tr></thead><tbody>';
 for(const r of rows){
  const name=e(r.item.name||r.item_id),code=r.item.code?'<small>'+e(r.item.code)+'</small>':'';
  const search=e(((r.item.name||"")+" "+(r.item.code||"")).toLowerCase());
  if(locked){
   html+='<tr><td>'+name+code+'</td><td>'+e(r.item.base_unit||"")+'</td><td>'+e(fmtQty(r.qty))+'</td><td>'+e(money(r.cost))+'</td><td>'+e(money(r.total))+'</td></tr>';
   continue;
  }
  html+='<tr data-row="'+e(r.key)+'" data-item="'+e(r.item_id)+'" data-search="'+search+'"'+(r.saved?'':' class="is-pending"')+'>'+
   '<td>'+name+code+'</td><td>'+e(r.item.base_unit||"")+'</td>'+
   '<td><input class="count-input" data-qty inputmode="decimal" autocomplete="off" aria-label="Quantidade de '+name+'" placeholder="Não contado" value="'+e(fmtQty(r.qty))+'"></td>'+
   '<td><input class="count-input" data-cost inputmode="decimal" autocomplete="off" aria-label="Custo unitário de '+name+'" value="'+e(fmtQty(r.cost,4))+'"'+(r.source?' title="'+e(r.source)+'"':'')+'></td>'+
   '<td data-total>'+(r.saved?e(money(r.total)):'—')+'</td>'+
   '<td><button type="button" class="row-remove" data-remove-row aria-label="Remover '+name+'">×</button></td></tr>';
 }
 html+='</tbody></table></div>';
 if(!locked&&pending.length)html+='<div class="note">Itens "Não contado" não são gravados e não entram na finalização. Digite 0 para registrar estoque zerado.</div>';
 return html+'</div>';
}
export {summaryHTML};
