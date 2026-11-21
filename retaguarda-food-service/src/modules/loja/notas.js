// Loja · Notas fiscais de entrada: cabeçalho, itens, parcelas, anexos e recebimento.
// Receber a nota gera a entrada no estoque da loja (gatilho do banco) e bloqueia edições.
import {list,get,insert,update,remove,supabase} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,addDays,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,openDrawer,field,input,select,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,searchBox,searchKey,alertBox} from "../../core/ui.js";
import {loadItems,loadSuppliers,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";
import {loadMaps,syncNfe,nfeItemsCard,openNfeDepara} from "../shared/nfe.js";

export const ATTACH_BUCKET="retaguarda-anexos";
const PAY={pending:"pending",paid:"paid"};
const METHODS=[["boleto","Boleto"],["pix","PIX"],["transferencia","Transferência"],["cartao","Cartão"],["dinheiro","Dinheiro"],["cheque","Cheque"]];
const methodLabel=m=>(METHODS.find(x=>x[0]===m)||[,m||"—"])[1];
function payState(p){if(p.paid_at||p.status===PAY.paid)return "paid";return p.due_date&&p.due_date<today()?"overdue":"open"}

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [invoices,lines,pays,suppliers]=await Promise.all([
  list("invoices",{eq:{store_id:ctx.storeId},order:"entry_date",order2:"created_at"}),
  list("invoice_items",{select:"invoice_id,line_total",eq:{store_id:ctx.storeId}}),
  list("invoice_payments",{eq:{store_id:ctx.storeId}}),
  loadSuppliers()
 ]);
 if(!ctx.isCurrent())return;
 const sup=byId(suppliers);
 const tot=id=>round2(lines.filter(l=>l.invoice_id===id).reduce((s,l)=>s+Number(l.line_total||0),0));
 const month=today().slice(0,7);
 const monthTotal=invoices.filter(i=>i.status==="received"&&String(i.entry_date).startsWith(month)).reduce((s,i)=>s+tot(i.id),0);
 const openPays=pays.filter(p=>payState(p)!=="paid");
 const due7=openPays.filter(p=>p.due_date>=today()&&p.due_date<=addDays(today(),7));
 const overdue=openPays.filter(p=>payState(p)==="overdue");
 ctx.el.innerHTML=pageHead("Notas fiscais","Entradas de mercadoria, pagamentos e anexos da loja.",btn("Lançar nota",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Compras recebidas no mês",money(monthTotal),"",{icon:"receipt"})+
  kpi("Aguardando recebimento",invoices.filter(i=>i.status==="pending").length,"Notas lançadas sem entrada no estoque",{icon:"box",tone:"warn"})+
  kpi("A vencer em 7 dias",money(due7.reduce((s,p)=>s+Number(p.amount||0),0)),due7.length+" parcela(s)",{icon:"calendar",tone:"info"})+
  kpi("Vencidas",money(overdue.reduce((s,p)=>s+Number(p.amount||0),0)),overdue.length+" parcela(s)",{icon:"alert",tone:overdue.length?"warn":"ok"})+'</div>'+
  '<section class="card">'+(invoices.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Número ou fornecedor")+
   '<select class="control" id="f-st"><option value="">Todas</option><option value="pending">Pendentes</option><option value="received">Recebidas</option><option value="cancelled">Canceladas</option></select></div>'+dataTable([
   {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)?.name||"Sem fornecedor")+'</small>'},
   {label:"Emissão",render:i=>dateBR(i.issue_date)},{label:"Entrada",render:i=>dateBR(i.entry_date)},
   {label:"Valor",cls:"num",render:i=>money(tot(i.id))},
   {label:"Pagamento",render:i=>{const ps=pays.filter(p=>p.invoice_id===i.id);if(!ps.length)return '<span class="muted">—</span>';const st=ps.map(payState);return statusPill(st.includes("overdue")?"overdue":st.every(s=>s==="paid")?"paid":"open")}},
   {label:"Situação",render:i=>statusPill(i.status)}
  ],invoices,{rowHref:i=>ctx.base+"/notas/"+i.id,rowAttrs:i=>'data-search="'+e(searchKey(i.invoice_number,sup.get(i.supplier_id)?.name))+'" data-st="'+e(i.status)+'"'}).replace('class="table"','class="table stack"')
  :emptyState("receipt","Nenhuma nota lançada","Lance as notas de compra para dar entrada no estoque e controlar os pagamentos.",btn("Lançar nota",{icon:"plus",attrs:"data-new"})))+'</section>';
 const filter=()=>{const q=searchKey(ctx.el.querySelector("#q")?.value||"").trim(),st=ctx.el.querySelector("#f-st")?.value;
  ctx.el.querySelectorAll("tr[data-search]").forEach(r=>r.hidden=!((!q||r.dataset.search.includes(q))&&(!st||r.dataset.st===st)))};
 ctx.el.querySelector("#q")?.addEventListener("input",filter);ctx.el.querySelector("#f-st")?.addEventListener("input",filter);
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>editHeader(ctx,null,suppliers));
}

