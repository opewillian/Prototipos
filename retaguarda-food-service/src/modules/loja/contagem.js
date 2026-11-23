// Loja · Contagem de estoque.
// Ao abrir, todos os itens liberados para a loja já aparecem como linhas: Quantidade (digitada aqui), uma coluna por
// lista adicionada via "Adicionar via lista" e Total (= soma). counted_quantity guarda o total; parts guarda cada coluna.
// Regras: vazio = não contado (não é gravado); 0 = contado sem estoque; decimais aceitos.
// Custo = última compra recebida na loja; sem compra, custo padrão do item.
// Finalizar gera o ajuste de estoque no banco e bloqueia o documento.
import {list,get,insert,update,remove,nextNumber} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,field,input,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,searchBox,searchKey,kpi,alertBox} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";
import {filterBar,bindFilters} from "../../core/filters.js";


export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [counts,lines]=await Promise.all([
  list("stock_counts",{eq:{store_id:ctx.storeId},order:"count_date",order2:"created_at"}),
  list("stock_count_items",{select:"count_id,line_total",eq:{store_id:ctx.storeId}})
 ]);
 if(!ctx.isCurrent())return;
 const tot=id=>round2(lines.filter(l=>l.count_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const qn=id=>lines.filter(l=>l.count_id===id).length;
 const last=counts.find(c=>c.status==="finalized");const drafts=counts.filter(c=>c.status==="draft");
 ctx.el.innerHTML=pageHead("Contagem de estoque","Inventários da loja. A contagem finalizada atualiza o estoque.",btn("Nova contagem",{icon:"plus",attrs:"data-new"}))+
  filterBar({search:"Número ou observação",dates:true,noun:["contagem","contagens"],selects:[{key:"st",all:"Todas as situações",options:[["draft","Rascunho"],["finalized","Finalizada"],["cancelled","Cancelada"]]}]})+
  '<section class="card">'+(counts.length?dataTable([
   {label:"Contagem",render:c=>'<span class="strong">'+e(c.display_id)+'</span>'+(c.notes?'<small class="sub">'+e(c.notes)+'</small>':'')},
   {label:"Data",render:c=>dateBR(c.count_date)},
   {label:"Itens",cls:"num",render:c=>String(qn(c.id))},
   {label:"Valor",cls:"num",render:c=>money(tot(c.id))},
   {label:"Situação",render:c=>statusPill(c.status)}
  ],counts,{rowHref:c=>ctx.base+"/contagem/"+c.id,rowAttrs:c=>'data-search="'+e(searchKey(c.display_id,c.notes||""))+'" data-st="'+e(c.status)+'" data-date="'+e(String(c.count_date).slice(0,10))+'" data-total="'+tot(c.id)+'"'}).replace('class="table"','class="table stack"')
  :emptyState("clipboard","Nenhuma contagem registrada","Ao iniciar, todos os itens da loja já aparecem para contar.",btn("Nova contagem",{icon:"plus",attrs:"data-new"})))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>newCount(ctx));
 bindFilters(ctx.el,{noun:["contagem","contagens"]});
}

// "Nova contagem" cria o rascunho na hora (data de hoje) e abre a contagem; data e observações se ajustam lá dentro.
let creating=false;
async function newCount(ctx){
 if(creating)return;creating=true;
 try{
  const display_id=await nextNumber("stock_counts","display_id","store_id",ctx.storeId,"CT");
  const c=await insert("stock_counts",{store_id:ctx.storeId,display_id,count_date:today(),status:"draft",created_by:ctx.userId});
  toast("Contagem "+display_id+" iniciada.");ctx.go(ctx.base+"/contagem/"+c.id);
 }catch(error){toast(errorMessage(error),"danger")}
 finally{creating=false}
}

// Quantidades por coluna. Linha antiga (antes das colunas por lista) vira só "Quantidade".
const MANUAL="manual";
const partsOf=l=>{const p=l?.parts&&typeof l.parts==="object"?{...l.parts}:{};if(l&&!Object.keys(p).length&&l.counted_quantity!=null)p[MANUAL]=Number(l.counted_quantity);return p};
// Valor unitário com até 4 casas (custos de sachê, copo etc.).
const unitBRL=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:4});
const mu=v=>unitBRL.format(Number(v||0));
const sumParts=p=>round2(Object.values(p).reduce((s,v)=>s+Number(v||0),0));

