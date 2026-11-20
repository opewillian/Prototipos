// Loja · Contagem de estoque.
// Ao abrir, todos os itens liberados para a loja já aparecem como linhas: Quantidade (digitada aqui), uma coluna por
// lista adicionada via "Adicionar via lista" e Total (= soma). counted_quantity guarda o total; parts guarda cada coluna.
// Regras: vazio = não contado (não é gravado); 0 = contado sem estoque; decimais aceitos.
// Custo = última compra recebida na loja; sem compra, custo padrão do item.
// Finalizar gera o ajuste de estoque no banco e bloqueia o documento.
import {list,get,insert,update,remove,nextNumber} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,openDrawer,field,input,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,searchBox,searchKey,kpi,alertBox} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";


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
  '<div class="kpis">'+kpi("Última contagem finalizada",last?dateBR(last.count_date):"—",last?last.display_id:"Nenhuma ainda",{icon:"clipboard"})+
  kpi("Valor do último inventário",last?money(tot(last.id)):"—","",{icon:"cash",tone:"ok"})+
  kpi("Em andamento",drafts.length,drafts.length?"Rascunhos abertos":"",{icon:"edit",tone:drafts.length?"warn":""})+
  kpi("Total de contagens",counts.length,"",{icon:"layers",tone:"info"})+'</div>'+
  '<section class="card">'+(counts.length?dataTable([
   {label:"Contagem",render:c=>'<span class="strong">'+e(c.display_id)+'</span>'+(c.notes?'<small class="sub">'+e(c.notes)+'</small>':'')},
   {label:"Data",render:c=>dateBR(c.count_date)},
   {label:"Itens",cls:"num",render:c=>String(qn(c.id))},
   {label:"Valor",cls:"num",render:c=>money(tot(c.id))},
   {label:"Situação",render:c=>statusPill(c.status)}
  ],counts,{rowHref:c=>ctx.base+"/contagem/"+c.id}).replace('class="table"','class="table stack"')
  :emptyState("clipboard","Nenhuma contagem registrada","Ao iniciar, todos os itens da loja já aparecem para contar.",btn("Nova contagem",{icon:"plus",attrs:"data-new"})))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>newCount(ctx));
}

async function newCount(ctx){
 openDrawer({title:"Nova contagem",submitLabel:"Iniciar contagem",body:'<div class="form-grid">'+
  field("Data da contagem",input("count_date",today(),{type:"date",required:true}))+'<div></div>'+
  '<div class="span-2">'+field("Observações",textarea("notes","",{rows:2,placeholder:"Ex.: contagem mensal, estoque seco"}))+'</div>'+
  '<p class="muted span-2" style="margin:0">Todos os itens liberados para a loja já entram na contagem. Para contar por setor, use "Adicionar via lista".</p></div>',
  onSubmit:async form=>{
   const f=form.elements;if(!f.count_date.value)throw Error("Informe a data.");
   const display_id=await nextNumber("stock_counts","display_id","store_id",ctx.storeId,"CT");
   const c=await insert("stock_counts",{store_id:ctx.storeId,display_id,count_date:f.count_date.value,notes:f.notes.value.trim()||null,status:"draft",created_by:ctx.userId});
   toast("Contagem "+display_id+" iniciada.");ctx.go(ctx.base+"/contagem/"+c.id);
  }});
}