async function editHeader(ctx,inv,suppliers){
 const orders=await list("purchase_orders",{select:"id,number,status",eq:{store_id:ctx.storeId},in:{status:["sent","realizing"]},order:"created_at"});
 const i=inv||{issue_date:today(),entry_date:today()};
 openDrawer({title:inv?"Editar nota":"Lançar nota fiscal",submitLabel:inv?"Salvar":"Lançar e incluir itens",body:'<div class="form-grid">'+
  field("Número da nota",input("invoice_number",i.invoice_number,{required:true,placeholder:"Ex.: 123456"}))+
  field("Fornecedor",select("supplier_id",suppliers.filter(s=>s.active!==false||s.id===i.supplier_id).map(s=>[s.id,s.name]),i.supplier_id,{required:true}))+
  field("Data de emissão",input("issue_date",i.issue_date,{type:"date",required:true}))+
  field("Data de entrada",input("entry_date",i.entry_date,{type:"date",required:true}))+
  '<div class="span-2">'+field("Chave de acesso (NF-e)",input("access_key",i.access_key,{inputmode:"numeric",placeholder:"44 dígitos",attrs:'maxlength="54"'}))+'</div>'+
  '<div class="span-2">'+field("Pedido de compra vinculado",select("purchase_order_id",orders.map(o=>[o.id,o.number]).concat(i.purchase_order_id&&!orders.some(o=>o.id===i.purchase_order_id)?[[i.purchase_order_id,"Pedido vinculado"]]:[]),i.purchase_order_id,{placeholder:"Sem pedido"}),"Permite importar os itens e quantidades do pedido.")+'</div>'+
  '<div class="span-2">'+field("Observações",textarea("notes",i.notes,{rows:2}))+'</div></div>',
  onSubmit:async form=>{
   const f=form.elements;
   const key=f.access_key.value.replace(/\D/g,"");
   if(!f.invoice_number.value.trim()||!f.supplier_id.value)throw Error("Informe número e fornecedor.");
   if(f.entry_date.value<f.issue_date.value)throw Error("A data de entrada não pode ser anterior à emissão.");
   if(key&&key.length!==44)throw Error("A chave de acesso deve ter 44 dígitos.");
   const row={invoice_number:f.invoice_number.value.trim(),supplier_id:f.supplier_id.value,issue_date:f.issue_date.value,entry_date:f.entry_date.value,
    access_key:key||null,purchase_order_id:f.purchase_order_id.value||null,notes:f.notes.value.trim()||null};
   if(inv){await update("invoices",inv.id,row,{status:"pending"});toast("Nota atualizada.");ctx.reload()}
   else{const s=await insert("invoices",{...row,store_id:ctx.storeId,status:"pending",created_by:ctx.userId});toast("Nota lançada. Inclua os itens.");ctx.go(ctx.base+"/notas/"+s.id)}
  }});
}