async function detail(ctx,id){
 const [count,lines,items,lastCosts,lists]=await Promise.all([
  get("stock_counts",id),list("stock_count_items",{eq:{count_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),
  list("purchase_lists",{eq:{store_id:ctx.storeId,active:true},order:"name",asc:true})
 ]);
 if(!ctx.isCurrent())return;
 if(count.store_id!==ctx.storeId)throw Error("Esta contagem pertence a outra loja.");
 const map=byId(items);const editable=count.status==="draft";
 const byItem=new Map(lines.map(l=>[l.item_id,l]));
 let cols=Array.isArray(count.list_columns)?count.list_columns.slice():[];
 // Linhas: todos os itens liberados para a loja + itens já contados (mesmo que hoje estejam fora da loja).
 const rowItems=()=>{
  const ids=new Set(items.filter(i=>i.active!==false).map(i=>i.id));for(const l of byItem.values())ids.add(l.item_id);
  return [...ids].map(i=>map.get(i)||{id:i,name:"Item removido"}).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
 };
 const costOf=itemId=>{const l=byItem.get(itemId);return l&&l.id?Number(l.unit_cost||0):unitCost(itemId,lastCosts,map).cost};
 const counted=()=>[...byItem.values()];
 const summary=()=>{
  const all=rowItems().length,n=counted().length;
  const total=round2(counted().reduce((s,l)=>s+Number(l.line_total||0),0));
  return '<div class="summary-strip" data-summary><div><small>Itens contados</small><strong>'+n+'</strong></div>'+
   (editable?'<div><small>Sem contagem</small><strong class="'+(all-n?"text-warn":"")+'">'+(all-n)+'</strong></div>':'')+
   '<div class="hl"><small>Valor do estoque contado</small><strong>'+money(total)+'</strong></div></div>';
 };
 const cell=(it,key,p)=>{
  const v=p[key];
  if(!editable||key!==MANUAL)return '<td class="num" data-label="'+e(key===MANUAL?"Padrão":(cols.find(c=>c.id===key)?.name||"Lista"))+'">'+(v==null?'<span class="muted">—</span>':num(v))+'</td>';
  return '<td class="num" data-label="Padrão"><input class="cell-input" data-qty inputmode="decimal" placeholder="—" value="'+e(v==null?"":inputNum(v))+'" aria-label="Quantidade de '+e(it.name)+'"></td>';
 };
 const rowHTML=it=>{
  const l=byItem.get(it.id),p=partsOf(l);
  return '<tr data-item="'+e(it.id)+'" data-search="'+e(searchKey(it.name,it.code,it.item_type||it.category))+'"'+(l?'':' class="is-pending"')+'>'+
   '<td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td>'+
   '<td data-label="Unid.">'+e(it.base_unit||"")+'</td>'+
   '<td class="num strong" data-label="Total" data-total>'+(l?num(l.counted_quantity):'<span class="muted">—</span>')+'</td>'+
   cell(it,MANUAL,p)+cols.map(c=>cell(it,c.id,p)).join("")+
   // Valor unitário = custo da linha (ou o custo que será usado, em cinza, se ainda não contado); valor total = qtd × custo.
   '<td class="num" data-label="Valor unit." data-unit>'+(l?mu(l.unit_cost):'<span class="muted">'+mu(costOf(it.id))+'</span>')+'</td>'+
   '<td class="num strong" data-label="Valor total" data-vtotal>'+(l?money(l.line_total):'<span class="muted">—</span>')+'</td></tr>';
 };
 const draw=()=>{
  const q=ctx.el.querySelector("#q")?.value||"";
  const rows=rowItems();
  ctx.el.innerHTML=backLink(ctx.base+"/contagem","Contagens")+
   '<div class="doc-head"><div><div class="doc-title"><h1>Contagem '+e(count.display_id)+'</h1>'+statusPill(count.status)+'</div>'+(editable?'':'<p class="muted" style="margin:6px 0 0">'+e(dateBR(count.count_date))+(count.notes?' · '+e(count.notes):'')+'</p>')+'</div>'+
   '<div class="page-actions">'+(editable?btn("Adicionar via lista",{variant:"secondary",icon:"list",attrs:"data-via-list"}):'')+
   (editable?btn("Cancelar contagem",{variant:"ghost",attrs:"data-cancel"})+btn("Finalizar contagem",{variant:"ok",icon:"check",attrs:"data-finalize"}):'')+'</div></div>'+
   (editable?'<section class="card"><div class="card-body"><div class="form-grid count-head">'+
    field("Data da contagem",input("count_date",count.count_date,{type:"date",required:true,attrs:"data-head"}))+
    field("Observações",input("notes",count.notes||"",{placeholder:"Ex.: contagem mensal, estoque seco",attrs:"data-head"}))+'</div></div></section>':'')+
   '<section class="card">'+
   (rows.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar item na contagem")+(editable?'<span class="muted">Digite a quantidade e tecle Enter para ir ao próximo. Vazio = não contado; 0 = sem estoque. O total soma a coluna Padrão e as listas.</span>':'')+'</div>'+
    '<div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Total</th><th class="num">Padrão</th>'+
    cols.map(c=>'<th class="num">'+(editable?'<span class="th-col"><button class="th-btn" data-edit-col="'+e(c.id)+'" title="Editar as quantidades desta lista">'+e(c.name)+' '+icon("edit",13)+'</button><button class="th-x" data-remove-col="'+e(c.id)+'" title="Remover a lista da contagem" aria-label="Remover a lista '+e(c.name)+' da contagem">'+icon("x",13)+'</button></span>':e(c.name))+'</th>').join("")+
    '<th class="num">Valor unit.</th><th class="num">Valor total</th></tr></thead><tbody>'+rows.map(rowHTML).join("")+'</tbody></table></div>'
    :emptyState("clipboard","Nenhum item liberado para a loja","Os itens aparecem aqui quando tiverem a marca da loja ou a marca Global."))+summary()+'</section>';
  bind();
  const qi=ctx.el.querySelector("#q");if(q&&qi){qi.value=q;qi.dispatchEvent(new Event("input"))}
 };
 const refreshRow=itemId=>{
  const tr=ctx.el.querySelector('tr[data-item="'+CSS.escape(itemId)+'"]');if(!tr)return;
  const l=byItem.get(itemId);tr.classList.toggle("is-pending",!l);
  tr.querySelector("[data-total]").innerHTML=l?num(l.counted_quantity):'<span class="muted">—</span>';
  tr.querySelector("[data-unit]").innerHTML=l?mu(l.unit_cost):'<span class="muted">'+mu(costOf(itemId))+'</span>';
  tr.querySelector("[data-vtotal]").innerHTML=l?money(l.line_total):'<span class="muted">—</span>';
  const s=ctx.el.querySelector("[data-summary]");if(s)s.outerHTML=summary();
 };
 /** Grava as quantidades de um item (parts) e recalcula total e valor. Tudo vazio = item volta a "não contado". */
 const persist=async(itemId,p)=>{
  for(const k of Object.keys(p))if(p[k]==null)delete p[k];
  const l=byItem.get(itemId);
  if(!Object.keys(p).length){if(l){await remove("stock_count_items",l.id);byItem.delete(itemId)}return}
  const qty=sumParts(p),cost=costOf(itemId);
  const payload={parts:p,counted_quantity:qty,unit_cost:cost,line_total:lineTotal(qty,cost)};
  byItem.set(itemId,l?await update("stock_count_items",l.id,payload):await insert("stock_count_items",{...payload,count_id:id,store_id:ctx.storeId,item_id:itemId}));
 };
 const saveManual=async inp=>{
  const tr=inp.closest("tr"),itemId=tr.dataset.item,qty=parseNum(inp.value);
  inp.classList.toggle("is-invalid",Number.isNaN(qty));
  if(Number.isNaN(qty))return toast("Use números não negativos (vírgula para decimais).","danger");
  const p=partsOf(byItem.get(itemId));
  if((p[MANUAL]??null)===qty)return;
  p[MANUAL]=qty;
  tr.classList.add("is-saving");
  try{await persist(itemId,p);inp.value=qty==null?"":inputNum(qty);refreshRow(itemId)}
  catch(error){toast(errorMessage(error),"danger")}
  finally{tr.classList.remove("is-saving")}
 };

 // ---- Janela "Adicionar via lista": escolhe a lista, digita as quantidades e salva como uma coluna nova.
 const viaList=(presetId=null)=>{
  const wrap=document.createElement("div");wrap.className="overlay overlay-modal";
  wrap.innerHTML='<div class="dialog dialog-wide dialog-count" role="dialog" aria-modal="true" aria-labelledby="vl-title">'+
   '<div class="dialog-head"><h2 id="vl-title">Adicionar via lista</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">'+icon("x")+'</button></div>'+
   '<div style="padding:14px 20px 4px">'+field("Lista",'<select class="control" data-list><option value="">'+(lists.length?"Selecione a lista":"Nenhuma lista cadastrada")+'</option>'+lists.map(l=>'<option value="'+e(l.id)+'"'+(l.id===presetId?" selected":"")+'>'+e(l.name)+(cols.some(c=>c.id===l.id)?" (já adicionada)":"")+'</option>').join("")+'</select>')+'</div>'+
   '<div class="dialog-body" data-vl-body><p class="muted" style="padding:10px 20px">Selecione uma lista para digitar as quantidades.</p></div>'+
   '<div class="dialog-actions" style="padding:12px 20px;margin:0;border-top:1px solid var(--line-2)">'+btn("Cancelar",{variant:"ghost",attrs:"data-close"})+btn("Salvar",{icon:"check",attrs:"data-save"})+'</div></div>';
  const close=()=>{wrap.remove();document.removeEventListener("keydown",onKey)};
  const onKey=ev=>{if(ev.key==="Escape")close()};
  wrap.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);
  wrap.addEventListener("mousedown",ev=>{if(ev.target===wrap)close()});
  document.addEventListener("keydown",onKey);document.body.appendChild(wrap);
  const sel=wrap.querySelector("[data-list]"),body=wrap.querySelector("[data-vl-body]");
  let ids=[],skipped=0;
  const load=async()=>{
   const lid=sel.value;ids=[];
   if(!lid){body.innerHTML='<p class="muted" style="padding:10px 20px">Selecione uma lista para digitar as quantidades.</p>';return}
   body.innerHTML='<p class="muted" style="padding:10px 20px">Carregando itens…</p>';
   try{
    const all=(await list("purchase_list_items",{select:"item_id,sort_order",eq:{list_id:lid},order:"sort_order",asc:true})).map(r=>r.item_id);
    if(sel.value!==lid)return;
    ids=all.filter(x=>map.get(x)&&map.get(x).active!==false);skipped=all.length-ids.length;
    body.innerHTML=(ids.length?'<div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Quantidade</th></tr></thead><tbody>'+
     ids.map(x=>{const it=map.get(x),v=partsOf(byItem.get(x))[lid];return '<tr data-vl="'+e(x)+'"><td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td><td data-label="Unid.">'+e(it.base_unit||"")+'</td><td class="num" data-label="Quantidade"><input class="cell-input" data-vq inputmode="decimal" placeholder="—" value="'+e(v==null?"":inputNum(v))+'" aria-label="Quantidade de '+e(it.name)+'"></td></tr>'}).join("")+
     '</tbody></table></div>':'<p class="muted" style="padding:10px 20px">Esta lista não tem itens liberados para a loja.</p>')+
     (skipped?'<p class="muted" style="padding:8px 20px 0;font-size:12.5px">'+skipped+' item(ns) da lista não estão liberados para esta loja e ficaram de fora.</p>':'');
    const inputs=[...body.querySelectorAll("[data-vq]")];
    inputs.forEach((inp,i)=>{inp.addEventListener("focus",()=>inp.select());inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();(inputs[i+1]||wrap.querySelector("[data-save]")).focus()}})});
    inputs[0]?.focus();
   }catch(error){body.innerHTML=alertBox(errorMessage(error))}
  };
  sel.onchange=load;if(presetId)load();else sel.focus();
  wrap.querySelector("[data-save]").onclick=async()=>{
   const lid=sel.value;if(!lid)return toast("Selecione uma lista.","info");
   const vals=new Map();let bad=false;
   body.querySelectorAll("tr[data-vl]").forEach(tr=>{const inp=tr.querySelector("[data-vq]"),v=parseNum(inp.value);inp.classList.toggle("is-invalid",Number.isNaN(v));if(Number.isNaN(v))bad=true;else vals.set(tr.dataset.vl,v)});
   if(bad)return toast("Use números não negativos (vírgula para decimais).","danger");
   const btnSave=wrap.querySelector("[data-save]");btnSave.disabled=true;
   try{
    const touched=new Set([...vals.keys()]);for(const l of byItem.values())if(partsOf(l)[lid]!=null)touched.add(l.item_id);
    for(const itemId of touched){
     const p=partsOf(byItem.get(itemId)),v=vals.has(itemId)?vals.get(itemId):null;
     if((p[lid]??null)===v)continue;
     p[lid]=v;await persist(itemId,p);
    }
    const has=[...byItem.values()].some(l=>partsOf(l)[lid]!=null);
    const name=lists.find(l=>l.id===lid)?.name||"Lista";
    const next=has?(cols.some(c=>c.id===lid)?cols.map(c=>c.id===lid?{...c,name}:c):cols.concat([{id:lid,name}])):cols.filter(c=>c.id!==lid);
    if(JSON.stringify(next)!==JSON.stringify(cols)){await update("stock_counts",id,{list_columns:next},{status:"draft"});cols=next}
    close();toast(has?"Quantidades da lista \""+name+"\" salvas.":"Lista \""+name+"\" retirada da contagem.");draw();
   }catch(error){toast(errorMessage(error),"danger");draw()}
   finally{btnSave.disabled=false}
  };
 };

 /** Tira a coluna da lista: apaga as quantidades dela em todos os itens (o total é recalculado) e some a coluna. */
 const removeCol=async lid=>{
  const col=cols.find(c=>c.id===lid);if(!col)return;
  const affected=[...byItem.values()].filter(l=>partsOf(l)[lid]!=null);
  if(!await confirmDialog({title:"Remover a lista \""+col.name+"\"?",text:"As quantidades desta lista saem da contagem"+(affected.length?" ("+affected.length+" item(ns))":"")+" e o total de cada item é recalculado. A lista em si não é apagada.",confirmLabel:"Remover lista",danger:true}))return;
  try{
   for(const l of affected){const p=partsOf(l);p[lid]=null;await persist(l.item_id,p)}
   const next=cols.filter(c=>c.id!==lid);
   await update("stock_counts",id,{list_columns:next},{status:"draft"});cols=next;
   toast("Lista \""+col.name+"\" removida da contagem.");
  }catch(error){toast(errorMessage(error),"danger")}
  draw();
 };

 const bind=()=>{
  // Data e observações gravam sozinhas ao sair do campo.
  ctx.el.querySelectorAll("[data-head]").forEach(el=>el.addEventListener("change",async()=>{
   const patch=el.name==="count_date"?{count_date:el.value}:{notes:el.value.trim()||null};
   if(el.name==="count_date"&&!el.value){el.value=count.count_date;return toast("Informe a data.","danger")}
   try{Object.assign(count,await update("stock_counts",id,patch,{status:"draft"}));toast(el.name==="count_date"?"Data atualizada.":"Observações salvas.")}
   catch(error){toast(errorMessage(error),"danger")}
  }));
  const q=ctx.el.querySelector("#q");
  q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!!t&&!r.dataset.search.includes(t))});
  if(!editable)return;
  ctx.el.querySelector("[data-via-list]").onclick=()=>viaList();
  ctx.el.querySelectorAll("[data-edit-col]").forEach(b=>b.onclick=()=>viaList(b.dataset.editCol));
  ctx.el.querySelectorAll("[data-remove-col]").forEach(b=>b.onclick=()=>removeCol(b.dataset.removeCol));
  ctx.el.querySelectorAll("tr[data-item] [data-qty]").forEach(inp=>{
   inp.addEventListener("change",()=>saveManual(inp));
   inp.addEventListener("focus",()=>inp.select());
   inp.addEventListener("keydown",ev=>{
    if(ev.key!=="Enter")return;ev.preventDefault();
    const all=[...ctx.el.querySelectorAll("tr[data-item]:not([hidden]) [data-qty]")];
    const next=all[all.indexOf(inp)+1];
    inp.blur();if(next)next.focus();
   });
  });
  ctx.el.querySelector("[data-finalize]").onclick=async()=>{
   if(document.activeElement?.matches?.("[data-qty]"))document.activeElement.blur();
   await new Promise(r=>setTimeout(r,300));
   if(!byItem.size)return toast("Conte ao menos um item antes de finalizar.","danger");
   const missing=rowItems().length-byItem.size;
   const text=(missing?missing+" item(ns) sem contagem não entrarão no inventário. ":"")+"Após finalizar, o estoque da loja será ajustado e a contagem não poderá mais ser alterada.";
   if(!await confirmDialog({title:"Finalizar contagem "+count.display_id+"?",text,confirmLabel:"Finalizar"}))return;
   try{await update("stock_counts",id,{status:"finalized",finalized_at:new Date().toISOString()},{status:"draft"});toast("Contagem finalizada e estoque atualizado.");ctx.reload()}
   catch(error){toast(errorMessage(error),"danger")}
  };
  ctx.el.querySelector("[data-cancel]").onclick=async()=>{
   if(!await confirmDialog({title:"Cancelar contagem?",text:"A contagem ficará registrada como cancelada e não afetará o estoque.",confirmLabel:"Cancelar contagem",danger:true}))return;
   try{await update("stock_counts",id,{status:"cancelled"},{status:"draft"});toast("Contagem cancelada.");ctx.reload()}
   catch(error){toast(errorMessage(error),"danger")}
  };
 };
 draw();
}
