// Loja · Transferências entre lojas. Emitir gera saída na origem e entrada no destino (gatilho do banco).
// "Nova transferência" cria o rascunho na hora; destino, data e observação ficam na própria transferência.
// Custo unitário = última compra recebida na loja de origem; sem compra, custo padrão do item (não é digitado).
import {list,get,insert,update,remove,nextNumber} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,round2,today} from "../../core/format.js";
import {pageHead,btn,dataTable,field,input,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,alertBox,searchKey,searchBox} from "../../core/ui.js";
import {loadItems,byId,loadLastCosts,loadBalances,unitCost,lineTotal} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";
import {filterBar,bindFilters} from "../../core/filters.js";

const destinations=ctx=>ctx.app.stores.filter(s=>s.store_type==="operational"&&s.id!==ctx.storeId&&(ctx.app.flags[s.id]||{}).transfers);
const storeLabel=s=>s?s.name+(s.everest_code?" ("+s.everest_code+")":""):"";

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [rows,lines]=await Promise.all([
  list("transfers",{or:"from_store_id.eq."+ctx.storeId+",to_store_id.eq."+ctx.storeId,order:"created_at"}),
  list("transfer_items",{select:"transfer_id,line_total",or:"from_store_id.eq."+ctx.storeId+",to_store_id.eq."+ctx.storeId})
 ]);
 if(!ctx.isCurrent())return;
 const name=id=>ctx.app.stores.find(s=>s.id===id)?.name||id;
 const tot=id=>round2(lines.filter(l=>l.transfer_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const out=rows.filter(r=>r.from_store_id===ctx.storeId),inn=rows.filter(r=>r.to_store_id===ctx.storeId);
 const others=destinations(ctx);
 ctx.el.innerHTML=pageHead("Transferências","Envio de mercadorias entre lojas, com saída e entrada automáticas no estoque.",
   btn("Imprimir formulário",{variant:"secondary",icon:"printer",attrs:"data-print-form"})+(others.length?btn("Nova transferência",{icon:"plus",attrs:"data-new"}):""))+
  filterBar({search:"Número ou observação",dates:true,noun:["transferência","transferências"],selects:[
   {key:"dir",all:"Enviadas e recebidas",options:[["out","Enviadas"],["in","Recebidas"]]},
   {key:"st",all:"Todas as situações",options:[["draft","Rascunho"],["issued","Emitida"],["cancelled","Cancelada"]]},
   {key:"store",all:"Todas as lojas",options:[...new Set(rows.map(r=>r.from_store_id===ctx.storeId?r.to_store_id:r.from_store_id))].map(id=>[id,name(id)]).sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"))}]})+
  (others.length?'':alertBox("Nenhuma outra loja está habilitada para transferências no momento.","info"))+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Transferência",render:r=>'<span class="strong">'+e(r.number)+'</span>'+(r.observation?'<small class="sub">'+e(r.observation)+'</small>':'')},
   {label:"Direção",render:r=>r.from_store_id===ctx.storeId?'<span class="tag">Saída</span> para '+e(name(r.to_store_id)):'<span class="tag">Entrada</span> de '+e(name(r.from_store_id))},
   {label:"Data",render:r=>dateBR(r.transfer_date||r.issued_at||r.created_at)},
   {label:"Valor",cls:"num",render:r=>money(tot(r.id))},{label:"Situação",render:r=>statusPill(r.status)}
  ],rows,{rowHref:r=>ctx.base+"/transferencias/"+r.id,rowAttrs:r=>{const out=r.from_store_id===ctx.storeId;return 'data-search="'+e(searchKey(r.number,r.observation||""))+'" data-dir="'+(out?"out":"in")+'" data-st="'+e(r.status)+'" data-store="'+e(out?r.to_store_id:r.from_store_id)+'" data-date="'+e(String(r.transfer_date||r.created_at).slice(0,10))+'" data-total="'+tot(r.id)+'"'}}).replace('class="table"','class="table stack"'):emptyState("swap","Nenhuma transferência","As transferências enviadas e recebidas pela loja aparecem aqui."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 bindFilters(ctx.el,{noun:["transferência","transferências"]});
 ctx.el.querySelector("[data-print-form]").onclick=async()=>{
  try{printBlankForm(ctx,await loadItems({store:ctx.store}))}catch(error){toast(errorMessage(error),"danger")}
 };
 let creating=false;
 ctx.el.querySelector("[data-new]")?.addEventListener("click",async()=>{
  if(creating)return;creating=true;
  try{
   // Se já existe um rascunho vazio desta loja, abre ele em vez de criar outro.
   const empty=out.find(r=>r.status==="draft"&&!lines.some(l=>l.transfer_id===r.id));
   if(empty)return ctx.go(ctx.base+"/transferencias/"+empty.id);
   const number=await nextNumber("transfers","number","from_store_id",ctx.storeId,"TR");
   // O banco exige destino: começa com a primeira loja habilitada; a pessoa troca na própria transferência.
   const t=await insert("transfers",{number,from_store_id:ctx.storeId,to_store_id:others[0].id,transfer_date:today(),status:"draft",created_by:ctx.userId});
   toast("Transferência "+number+" criada.");ctx.go(ctx.base+"/transferencias/"+t.id);
  }catch(error){toast(errorMessage(error),"danger")}
  finally{creating=false}
 });
}

async function detail(ctx,id){
 const [t,lines,items,lastCosts,balances]=await Promise.all([get("transfers",id),list("transfer_items",{eq:{transfer_id:id}}),loadItems({store:ctx.store}),loadLastCosts(ctx.storeId),loadBalances(ctx.storeId)]);
 if(!ctx.isCurrent())return;
 if(t.from_store_id!==ctx.storeId&&t.to_store_id!==ctx.storeId)throw Error("Transferência de outra loja.");
 const name=sid=>ctx.app.stores.find(s=>s.id===sid)?.name||sid;
 const isOrigin=t.from_store_id===ctx.storeId;const editable=isOrigin&&t.status==="draft";
 const map=byId(items);
 const others=destinations(ctx);
 const dest=others.some(s=>s.id===t.to_store_id)?others:others.concat(ctx.app.stores.filter(s=>s.id===t.to_store_id));
 ctx.el.innerHTML=backLink(ctx.base+"/transferencias","Transferências")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Transferência '+e(t.number)+'</h1>'+statusPill(t.status)+'</div>'+
  (editable?'':'<p class="muted" style="margin:6px 0 0">'+e(name(t.from_store_id))+' → '+e(name(t.to_store_id))+' · '+e(dateBR(t.transfer_date||t.created_at))+'</p>')+'</div>'+
  '<div class="page-actions">'+(editable?btn("Excluir",{variant:"ghost",icon:"trash",attrs:"data-delete"})+btn("Emitir transferência",{variant:"ok",icon:"check",attrs:"data-issue"}):'')+'</div></div>'+
  (editable?'<section class="card"><div class="card-body"><div class="form-grid transfer-head">'+
    field("Loja de destino",'<select class="control" name="to_store_id" data-head>'+dest.map(s=>'<option value="'+e(s.id)+'"'+(s.id===t.to_store_id?" selected":"")+'>'+e(storeLabel(s))+'</option>').join("")+'</select>')+
    field("Data da transferência",input("transfer_date",t.transfer_date||today(),{type:"date",required:true,attrs:"data-head"}))+
    field("Observação",input("observation",t.observation||"",{placeholder:"Opcional",attrs:"data-head"}))+'</div></div></section>'
   :(t.observation?alertBox(t.observation,"info"):''))+
  (t.status==="issued"?alertBox("Emitida em "+dateBR(t.issued_at)+". Saída registrada em "+name(t.from_store_id)+" e entrada em "+name(t.to_store_id)+".","ok"):'')+
  card("Itens",'<div data-lines></div>',{flush:true});
 const costFor=itemId=>unitCost(itemId,lastCosts,map);
 if(!editable){mountLines({el:ctx.el.querySelector("[data-lines]"),table:"transfer_items",parentKey:"transfer_id",parentId:id,extra:{},lines,items:map,editable:false,fixedCost:true,costFor});return}
 const extra={from_store_id:t.from_store_id,to_store_id:t.to_store_id};
 const ui=allItemsTable(ctx,ctx.el.querySelector("[data-lines]"),{id,lines,items,map,balances,costFor,extra});
 // Destino, data e observação gravam ao sair do campo. Trocar o destino também atualiza as linhas já lançadas.
 ctx.el.querySelectorAll("[data-head]").forEach(el=>el.addEventListener("change",async()=>{
  const k=el.name;
  if(k==="transfer_date"&&!el.value){el.value=t.transfer_date;return toast("Informe a data da transferência.","danger")}
  const patch=k==="observation"?{observation:el.value.trim()||null}:{[k]:el.value};
  try{
   if(k==="to_store_id")for(const l of ui.lines)await update("transfer_items",l.id,{to_store_id:el.value});
   Object.assign(t,await update("transfers",id,patch,{status:"draft"}));
   if(k==="to_store_id")extra.to_store_id=el.value;
   toast(k==="to_store_id"?"Destino: "+name(el.value)+".":k==="transfer_date"?"Data atualizada.":"Observação salva.");
  }catch(error){toast(errorMessage(error),"danger");el.value=t[k]||""}
 }));
 ctx.el.querySelector("[data-issue]").onclick=async()=>{
  if(document.activeElement?.matches?.("[data-head]"))document.activeElement.blur();
  await new Promise(r=>setTimeout(r,250));
  if(!ui.lines.length)return toast("Inclua itens antes de emitir.","danger");
  // Não trava por estoque (pedido de 20/11/2026): só avisa; a origem pode ficar negativa até a próxima contagem.
  const short=ui.lines.filter(l=>(balances.get(l.item_id)??0)<Number(l.quantity));
  if(!await confirmDialog({title:"Emitir transferência?",
   list:[["Destino",name(t.to_store_id)],["Data",dateBR(t.transfer_date)],["Itens",String(ui.lines.length)],["Valor",money(ui.total())]],
   warn:short.length?(short.length===1?"1 item está":short.length+" itens estão")+" com quantidade maior que o estoque. O saldo desta loja ficará negativo.":"",
   text:"O estoque sai desta loja e entra no destino na hora.",confirmLabel:"Emitir"}))return;
  try{await update("transfers",id,{status:"issued",issued_at:new Date().toISOString()},{status:"draft"});toast("Transferência emitida.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
 // Rascunho não mexe em estoque: pode ser excluído de vez (itens e transferência).
 ctx.el.querySelector("[data-delete]").onclick=async()=>{
  const n=ui.lines.length;
  if(!await confirmDialog({title:"Excluir transferência "+t.number+"?",list:[["Destino",name(t.to_store_id)],["Itens lançados",String(n)]],text:"O rascunho é apagado de vez. O estoque não é afetado.",confirmLabel:"Excluir",danger:true}))return;
  try{for(const l of ui.lines)await remove("transfer_items",l.id);await remove("transfers",id);toast("Transferência "+t.number+" excluída.");ctx.go(ctx.base+"/transferencias")}
  catch(error){toast(errorMessage(error),"danger")}
 };
}

// Formulário em branco para preencher à mão: todos os itens liberados para a loja, com quantidade e destino em branco.
function printBlankForm(ctx,items){
 const rows=items.filter(i=>i.active!==false).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
 document.querySelector(".print-sheet")?.remove();
 const sheet=document.createElement("div");sheet.className="print-sheet";
 sheet.innerHTML='<h1>Formulário de transferência</h1>'+
  '<p class="ps-meta">Loja de origem: <strong>'+e(storeLabel(ctx.store))+'</strong> · Loja de destino: ______________________________ · Data: ____/____/______</p>'+
  '<p class="ps-meta">Responsável pelo envio: ______________________________ · Recebido por: ______________________________</p>'+
  '<table><thead><tr><th class="ps-n">#</th><th>Item</th><th>Unidade</th><th>Quantidade</th></tr></thead><tbody>'+
  rows.map((i,n)=>'<tr><td class="ps-n">'+(n+1)+'</td><td><strong>'+e(i.name)+'</strong><small>'+e(i.code||"")+'</small></td><td>'+e(i.base_unit||"")+'</td><td><span class="ps-blank"></span></td></tr>').join("")+
  '</tbody></table>';
 document.body.appendChild(sheet);document.body.classList.add("printing-sheet");
 const done=()=>{document.body.classList.remove("printing-sheet");sheet.remove();removeEventListener("afterprint",done)};
 addEventListener("afterprint",done);
 window.print();
}

// Rascunho: todos os itens liberados para a loja já aparecem (como no formulário impresso).
// Digitar a quantidade grava a linha; apagar ou zerar tira o item da transferência.
function allItemsTable(ctx,el,{id,lines,items,map,balances,costFor,extra}){
 const byItem=new Map(lines.map(l=>[l.item_id,l]));
 const rowsItems=()=>{const ids=new Set(items.filter(i=>i.active!==false).map(i=>i.id));for(const l of byItem.values())ids.add(l.item_id);
  return [...ids].map(x=>map.get(x)||{id:x,name:"Item"}).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"))};
 const total=()=>round2([...byItem.values()].reduce((s,l)=>s+Number(l.line_total||0),0));
 const foot=()=>'Total ('+byItem.size+' '+(byItem.size===1?"item":"itens")+')';
 const rows=rowsItems();
 el.innerHTML=(rows.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("tq","Buscar item")+
  '<span class="muted">Digite a quantidade e tecle Enter para ir ao próximo. Vazio ou 0 = não transferir.</span></div>'+
  '<div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Item</th><th>Unid.</th><th class="num">Em estoque</th><th class="num">Quantidade</th><th class="num">Custo unit.</th><th class="num">Total</th></tr></thead><tbody>'+
  rows.map(it=>{const l=byItem.get(it.id),bal=balances.get(it.id)??0,c=costFor(it.id);
   return '<tr data-item="'+e(it.id)+'" data-search="'+e(searchKey(it.name,it.code))+'"'+(l?'':' class="is-pending"')+'><td><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td><td>'+e(it.base_unit||"")+'</td>'+
    '<td class="num" data-bal>'+num(bal)+'</td><td class="num"><input class="cell-input" data-qty inputmode="decimal" placeholder="—" value="'+e(l?inputNum(l.quantity):"")+'" aria-label="Quantidade de '+e(it.name)+'"></td>'+
    '<td class="num" title="'+e(c.source)+'">'+money(l?l.unit_cost:c.cost)+'</td><td class="num" data-total>'+(l?money(l.line_total):'<span class="muted">—</span>')+'</td></tr>'}).join("")+
  '</tbody><tfoot><tr><td colspan="5" data-foot>'+foot()+'</td><td class="num" data-grand>'+money(total())+'</td></tr></tfoot></table></div>'
  :emptyState("box","Nenhum item liberado para a loja","Os itens aparecem aqui quando tiverem a marca da loja ou a marca Global."));
 const q=el.querySelector("#tq");
 q?.addEventListener("input",()=>{const k=searchKey(q.value).trim();el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!!k&&!r.dataset.search.includes(k))});
 const refresh=tr=>{const l=byItem.get(tr.dataset.item);tr.classList.toggle("is-pending",!l);tr.querySelector("[data-total]").innerHTML=l?money(l.line_total):'<span class="muted">—</span>';
  const bal=balances.get(tr.dataset.item)??0;tr.querySelector("[data-bal]").innerHTML=l&&bal<Number(l.quantity)?'<span class="text-warn">'+num(bal)+'</span>':num(bal);
  el.querySelector("[data-grand]").textContent=money(total());el.querySelector("[data-foot]").textContent=foot()};
 const save=async inp=>{
  const tr=inp.closest("tr"),itemId=tr.dataset.item,v=parseNum(inp.value),l=byItem.get(itemId);
  inp.classList.toggle("is-invalid",Number.isNaN(v));if(Number.isNaN(v))return toast("Use números não negativos (vírgula para decimais).","danger");
  const qty=v||null;if((l?Number(l.quantity):null)===qty)return;
  tr.classList.add("is-saving");
  try{
   if(!qty){if(l){await remove("transfer_items",l.id);byItem.delete(itemId)}inp.value=""}
   else{const cost=Number(costFor(itemId).cost||0),row={quantity:qty,unit_cost:cost,line_total:lineTotal(qty,cost)};
    byItem.set(itemId,l?await update("transfer_items",l.id,row):await insert("transfer_items",{...extra,transfer_id:id,item_id:itemId,...row}));inp.value=inputNum(qty)}
   refresh(tr);
  }catch(error){toast(errorMessage(error),"danger")}
  finally{tr.classList.remove("is-saving")}
 };
 el.querySelectorAll("[data-qty]").forEach(inp=>{
  inp.addEventListener("change",()=>save(inp));inp.addEventListener("focus",()=>inp.select());
  inp.addEventListener("keydown",ev=>{if(ev.key!=="Enter")return;ev.preventDefault();const all=[...el.querySelectorAll("tr[data-item]:not([hidden]) [data-qty]")];const n=all[all.indexOf(inp)+1];inp.blur();if(n)n.focus()});
 });
 return {get lines(){return [...byItem.values()]},total};
}
