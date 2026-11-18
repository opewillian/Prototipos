// Loja · Pedidos de compra: lista + contagem + consumo real + pedidos em aberto → sugestão explicada.
import {list,get,insert,insertMany,update,remove,nextNumber} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,addDays,daysBetween,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,openDrawer,field,input,select,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,searchBox,searchKey,alertBox} from "../../core/ui.js";
import {loadItems,loadSuppliers,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";
import {consumption10,openAfterCount,suggest,memory} from "../shared/demand.js";

export const NEXT={draft:[["sent","Enviar pedido","primary"]],sent:[["realizing","Marcar em andamento","secondary"],["realized","Marcar como realizado","ok"]],realizing:[["realized","Marcar como realizado","ok"]]};
const STAMP={sent:"sent_at",realized:"realized_at"};

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [orders,lines]=await Promise.all([
  list("purchase_orders",{eq:{store_id:ctx.storeId},order:"created_at"}),
  list("purchase_order_items",{select:"order_id,line_total,requested_quantity",eq:{store_id:ctx.storeId}})
 ]);
 if(!ctx.isCurrent())return;
 const tot=id=>round2(lines.filter(l=>l.order_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const qn=id=>lines.filter(l=>l.order_id===id&&Number(l.requested_quantity)>0).length;
 const open=orders.filter(o=>["sent","realizing"].includes(o.status));
 const late=open.filter(o=>o.delivery_date<today());
 ctx.el.innerHTML=pageHead("Pedidos de compra","Sugestões calculadas pela contagem, consumo e pedidos em aberto.",btn("Novo pedido",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Rascunhos",orders.filter(o=>o.status==="draft").length,"",{icon:"edit"})+
  kpi("Em aberto",open.length,money(open.reduce((s,o)=>s+tot(o.id),0)),{icon:"cart",tone:"info"})+
  kpi("Entregas atrasadas",late.length,"",{icon:"alert",tone:late.length?"warn":"ok"})+
  kpi("Realizados no mês",orders.filter(o=>o.status==="realized"&&String(o.realized_at||"").startsWith(today().slice(0,7))).length,"",{icon:"check",tone:"ok"})+'</div>'+
  '<section class="card">'+(orders.length?dataTable([
   {label:"Pedido",render:o=>'<span class="strong">'+e(o.number)+'</span>'+(o.observation?'<small class="sub">'+e(o.observation)+'</small>':'')},
   {label:"Entrega",render:o=>dateBR(o.delivery_date)+(["sent","realizing"].includes(o.status)&&o.delivery_date<today()?' <span class="pill pill-danger">Atrasado</span>':'')},
   {label:"Itens",cls:"num",render:o=>String(qn(o.id))},
   {label:"Total",cls:"num",render:o=>money(tot(o.id))},
   {label:"Situação",render:o=>statusPill(o.status)}
  ],orders,{rowHref:o=>ctx.base+"/pedidos/"+o.id}).replace('class="table"','class="table stack"')
  :emptyState("cart","Nenhum pedido de compra","Crie um pedido a partir de uma lista e da última contagem.",btn("Novo pedido",{icon:"plus",attrs:"data-new"})))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>newOrder(ctx));
}

async function newOrder(ctx){
 const [lists,counts]=await Promise.all([
  list("purchase_lists",{eq:{store_id:ctx.storeId,active:true},order:"name",asc:true}),
  list("stock_counts",{select:"id,display_id,count_date,finalized_at",eq:{store_id:ctx.storeId,status:"finalized"},order:"count_date",order2:"finalized_at",limit:20})
 ]);
 const buyLists=lists.filter(l=>l.list_type!=="count");
 openDrawer({title:"Novo pedido de compra",submitLabel:"Criar e calcular sugestão",body:'<div class="form-grid">'+
  field("Entrega prevista",input("delivery_date",addDays(today(),2),{type:"date",required:true}))+
  field("Contagem de referência",select("count_id",counts.map(c=>[c.id,c.display_id+" · "+dateBR(c.count_date)]),counts[0]?.id||"",{placeholder:counts.length?"Sem contagem":"Nenhuma contagem finalizada"}))+
  '<div class="span-2">'+field("Lista de compra",select("list_id",buyLists.map(l=>[l.id,l.name]),buyLists[0]?.id||"",{placeholder:buyLists.length?"Sem lista (usar itens da contagem)":"Nenhuma lista de compra"}))+'</div>'+
  '<div class="span-2">'+field("Observação",textarea("observation","",{rows:2}))+'</div></div>'+
  (counts.length?'':alertBox("Sem contagem finalizada a sugestão não pode ser calculada; você ainda pode informar as quantidades manualmente.","info")),
  onSubmit:async form=>{
   const f=form.elements;if(!f.delivery_date.value)throw Error("Informe a data de entrega.");
   if(!f.list_id.value&&!f.count_id.value)throw Error("Escolha uma lista ou uma contagem para montar o pedido.");
   const number=await nextNumber("purchase_orders","number","store_id",ctx.storeId,"PC");
   const o=await insert("purchase_orders",{store_id:ctx.storeId,number,delivery_date:f.delivery_date.value,list_id:f.list_id.value||null,count_id:f.count_id.value||null,observation:f.observation.value.trim()||null,status:"draft",created_by:ctx.userId});
   await buildLines(ctx,o,{replace:false});
   toast("Pedido "+number+" criado com as sugestões.");ctx.go(ctx.base+"/pedidos/"+o.id);
  }});
}

/** Monta/recalcula as linhas do pedido com base em lista, contagem e histórico. */
async function buildLines(ctx,order,{replace}){
 const [items,lastCosts,links,existing]=await Promise.all([loadItems(),loadLastCosts(ctx.storeId),
  list("store_item_suppliers",{eq:{store_id:ctx.storeId,active:true}}),list("purchase_order_items",{eq:{order_id:order.id}})]);
 const map=byId(items);
 let count=null,countLines=[];
 if(order.count_id){count=await get("stock_counts",order.count_id);countLines=await list("stock_count_items",{select:"item_id,counted_quantity",eq:{count_id:order.count_id}})}
 const counted=new Map(countLines.map(l=>[l.item_id,Number(l.counted_quantity)]));
 let ids=order.list_id?(await list("purchase_list_items",{select:"item_id,sort_order",eq:{list_id:order.list_id},order:"sort_order",asc:true})).map(r=>r.item_id):countLines.map(l=>l.item_id);
 // Recalcular mantém só as linhas atuais (não traz de volta itens removidos pelo usuário).
 ids=replace?existing.map(l=>l.item_id):ids.concat(existing.map(l=>l.item_id)).filter((v,i,a)=>a.indexOf(v)===i&&map.get(v)?.active!==false);
 const {map:avg}=await consumption10(ctx.storeId);
 const open=await openAfterCount(ctx.storeId,count?.finalized_at||null,order.id);
 const days=count?daysBetween(count.count_date,order.delivery_date):0;
 const pref=itemId=>{const ls=links.filter(l=>l.item_id===itemId);return (ls.find(l=>l.preferred)||ls[0])?.supplier_id||null};
 const calc=itemId=>{
  const it=map.get(itemId)||{};
  const input={counted:counted.has(itemId)?counted.get(itemId):null,avg10:avg.get(itemId)??0,open:open.get(itemId)||0,minimum:Number(it.minimum_stock||0),daysToDelivery:days,unit:it.base_unit};
  return {input,s:suggest(input)};
 };
 const inserts=[];
 for(const itemId of ids){
  const {input,s}=calc(itemId);
  const row={counted_quantity:input.counted,average_sold_10_days:input.avg10,open_quantity_after_count:input.open,suggested_quantity:s.value};
  const ex=existing.find(l=>l.item_id===itemId);
  if(ex){if(replace){const req=ex.requested_quantity;await update("purchase_order_items",ex.id,{...row,line_total:lineTotal(req,ex.unit_cost)})}continue}
  const cost=unitCost(itemId,lastCosts,map).cost;const req=s.value??0;
  inserts.push({order_id:order.id,store_id:ctx.storeId,item_id:itemId,...row,requested_quantity:req,unit_cost:cost,line_total:lineTotal(req,cost),supplier_id:pref(itemId)});
 }
 await insertMany("purchase_order_items",inserts);
}

async function detail(ctx,id){
 const [order,lines,items,suppliers,links,lastCosts]=await Promise.all([
  get("purchase_orders",id),list("purchase_order_items",{eq:{order_id:id},order:"created_at",asc:true}),
  loadItems(),loadSuppliers(),list("store_item_suppliers",{eq:{store_id:ctx.storeId,active:true}}),loadLastCosts(ctx.storeId)
 ]);
 if(!ctx.isCurrent())return;
 if(order.store_id!==ctx.storeId)throw Error("Este pedido pertence a outra loja.");
 const map=byId(items),sup=byId(suppliers);
 const editable=order.status==="draft";
 let count=null;if(order.count_id){try{count=await get("stock_counts",order.count_id)}catch{}}
 const days=count?daysBetween(count.count_date,order.delivery_date):0;
 let rows=lines.slice();
 const supOptions=itemId=>{
  const ids=links.filter(l=>l.item_id===itemId).map(l=>l.supplier_id);
  const pool=ids.length?suppliers.filter(s=>ids.includes(s.id)):suppliers.filter(s=>s.active!==false);
  return pool.map(s=>[s.id,s.name+(links.find(l=>l.item_id===itemId&&l.supplier_id===s.id&&l.preferred)?" ★":"")]);
 };
 const flagsOf=r=>{
  const it=map.get(r.item_id)||{};
  const s=suggest({counted:r.counted_quantity,avg10:r.average_sold_10_days,open:r.open_quantity_after_count,minimum:it.minimum_stock,daysToDelivery:days,unit:it.base_unit});
  const f=s.flags.slice();if(!r.supplier_id)f.push("Sem fornecedor definido");
  if(Number(r.requested_quantity)>0&&r.suggested_quantity!==null&&Number(r.requested_quantity)>Number(r.suggested_quantity)*2&&Number(r.suggested_quantity)>0)f.push("Solicitado acima do dobro do sugerido");
  return {s,f};
 };
 const total=()=>round2(rows.reduce((t,r)=>t+Number(r.line_total||0),0));
 const groups=()=>{const g=new Map();for(const r of rows){const k=r.supplier_id||"";(g.get(k)||g.set(k,[]).get(k)).push(r)}
  return [...g.entries()].sort((a,b)=>(sup.get(a[0])?.name||"~").localeCompare(sup.get(b[0])?.name||"~","pt-BR"))};
 const draw=()=>{
  const actions=(NEXT[order.status]||[]).map(([st,label,v])=>btn(label,{variant:v,attrs:'data-status="'+st+'"'})).join("");
  const head='<tr><th>Item</th><th class="num">Contado</th><th class="num">Média 10 dias<span class="help" title="Consumo médio em 10 dias entre as duas últimas contagens finalizadas (entradas e saídas registradas consideradas).">?</span></th><th class="num">Em aberto<span class="help" title="Quantidade em outros pedidos enviados ou em andamento feitos após a contagem.">?</span></th><th class="num">Sugerido<span class="help" title="(Média 10 dias + estoque mínimo) − estoque projetado na entrega. Passe o mouse no valor para ver a conta.">?</span></th><th class="num">Solicitado</th><th class="num">Custo unit.</th><th class="num">Total</th>'+(editable?'<th>Fornecedor</th><th></th>':'')+'<th></th></tr>';
  const body=groups().map(([sid,rs])=>{
   const sub=round2(rs.reduce((t,r)=>t+Number(r.line_total||0),0));
   return '<tr class="group-row"><td colspan="'+(editable?11:9)+'"><strong>'+e(sup.get(sid)?.name||"Sem fornecedor")+'</strong><span class="muted"> · '+rs.filter(r=>Number(r.requested_quantity)>0).length+' item(ns) · '+money(sub)+'</span></td></tr>'+
    rs.map(r=>{const it=map.get(r.item_id)||{name:"Item"};const {s,f}=flagsOf(r);
     const mem=memory({counted:r.counted_quantity,avg10:r.average_sold_10_days,open:r.open_quantity_after_count,minimum:it.minimum_stock,daysToDelivery:days},s);
     return '<tr data-id="'+e(r.id)+'" data-search="'+e(searchKey(it.name,it.code))+'"><td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e((it.code||"")+" · "+(it.base_unit||""))+'</small></td>'+
      '<td class="num" data-label="Contado">'+num(r.counted_quantity)+'</td><td class="num" data-label="Média 10 dias">'+num(r.average_sold_10_days)+'</td><td class="num" data-label="Em aberto">'+num(r.open_quantity_after_count)+'</td>'+
      '<td class="num" data-label="Sugerido" title="'+e(mem)+'"><strong>'+num(r.suggested_quantity)+'</strong></td>'+
      (editable?'<td class="num" data-label="Solicitado"><input class="cell-input" data-req inputmode="decimal" value="'+e(inputNum(r.requested_quantity))+'"></td><td class="num" data-label="Custo"><input class="cell-input" data-cost inputmode="decimal" value="'+e(inputNum(r.unit_cost,4))+'"></td>'
       :'<td class="num" data-label="Solicitado"><strong>'+num(r.requested_quantity)+'</strong></td><td class="num" data-label="Custo">'+money(r.unit_cost)+'</td>')+
      '<td class="num" data-label="Total" data-total>'+money(r.line_total)+'</td>'+
      (editable?'<td data-label="Fornecedor"><select class="control" data-sup style="min-width:150px">'+'<option value="">Selecione</option>'+supOptions(r.item_id).map(([v,l])=>'<option value="'+e(v)+'"'+(v===r.supplier_id?" selected":"")+'>'+e(l)+'</option>').join("")+'</select></td>'+
       '<td class="act"><button class="icon-btn danger" data-del aria-label="Remover">'+icon("x",16)+'</button></td>':'')+
      '<td>'+(f.length?'<span class="text-warn" title="'+e(f.join(" · "))+'">'+icon("alert",17)+'</span>':'')+'</td></tr>'}).join("");
  }).join("");
  const available=items.filter(i=>i.active!==false&&!rows.some(r=>r.item_id===i.id));
  ctx.el.innerHTML=backLink(ctx.base+"/pedidos","Pedidos de compra")+
   '<div class="doc-head"><div><div class="doc-title"><h1>Pedido '+e(order.number)+'</h1>'+statusPill(order.status)+'</div><p class="muted" style="margin:6px 0 0">'+(order.observation?e(order.observation):'Entrega prevista para '+dateBR(order.delivery_date))+'</p></div>'+
   '<div class="page-actions">'+btn("Imprimir",{variant:"secondary",icon:"printer",attrs:"data-print"})+
   (["draft","sent","realizing"].includes(order.status)?btn("Cancelar",{variant:"ghost",attrs:'data-status="cancelled"'}):'')+actions+'</div></div>'+
   '<div class="doc-meta"><div><small>Entrega prevista</small><strong>'+dateBR(order.delivery_date)+'</strong></div><div><small>Contagem de referência</small><strong>'+(count?e(count.display_id)+' · '+dateBR(count.count_date):"—")+'</strong></div>'+
   '<div><small>Dias até a entrega</small><strong>'+(count?days:"—")+'</strong></div><div><small>Total do pedido</small><strong data-grand>'+money(total())+'</strong></div></div>'+
   '<section class="card">'+(editable?'<div class="add-row">'+field("Incluir item",'<input class="control" id="add-item" list="dl-po" placeholder="Nome ou código" autocomplete="off"><datalist id="dl-po">'+available.map(i=>'<option value="'+e(i.name+(i.code?" · "+i.code:""))+'">').join("")+'</datalist>')+
    btn("Incluir",{variant:"secondary",icon:"plus",attrs:"data-add"})+'<span style="flex:1"></span>'+btn("Recalcular sugestões",{variant:"secondary",icon:"chart",attrs:"data-recalc"})+btn("Solicitado = sugerido",{variant:"ghost",attrs:"data-apply"})+'</div>':'')+
   (rows.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar item")+'</div><div class="table-wrap"><table class="table stack po-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'
    :emptyState("cart","Pedido sem itens",editable?"Inclua itens ou recalcule as sugestões.":""))+'</section>'+
   '<style>.group-row td{background:var(--brand-50)!important;padding:9px 16px}.po-table .control{min-height:34px;padding:6px 8px}</style>';
  bind();
 };
 const saveLine=async tr=>{
  const r=rows.find(x=>x.id===tr.dataset.id);
  const q=parseNum(tr.querySelector("[data-req]").value),c=parseNum(tr.querySelector("[data-cost]").value);
  if(q===null||Number.isNaN(q)||c===null||Number.isNaN(c))return toast("Informe quantidade e custo válidos (0 para não comprar).","danger");
  try{const s=await update("purchase_order_items",r.id,{requested_quantity:q,unit_cost:c,line_total:lineTotal(q,c)});Object.assign(r,s);
   tr.querySelector("[data-total]").textContent=money(s.line_total);ctx.el.querySelector("[data-grand]").textContent=money(total())}
  catch(error){toast(errorMessage(error),"danger")}
 };
 const bind=()=>{
  ctx.el.querySelector("[data-print]").onclick=()=>window.print();
  const q=ctx.el.querySelector("#q");q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!!t&&!r.dataset.search.includes(t))});
  ctx.el.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>changeStatus(b.dataset.status));
  if(!editable)return;
  ctx.el.querySelectorAll("tr[data-id] input").forEach(i=>{i.addEventListener("change",()=>saveLine(i.closest("tr")));i.addEventListener("focus",()=>i.select())});
  ctx.el.querySelectorAll("[data-sup]").forEach(s=>s.addEventListener("change",async()=>{
   const r=rows.find(x=>x.id===s.closest("tr").dataset.id);
   try{
    // O banco exige o vínculo loja × item × fornecedor; cria-o quando ainda não existe.
    if(s.value&&!links.some(l=>l.item_id===r.item_id&&l.supplier_id===s.value)){
     const first=!links.some(l=>l.item_id===r.item_id);
     links.push(await insert("store_item_suppliers",{store_id:ctx.storeId,item_id:r.item_id,supplier_id:s.value,preferred:first,active:true}));
    }
    Object.assign(r,await update("purchase_order_items",r.id,{supplier_id:s.value||null}));draw()
   }catch(error){toast(errorMessage(error),"danger");draw()}
  }));
  ctx.el.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
   const rid=b.closest("tr").dataset.id;try{await remove("purchase_order_items",rid);rows=rows.filter(r=>r.id!==rid);draw()}catch(error){toast(errorMessage(error),"danger")}
  });
  const addInp=ctx.el.querySelector("#add-item");
  const add=async()=>{
   const v=addInp.value.trim();const it=items.find(i=>(i.name+(i.code?" · "+i.code:""))===v||(i.code&&i.code.toLowerCase()===v.toLowerCase()));
   if(!it)return toast("Escolha um item da lista.","danger");
   const cost=unitCost(it.id,lastCosts,map).cost;const ls=links.filter(l=>l.item_id===it.id);
   try{rows.push(await insert("purchase_order_items",{order_id:id,store_id:ctx.storeId,item_id:it.id,requested_quantity:0,unit_cost:cost,line_total:0,supplier_id:(ls.find(l=>l.preferred)||ls[0])?.supplier_id||null}));
    await buildLines(ctx,order,{replace:true});ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
  };
  ctx.el.querySelector("[data-add]").onclick=add;addInp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();add()}});
  ctx.el.querySelector("[data-recalc]").onclick=async()=>{try{await buildLines(ctx,order,{replace:true});toast("Sugestões recalculadas com os dados atuais.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}};
  ctx.el.querySelector("[data-apply]").onclick=async()=>{
   if(!await confirmDialog({title:"Usar as quantidades sugeridas?",text:"As quantidades solicitadas serão substituídas pelas sugeridas em todos os itens.",confirmLabel:"Aplicar"}))return;
   try{for(const r of rows){if(r.suggested_quantity===null)continue;Object.assign(r,await update("purchase_order_items",r.id,{requested_quantity:r.suggested_quantity,line_total:lineTotal(r.suggested_quantity,r.unit_cost)}))}draw();toast("Quantidades aplicadas.")}catch(error){toast(errorMessage(error),"danger")}
  };
 };
 const changeStatus=async st=>{
  const labels={sent:"Enviar o pedido?",realizing:"Marcar como em andamento?",realized:"Marcar como realizado?",cancelled:"Cancelar o pedido?"};
  const active=rows.filter(r=>Number(r.requested_quantity)>0);
  if(st==="sent"){
   if(!active.length)return toast("Informe a quantidade de pelo menos um item.","danger");
   const noSup=active.filter(r=>!r.supplier_id).length;if(noSup)return toast(noSup+" item(ns) sem fornecedor. Defina o fornecedor antes de enviar.","danger");
  }
  const text=st==="sent"?active.length+" item(ns), total "+money(total())+". Itens com quantidade zero serão removidos e o pedido não poderá mais ser editado.":st==="cancelled"?"O pedido ficará registrado como cancelado.":"";
  if(!await confirmDialog({title:labels[st],text,confirmLabel:st==="cancelled"?"Cancelar pedido":"Confirmar",danger:st==="cancelled"}))return;
  try{
   if(st==="sent")for(const r of rows.filter(r=>!(Number(r.requested_quantity)>0)))await remove("purchase_order_items",r.id);
   const patch={status:st};if(STAMP[st])patch[STAMP[st]]=new Date().toISOString();
   await update("purchase_orders",id,patch,{status:order.status});toast("Pedido atualizado.");ctx.reload();
  }catch(error){toast(errorMessage(error),"danger")}
 };
 draw();
}
