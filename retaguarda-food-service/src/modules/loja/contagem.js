// Loja · Contagem de estoque.
// Regras: vazio = não contado (não é gravado); 0 = contado sem estoque; decimais aceitos.
// Custo = última compra recebida na loja; sem compra, custo padrão do item.
// Finalizar gera o ajuste de estoque no banco e bloqueia o documento.
import {list,get,insert,update,remove,nextNumber} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,openDrawer,field,input,select,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,searchBox,searchKey,kpi} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";

const pendingKey=id=>"rfs-count-pending:"+id;
function readPending(id){try{return JSON.parse(sessionStorage.getItem(pendingKey(id))||"[]")}catch{return []}}
function writePending(id,ids){try{sessionStorage.setItem(pendingKey(id),JSON.stringify(ids))}catch{}}

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
  :emptyState("clipboard","Nenhuma contagem registrada","Comece uma contagem a partir de uma lista da loja.",btn("Nova contagem",{icon:"plus",attrs:"data-new"})))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>newCount(ctx));
}

async function newCount(ctx){
 const lists=(await list("purchase_lists",{eq:{store_id:ctx.storeId,active:true},order:"name",asc:true})).filter(l=>l.list_type!=="order");
 openDrawer({title:"Nova contagem",submitLabel:"Iniciar contagem",body:'<div class="form-grid">'+
  field("Data da contagem",input("count_date",today(),{type:"date",required:true}))+
  field("Lista de itens",select("list_id",lists.map(l=>[l.id,l.name]),"",{placeholder:lists.length?"Sem lista (incluir itens depois)":"Nenhuma lista cadastrada"}))+
  '<div class="span-2">'+field("Observações",textarea("notes","",{rows:2,placeholder:"Ex.: contagem mensal, estoque seco"}))+'</div></div>',
  onSubmit:async form=>{
   const f=form.elements;if(!f.count_date.value)throw Error("Informe a data.");
   const display_id=await nextNumber("stock_counts","display_id","store_id",ctx.storeId,"CT");
   const c=await insert("stock_counts",{store_id:ctx.storeId,display_id,count_date:f.count_date.value,notes:f.notes.value.trim()||null,status:"draft",created_by:ctx.userId});
   if(f.list_id.value){
    const ids=(await list("purchase_list_items",{select:"item_id,sort_order",eq:{list_id:f.list_id.value},order:"sort_order",asc:true})).map(r=>r.item_id);
    writePending(c.id,ids);
   }
   toast("Contagem "+display_id+" iniciada.");ctx.go(ctx.base+"/contagem/"+c.id);
  }});
}