// Quantidades por coluna. Linha antiga (antes das colunas por lista) vira só "Quantidade".
const MANUAL="manual";
const partsOf=l=>{const p=l?.parts&&typeof l.parts==="object"?{...l.parts}:{};if(l&&!Object.keys(p).length&&l.counted_quantity!=null)p[MANUAL]=Number(l.counted_quantity);return p};
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
  if(!editable||key!==MANUAL)return '<td class="num" data-label="'+e(key===MANUAL?"Quantidade":(cols.find(c=>c.id===key)?.name||"Lista"))+'">'+(v==null?'<span class="muted">—</span>':num(v))+'</td>';
  return '<td class="num" data-label="Quantidade"><input class="cell-input" data-qty inputmode="decimal" placeholder="—" value="'+e(v==null?"":inputNum(v))+'" aria-label="Quantidade de '+e(it.name)+'"></td>';
 };
 const rowHTML=it=>{
  const l=byItem.get(it.id),p=partsOf(l);
  return '<tr data-item="'+e(it.id)+'" data-search="'+e(searchKey(it.name,it.code,it.item_type||it.category))+'"'+(l?'':' class="is-pending"')+'>'+
   '<td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td>'+
   '<td data-label="Unid.">'+e(it.base_unit||"")+'</td>'+
   cell(it,MANUAL,p)+cols.map(c=>cell(it,c.id,p)).join("")+
   '<td class="num strong" data-label="Total" data-total>'+(l?num(l.counted_quantity):'<span class="muted">—</span>')+'</td></tr>';
 };
 const draw=()=>{
  const q=ctx.el.querySelector("#q")?.value||"";
  const rows=rowItems();
  ctx.el.innerHTML=backLink(ctx.base+"/contagem","Contagens")+
   '<div class="doc-head"><div><div class="doc-title"><h1>Contagem '+e(count.display_id)+'</h1>'+statusPill(count.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(dateBR(count.count_date))+(count.notes?' · '+e(count.notes):'')+'</p></div>'+
   '<div class="page-actions">'+(editable?btn("Adicionar via lista",{variant:"secondary",icon:"list",attrs:"data-via-list"}):'')+btn("Imprimir",{variant:"secondary",icon:"printer",attrs:"data-print"})+
   (editable?btn("Cancelar contagem",{variant:"ghost",attrs:"data-cancel"})+btn("Finalizar contagem",{variant:"ok",icon:"check",attrs:"data-finalize"}):'')+'</div></div>'+
   '<section class="card">'+
   (rows.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar item na contagem")+(editable?'<span class="muted">Digite a quantidade e tecle Enter para ir ao próximo. Vazio = não contado; 0 = sem estoque. O total soma a quantidade e as listas.</span>':'')+'</div>'+
    '<div class="table-wrap"><table class="table stack"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Quantidade</th>'+
    cols.map(c=>'<th class="num">'+(editable?'<button class="th-btn" data-edit-col="'+e(c.id)+'" title="Editar as quantidades desta lista">'+e(c.name)+' '+icon("edit",13)+'</button>':e(c.name))+'</th>').join("")+
    '<th class="num">Total</th></tr></thead><tbody>'+rows.map(rowHTML).join("")+'</tbody></table></div>'
    :emptyState("clipboard","Nenhum item liberado para a loja","Os itens aparecem aqui quando tiverem a marca da loja ou a marca Global."))+summary()+'</section>';
  bind();
  const qi=ctx.el.querySelector("#q");if(q&&qi){qi.value=q;qi.dispatchEvent(new Event("input"))}
 };
 const refreshRow=itemId=>{
  const tr=ctx.el.querySelector('tr[data-item="'+CSS.escape(itemId)+'"]');if(!tr)return;
  const l=byItem.get(itemId);tr.classList.toggle("is-pending",!l);
  tr.querySelector("[data-total]").innerHTML=l?num(l.counted_quantity):'<span class="muted">—</span>';
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
    body.innerHTML=(ids.length?'<div class="table-wrap"><table class="table stack"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Quantidade</th></tr></thead><tbody>'+
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

 const bind=()=>{
  ctx.el.querySelector("[data-print]").onclick=()=>window.print();
  const q=ctx.el.querySelector("#q");
  q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!!t&&!r.dataset.search.includes(t))});
  if(!editable)return;
  ctx.el.querySelector("[data-via-list]").onclick=()=>viaList();
  ctx.el.querySelectorAll("[data-edit-col]").forEach(b=>b.onclick=()=>viaList(b.dataset.editCol));
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