async function detail(ctx,id){
 const [inv,lines,pays,atts,items,suppliers,lastCosts,nfe]=await Promise.all([
  get("invoices",id),list("invoice_items",{eq:{invoice_id:id},order:"created_at",asc:true}),
  list("invoice_payments",{eq:{invoice_id:id},order:"due_date",asc:true}),
  list("invoice_attachments",{eq:{invoice_id:id},order:"created_at",asc:true}).catch(()=>[]),
  loadItems({store:ctx.store}),loadSuppliers(),loadLastCosts(ctx.storeId),
  list("invoice_nfe_items",{eq:{invoice_id:id},order:"seq",asc:true}).catch(()=>[])
 ]);
 if(!ctx.isCurrent())return;
 if(inv.store_id!==ctx.storeId)throw Error("Esta nota pertence a outra loja.");
 const map=byId(items);const editable=inv.status==="pending";
 const supplier=suppliers.find(s=>s.id===inv.supplier_id);
 let order=null;if(inv.purchase_order_id){try{order=await get("purchase_orders",inv.purchase_order_id)}catch{}}
 // Nota vinda de NF-e: os itens da nota saem das linhas da NF-e pelo de-para (automático quando já cadastrado).
 const nfeMode=nfe.length>0;
 const maps=nfeMode?await loadMaps(inv.supplier_id):[];
 if(nfeMode&&editable){
  try{const r=await syncNfe({inv,nfe,lines,maps,storeId:ctx.storeId});lines.splice(0,lines.length,...r.lines)}
  catch(error){toast("Não foi possível aplicar o de-para: "+errorMessage(error),"danger")}
 }
 if(!ctx.isCurrent())return;
 let currentLines=lines;
 const payTotal=()=>round2(pays.reduce((s,p)=>s+Number(p.amount||0),0));
 const itemsTotal=()=>round2(currentLines.reduce((s,l)=>s+Number(l.line_total||0),0));
 ctx.el.innerHTML=backLink(ctx.base+"/notas","Notas fiscais")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Nota nº '+e(inv.invoice_number)+'</h1>'+statusPill(inv.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(supplier?.name||"Sem fornecedor")+'</p></div>'+
  '<div class="page-actions">'+(editable?btn("Editar dados",{variant:"secondary",icon:"edit",attrs:"data-edit"})+btn("Cancelar nota",{variant:"ghost",attrs:"data-cancel"})+btn("Dar entrada no estoque",{variant:"ok",icon:"check",attrs:"data-receive"}):'')+'</div></div>'+
  '<div class="doc-meta"><div><small>Emissão</small><strong>'+dateBR(inv.issue_date)+'</strong></div><div><small>Entrada</small><strong>'+dateBR(inv.entry_date)+'</strong></div>'+
  '<div><small>Pedido vinculado</small><strong>'+(order?'<a href="'+ctx.base+'/pedidos/'+order.id+'">'+e(order.number)+'</a>':"—")+'</strong></div><div><small>Valor dos itens</small><strong data-items-total>'+money(itemsTotal())+'</strong></div></div>'+
  (inv.access_key?'<p class="muted" style="margin:-8px 0 16px;font-size:12px">'+(inv.series?'Série '+e(inv.series)+' · ':'')+'Chave: '+e(inv.access_key)+(inv.origin==="everest"?' · importada do Everest':'')+'</p>':'')+

  (inv.status==="received"?alertBox("Entrada registrada em "+dateBR(inv.received_at)+". Os itens já compõem o estoque da loja.","ok"):'')+
  (nfeMode?nfeItemsCard({inv,nfe,lines,items:map,maps}):card("Itens da nota",'<div data-lines></div>',{flush:true,actions:editable&&order?btn("Importar itens do pedido "+order.number,{variant:"secondary",sm:true,icon:"download",attrs:"data-import"}):''}))+
  '<div class="grid-2">'+card("Pagamentos",'<div data-pays></div>',{flush:true,actions:btn("Parcela",{variant:"secondary",sm:true,icon:"plus",attrs:"data-add-pay"})+btn("Gerar parcelas",{variant:"ghost",sm:true,attrs:"data-gen-pay"})})+
  card("Anexos",'<div data-atts></div>',{flush:true,actions:'<label class="btn btn-secondary btn-sm">'+icon("paperclip",16)+'<span>Anexar</span><input type="file" data-file hidden multiple accept=".pdf,.xml,.jpg,.jpeg,.png"></label>'})+'</div>';

 const linesUI=nfeMode?{lines:currentLines,addMany:async()=>0}:mountLines({el:ctx.el.querySelector("[data-lines]"),table:"invoice_items",parentKey:"invoice_id",parentId:id,extra:{store_id:ctx.storeId},
  lines,items:map,editable,costFor:itemId=>unitCost(itemId,lastCosts,map),emptyText:"Nenhum item lançado nesta nota",
  onChange:ls=>{currentLines=ls;ctx.el.querySelector("[data-items-total]").textContent=money(itemsTotal());drawPays()}});

 const drawPays=()=>{
  const box=ctx.el.querySelector("[data-pays]");
  const diff=round2(itemsTotal()-payTotal());
  box.innerHTML=(pays.length?'<ul class="list-plain">'+pays.map(p=>{const st=payState(p);
   return '<li data-pay="'+e(p.id)+'"><div><span class="label">'+money(p.amount)+'</span><small> · '+e(methodLabel(p.payment_method))+'</small><br><small>Vence '+dateBR(p.due_date)+(p.paid_at?' · pago em '+dateBR(p.paid_at):'')+'</small></div>'+
    '<div style="display:flex;gap:6px;align-items:center">'+statusPill(st)+(st!=="paid"?btn("Pagar",{variant:"secondary",sm:true,attrs:"data-pay-ok"}):'')+'<button class="icon-btn danger" data-pay-del aria-label="Excluir parcela">'+icon("x",16)+'</button></div></li>'}).join("")+'</ul>'
   :emptyState("cash","Nenhuma parcela","Registre as condições de pagamento da nota."))+
   (currentLines.length&&Math.abs(diff)>=0.01?'<div style="padding:0 18px 14px">'+alertBox((diff>0?"Faltam ":"Parcelas excedem em ")+money(Math.abs(diff))+" em relação ao valor dos itens.","warn")+'</div>':'');
  box.querySelectorAll("[data-pay-ok]").forEach(b=>b.onclick=async()=>{
   const pid=b.closest("li").dataset.pay;
   try{const s=await update("invoice_payments",pid,{paid_at:today(),status:PAY.paid});Object.assign(pays.find(p=>p.id===pid),s);toast("Pagamento registrado.");drawPays()}catch(error){toast(errorMessage(error),"danger")}
  });
  box.querySelectorAll("[data-pay-del]").forEach(b=>b.onclick=async()=>{
   const pid=b.closest("li").dataset.pay;
   if(!await confirmDialog({title:"Excluir parcela?",confirmLabel:"Excluir",danger:true}))return;
   try{await remove("invoice_payments",pid);pays.splice(pays.findIndex(p=>p.id===pid),1);drawPays()}catch(error){toast(errorMessage(error),"danger")}
  });
 };
 drawPays();
 const addPay=()=>openDrawer({title:"Nova parcela",body:'<div class="form-grid">'+
  field("Valor (R$)",input("amount",inputNum(Math.max(0,round2(itemsTotal()-payTotal())),2),{inputmode:"decimal",required:true}))+
  field("Vencimento",input("due_date",addDays(inv.issue_date||today(),30),{type:"date",required:true}))+
  '<div class="span-2">'+field("Forma de pagamento",select("payment_method",METHODS,"boleto",{placeholder:false}))+'</div></div>',
  onSubmit:async form=>{const f=form.elements;const a=parseNum(f.amount.value);
   if(!a||Number.isNaN(a))throw Error("Informe um valor maior que zero.");
   const s=await insert("invoice_payments",{invoice_id:id,store_id:ctx.storeId,amount:a,due_date:f.due_date.value,payment_method:f.payment_method.value,status:PAY.pending});
   pays.push(s);pays.sort((x,y)=>String(x.due_date).localeCompare(y.due_date));drawPays();toast("Parcela incluída.")}});
 ctx.el.querySelector("[data-add-pay]").onclick=addPay;
 ctx.el.querySelector("[data-gen-pay]").onclick=()=>openDrawer({title:"Gerar parcelas",body:'<div class="form-grid">'+
  field("Valor total (R$)",input("total",inputNum(itemsTotal(),2),{inputmode:"decimal"}))+field("Número de parcelas",input("n","1",{inputmode:"numeric"}))+
  field("Primeiro vencimento",input("first",addDays(inv.issue_date||today(),30),{type:"date"}))+field("Intervalo (dias)",input("step","30",{inputmode:"numeric"}))+
  '<div class="span-2">'+field("Forma de pagamento",select("payment_method",METHODS,"boleto",{placeholder:false}))+'</div></div>',submitLabel:"Gerar",
  onSubmit:async form=>{const f=form.elements;const total=parseNum(f.total.value),n=parseInt(f.n.value,10),step=parseInt(f.step.value,10);
   if(!total||Number.isNaN(total)||!(n>=1&&n<=48)||!(step>=0))throw Error("Revise valor, parcelas (1 a 48) e intervalo.");
   const base=Math.floor(total*100/n)/100;
   for(let k=0;k<n;k++){
    const amount=k===n-1?round2(total-base*(n-1)):base;
    pays.push(await insert("invoice_payments",{invoice_id:id,store_id:ctx.storeId,amount,due_date:addDays(f.first.value,step*k),payment_method:f.payment_method.value,status:PAY.pending}));
   }
   drawPays();toast(n+" parcela(s) gerada(s).")}});

 // Anexos (Supabase Storage)
 const drawAtts=()=>{
  const box=ctx.el.querySelector("[data-atts]");
  box.innerHTML=atts.length?'<ul class="list-plain">'+atts.map(a=>'<li data-att="'+e(a.id)+'"><div style="display:flex;gap:10px;align-items:center">'+icon("paperclip",16)+'<span class="label">'+e(a.file_name)+'</span></div><div style="display:flex;gap:6px">'+
   btn("Abrir",{variant:"secondary",sm:true,attrs:"data-att-open"})+'<button class="icon-btn danger" data-att-del aria-label="Excluir anexo">'+icon("x",16)+'</button></div></li>').join("")+'</ul>'
   :emptyState("paperclip","Nenhum anexo","Anexe o XML, o PDF da nota ou boletos.");
  box.querySelectorAll("[data-att-open]").forEach(b=>b.onclick=async()=>{
   const a=atts.find(x=>x.id===b.closest("li").dataset.att);
   const {data,error}=await supabase.storage.from(ATTACH_BUCKET).createSignedUrl(a.storage_path,300);
   if(error)return toast(errorMessage(error),"danger");window.open(data.signedUrl,"_blank","noopener");
  });
  box.querySelectorAll("[data-att-del]").forEach(b=>b.onclick=async()=>{
   const a=atts.find(x=>x.id===b.closest("li").dataset.att);
   if(!await confirmDialog({title:"Excluir anexo?",text:a.file_name,confirmLabel:"Excluir",danger:true}))return;
   try{await supabase.storage.from(ATTACH_BUCKET).remove([a.storage_path]);await remove("invoice_attachments",a.id);atts.splice(atts.indexOf(a),1);drawAtts()}catch(error){toast(errorMessage(error),"danger")}
  });
 };
 drawAtts();
 ctx.el.querySelector("[data-file]").addEventListener("change",async ev=>{
  for(const file of ev.target.files){
   if(file.size>15*1024*1024){toast(file.name+": limite de 15 MB.","danger");continue}
   const path=ctx.storeId+"/"+id+"/"+Date.now()+"-"+file.name.replace(/[^\w.\-]+/g,"_");
   const up=await supabase.storage.from(ATTACH_BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream"});
   if(up.error){toast(/bucket not found/i.test(up.error.message)?"O armazenamento de anexos ainda não foi ativado no servidor.":errorMessage(up.error),"danger");continue}
   try{atts.push(await insert("invoice_attachments",{invoice_id:id,store_id:ctx.storeId,file_name:file.name,mime_type:file.type||null,storage_path:path,uploaded_by:ctx.userId}));toast("Anexo enviado.")}
   catch(error){toast(errorMessage(error),"danger")}
  }
  ev.target.value="";drawAtts();
 });

 if(!editable)return;
 ctx.el.querySelector("[data-edit]").onclick=()=>editHeader(ctx,inv,suppliers);
 ctx.el.querySelector("[data-import]")?.addEventListener("click",async()=>{
  const ol=await list("purchase_order_items",{eq:{order_id:order.id}});
  const n=await linesUI.addMany(ol.filter(l=>Number(l.requested_quantity)>0).map(l=>({item_id:l.item_id,quantity:l.requested_quantity,unit_cost:l.unit_cost,line_total:lineTotal(l.requested_quantity,l.unit_cost),purchase_order_item_id:l.id})));
  toast(n?n+" item(ns) importado(s). Confira as quantidades e custos recebidos.":"Os itens do pedido já estão na nota.",n?"ok":"info");
 });
 // Clique no item da NF-e: abre o de-para (cadastrar ou conferir).
 ctx.el.querySelectorAll("tr[data-nfe]").forEach(tr=>{
  const open=()=>openNfeDepara({inv,line:nfe.find(l=>l.id===tr.dataset.nfe),supplier,maps,items,onSaved:()=>ctx.reload()});
  tr.addEventListener("click",open);tr.addEventListener("keydown",ev=>{if(ev.key==="Enter")open()});
 });
 ctx.el.querySelector("[data-receive]")?.addEventListener("click",ev=>{
  const miss=nfe.filter(l=>!l.invoice_item_id).length;
  if(nfeMode&&miss){ev.stopImmediatePropagation();toast("Faça o de-para de "+miss+" item(ns) antes de dar entrada no estoque.","danger")}
 },{capture:true});
 ctx.el.querySelector("[data-receive]").onclick=async()=>{
  if(nfeMode&&nfe.some(l=>!l.invoice_item_id))return;
  if(!linesUI.lines.length)return toast("Inclua os itens antes de dar entrada.","danger");
  const diff=round2(itemsTotal()-payTotal());
  if(!await confirmDialog({title:"Dar entrada da nota "+inv.invoice_number+"?",text:"Os "+linesUI.lines.length+" itens ("+money(itemsTotal())+") entrarão no estoque da loja e a nota ficará bloqueada para edição."+(pays.length&&Math.abs(diff)>=0.01?" Atenção: as parcelas não fecham com o valor dos itens.":""),confirmLabel:"Dar entrada"}))return;
  try{await update("invoices",id,{status:"received",received_at:new Date().toISOString(),received_by:ctx.userId},{status:"pending"});toast("Entrada registrada no estoque.");ctx.reload()}
  catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-cancel]").onclick=async()=>{
  if(!await confirmDialog({title:"Cancelar nota?",text:"A nota ficará cancelada e não afetará o estoque.",confirmLabel:"Cancelar nota",danger:true}))return;
  try{await update("invoices",id,{status:"cancelled"},{status:"pending"});toast("Nota cancelada.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 };
}
export {num};