async function detail(ctx,id){
 const [count,lines,items,lastCosts,lists]=await Promise.all([
  get("stock_counts",id),list("stock_count_items",{eq:{count_id:id}}),loadItems(),loadLastCosts(ctx.storeId),
  list("purchase_lists",{eq:{store_id:ctx.storeId,active:true},order:"name",asc:true})
 ]);
 if(!ctx.isCurrent())return;
 if(count.store_id!==ctx.storeId)throw Error("Esta contagem pertence a outra loja.");
 const map=byId(items);const editable=count.status==="draft";
 let state={lines,pending:editable?readPending(id).filter(x=>!lines.some(l=>l.item_id===x)):[]};
 const save=()=>writePending(id,state.pending);

 const rowHTML=r=>{
  const it=map.get(r.item_id)||{name:"Item"};const saved=!!r.id;
  const c=saved?{cost:r.unit_cost}:unitCost(r.item_id,lastCosts,map);
  const key=searchKey(it.name,it.code,it.category);
  if(!editable)return '<tr><td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td><td data-label="Unid.">'+e(it.base_unit||"")+'</td><td class="num" data-label="Quantidade">'+num(r.counted_quantity)+'</td><td class="num" data-label="Custo">'+money(r.unit_cost)+'</td><td class="num" data-label="Total">'+money(r.line_total)+'</td></tr>';
  return '<tr data-row="'+(saved?"line:"+e(r.id):"pending:"+e(r.item_id))+'" data-search="'+e(key)+'"'+(saved?'':' class="is-pending"')+'>'+
   '<td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+(it.category?' · '+e(it.category):'')+'</small></td>'+
   '<td data-label="Unid.">'+e(it.base_unit||"")+'</td>'+
   '<td class="num" data-label="Quantidade"><input class="cell-input" data-qty inputmode="decimal" placeholder="Não contado" value="'+e(saved?inputNum(r.counted_quantity):"")+'" aria-label="Quantidade de '+e(it.name)+'"></td>'+
   '<td class="num" data-label="Custo unit."><input class="cell-input" data-cost inputmode="decimal" value="'+e(inputNum(c.cost,4))+'" title="'+e(saved?"Custo gravado":c.source)+'" aria-label="Custo de '+e(it.name)+'"></td>'+
   '<td class="num" data-label="Total" data-total>'+(saved?money(r.line_total):'<span class="muted">—</span>')+'</td>'+
   '<td class="act"><button class="icon-btn danger" data-remove aria-label="Remover">'+icon("x",16)+'</button></td></tr>';
 };
 const allRows=()=>state.lines.map(l=>l).concat(state.pending.map(item_id=>({item_id})))
  .sort((a,b)=>String(map.get(a.item_id)?.name||"").localeCompare(String(map.get(b.item_id)?.name||""),"pt-BR"));
 const summary=()=>{
  const total=round2(state.lines.reduce((s,l)=>s+Number(l.line_total||0),0));
  return '<div class="summary-strip" data-summary><div><small>Itens contados</small><strong>'+state.lines.length+'</strong></div>'+
   (editable?'<div><small>Sem contagem</small><strong class="'+(state.pending.length?"text-warn":"")+'">'+state.pending.length+'</strong></div>':'')+
   '<div class="hl"><small>Valor do estoque contado</small><strong>'+money(total)+'</strong></div></div>';
 };
 const draw=()=>{
  const rows=allRows();
  const activeItems=items.filter(i=>i.active!==false&&!state.lines.some(l=>l.item_id===i.id)&&!state.pending.includes(i.id));
  ctx.el.innerHTML=backLink(ctx.base+"/contagem","Contagens")+
   '<div class="doc-head"><div><div class="doc-title"><h1>Contagem '+e(count.display_id)+'</h1>'+statusPill(count.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(dateBR(count.count_date))+(count.notes?' · '+e(count.notes):'')+'</p></div>'+
   '<div class="page-actions">'+btn("Imprimir",{variant:"secondary",icon:"printer",attrs:"data-print"})+
   (editable?btn("Cancelar contagem",{variant:"ghost",attrs:"data-cancel"})+btn("Finalizar contagem",{variant:"ok",icon:"check",attrs:"data-finalize"}):'')+'</div></div>'+
   (editable&&!rows.length?'':'')+
   '<section class="card">'+(editable?'<div class="add-row">'+
    field("Carregar itens de uma lista",'<select class="control" id="load-list"><option value="">'+(lists.length?"Selecione a lista":"Nenhuma lista cadastrada")+'</option>'+lists.filter(l=>l.list_type!=="order").map(l=>'<option value="'+e(l.id)+'">'+e(l.name)+'</option>').join("")+'</select>')+
    btn("Carregar",{variant:"secondary",attrs:"data-load"})+
    field("Incluir item avulso",'<input class="control" id="add-item" list="dl-count" placeholder="Nome ou código" autocomplete="off"><datalist id="dl-count">'+activeItems.map(i=>'<option value="'+e(i.name+(i.code?" · "+i.code:""))+'">').join("")+'</datalist>')+
    btn("Incluir",{variant:"secondary",icon:"plus",attrs:"data-add"})+'</div>':'')+
   (rows.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar item na contagem")+(editable?'<span class="muted">Digite a quantidade e tecle Enter para ir ao próximo. Vazio = não contado; 0 = sem estoque.</span>':'')+'</div>'+
    '<div class="table-wrap"><table class="table stack"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Quantidade</th><th class="num">Custo unit.</th><th class="num">Total</th>'+(editable?'<th></th>':'')+'</tr></thead><tbody>'+rows.map(rowHTML).join("")+'</tbody></table></div>'
    :emptyState("clipboard","Nenhum item na contagem","Carregue uma lista ou inclua itens avulsos."))+summary()+'</section>';
  bind();
 };
 const setTotal=(tr,v)=>{tr.querySelector("[data-total]").innerHTML=money(v);const s=ctx.el.querySelector("[data-summary]");if(s)s.outerHTML=summary()};
 const saveRow=async tr=>{
  const qi=tr.querySelector("[data-qty]"),ci=tr.querySelector("[data-cost]");
  const qty=parseNum(qi.value),cost=parseNum(ci.value);
  qi.classList.toggle("is-invalid",Number.isNaN(qty));ci.classList.toggle("is-invalid",Number.isNaN(cost)||cost===null);
  if(Number.isNaN(qty)||Number.isNaN(cost)||cost===null)return toast("Use números não negativos (vírgula para decimais).","danger");
  const [kind,key]=tr.dataset.row.split(":");
  if(kind==="line"&&qty===null){
   const l=state.lines.find(x=>x.id===key);qi.value=inputNum(l?.counted_quantity);
   return toast("Para deixar sem contagem, remova o item (×). Use 0 para estoque zerado.","info");
  }
  if(kind==="pending"&&qty===null)return;
  const payload={counted_quantity:qty,unit_cost:cost,line_total:lineTotal(qty,cost)};
  tr.classList.add("is-saving");
  try{
   if(kind==="line"){const s=await update("stock_count_items",key,payload);state.lines=state.lines.map(l=>l.id===key?s:l)}
   else{
    const s=await insert("stock_count_items",{...payload,count_id:id,store_id:ctx.storeId,item_id:key});
    state.lines.push(s);state.pending=state.pending.filter(x=>x!==key);save();
    tr.dataset.row="line:"+s.id;tr.classList.remove("is-pending");
   }
   qi.value=inputNum(qty);ci.value=inputNum(cost,4);setTotal(tr,payload.line_total);
  }catch(error){toast(errorMessage(error),"danger")}
  finally{tr.classList.remove("is-saving")}
 };
 const bind=()=>{
  ctx.el.querySelector("[data-print]").onclick=()=>window.print();
  const q=ctx.el.querySelector("#q");
  q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!!t&&!r.dataset.search.includes(t))});
  if(!editable)return;
  ctx.el.querySelectorAll("tr[data-row] input").forEach(inp=>{
   inp.addEventListener("change",()=>saveRow(inp.closest("tr")));
   inp.addEventListener("focus",()=>inp.select());
   inp.addEventListener("keydown",ev=>{
    if(ev.key!=="Enter")return;ev.preventDefault();
    const all=[...ctx.el.querySelectorAll("tr[data-row]:not([hidden]) [data-qty]")];
    const next=all[all.indexOf(inp.closest("tr").querySelector("[data-qty]"))+1];
    inp.blur();if(next)next.focus();
   });
  });
  ctx.el.querySelectorAll("[data-remove]").forEach(b=>b.onclick=async()=>{
   const [kind,key]=b.closest("tr").dataset.row.split(":");
   if(kind==="pending"){state.pending=state.pending.filter(x=>x!==key);save();return draw()}
   try{await remove("stock_count_items",key);state.lines=state.lines.filter(l=>l.id!==key);draw()}catch(error){toast(errorMessage(error),"danger")}
  });
  ctx.el.querySelector("[data-load]").onclick=async()=>{
   const lid=ctx.el.querySelector("#load-list").value;if(!lid)return toast("Selecione uma lista.","info");
   const ids=(await list("purchase_list_items",{select:"item_id,sort_order",eq:{list_id:lid},order:"sort_order",asc:true})).map(r=>r.item_id);
   const have=new Set(state.lines.map(l=>l.item_id).concat(state.pending));
   const add=ids.filter(x=>!have.has(x));state.pending=state.pending.concat(add);save();draw();
   toast(add.length+" item(ns) carregado(s)"+(ids.length-add.length?"; "+(ids.length-add.length)+" já estavam na contagem":"")+".");
  };
  const addInp=ctx.el.querySelector("#add-item");
  const addOne=()=>{
   const v=addInp.value.trim();if(!v)return;
   const it=items.find(i=>(i.name+(i.code?" · "+i.code:""))===v||(i.code&&i.code.toLowerCase()===v.toLowerCase()));
   if(!it)return toast("Item não encontrado. Escolha uma opção da lista.","danger");
   if(state.lines.some(l=>l.item_id===it.id)||state.pending.includes(it.id))return toast("Este item já está na contagem.","info");
   state.pending.push(it.id);save();draw();
   ctx.el.querySelector('tr[data-row="pending:'+CSS.escape(it.id)+'"] [data-qty]')?.focus();
  };
  ctx.el.querySelector("[data-add]").onclick=addOne;
  addInp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();addOne()}});
  ctx.el.querySelector("[data-finalize]").onclick=async()=>{
   if(document.activeElement?.matches?.("[data-qty],[data-cost]"))document.activeElement.blur();
   await new Promise(r=>setTimeout(r,250));
   if(!state.lines.length)return toast("Conte ao menos um item antes de finalizar.","danger");
   const text=(state.pending.length?state.pending.length+" item(ns) sem contagem não entrarão no inventário. ":"")+"Após finalizar, o estoque da loja será ajustado e a contagem não poderá mais ser alterada.";
   if(!await confirmDialog({title:"Finalizar contagem "+count.display_id+"?",text,confirmLabel:"Finalizar"}))return;
   try{await update("stock_counts",id,{status:"finalized",finalized_at:new Date().toISOString()},{status:"draft"});writePending(id,[]);toast("Contagem finalizada e estoque atualizado.");ctx.reload()}
   catch(error){toast(errorMessage(error),"danger")}
  };
  ctx.el.querySelector("[data-cancel]").onclick=async()=>{
   if(!await confirmDialog({title:"Cancelar contagem?",text:"A contagem ficará registrada como cancelada e não afetará o estoque.",confirmLabel:"Cancelar contagem",danger:true}))return;
   try{await update("stock_counts",id,{status:"cancelled"},{status:"draft"});writePending(id,[]);toast("Contagem cancelada.");ctx.reload()}
   catch(error){toast(errorMessage(error),"danger")}
  };
 };
 draw();
}
