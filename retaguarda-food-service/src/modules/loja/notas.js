// Loja · Notas fiscais de entrada: cabeçalho, itens, parcelas, anexos e recebimento.
// Receber a nota gera a entrada no estoque da loja (gatilho do banco) e bloqueia edições.
import {list,get,insert,update,remove,supabase} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,dateBR,today,addDays,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,openDrawer,field,input,select,textarea,toast,confirmDialog,statusPill,emptyState,backLink,errorMessage,card,kpi,searchBox,searchKey,alertBox} from "../../core/ui.js";
import {loadItems,loadSuppliers,byId,loadLastCosts,unitCost,lineTotal} from "../shared/catalog.js";
import {mountLines} from "../shared/doclines.js";
import {loadMaps,syncNfe,nfeItemsCard,openNfeDepara,otherCostsCard,bindOtherCosts,costsTotal} from "../shared/nfe.js";
import {canReverse,reverseInvoiceDialog} from "../shared/estorno.js";

export const ATTACH_BUCKET="retaguarda-anexos";
const PAY={pending:"pending",paid:"paid"};
const METHODS=[["boleto","Boleto"],["pix","PIX"],["transferencia","Transferência"],["cartao","Cartão"],["dinheiro","Dinheiro"],["cheque","Cheque"]];
const methodLabel=m=>(METHODS.find(x=>x[0]===m)||[,m||"—"])[1];
// Tipo do anexo da parcela (invoice_attachments.doc_type).
const DOC_TYPES=[["boleto","Boleto"],["comprovante","Comprovante de pagamento"],["nota","Nota / fatura"],["outro","Outro"]];
const docLabel=t=>(DOC_TYPES.find(x=>x[0]===t)||[,"Anexo"])[1];
const safeName=n=>String(n).replace(/[^\w.\-]+/g,"_");
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
 ctx.el.innerHTML=pageHead("Notas fiscais","Entradas de mercadoria, pagamentos e anexos da loja.",btn("Lançar nota",{icon:"plus",attrs:"data-new"}))+
  '<section class="card">'+(invoices.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Número ou fornecedor")+
   '<select class="control" id="f-st"><option value="">Todas</option><option value="pending">Pendentes</option><option value="received">Recebidas</option><option value="cancelled">Canceladas</option></select></div>'+dataTable([
   {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)?.name||"Sem fornecedor")+'</small>'},
   {label:"Emissão",render:i=>dateBR(i.issue_date)},{label:"Entrada",render:i=>dateBR(i.entry_date)},
   {label:"Valor",cls:"num",render:i=>money(i.total_amount!=null?i.total_amount:tot(i.id))},
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
 const [inv,lines,pays,atts,items,suppliers,lastCosts,nfe,costs,revs]=await Promise.all([
  get("invoices",id),list("invoice_items",{eq:{invoice_id:id},order:"created_at",asc:true}),
  list("invoice_payments",{eq:{invoice_id:id},order:"due_date",asc:true}),
  list("invoice_attachments",{eq:{invoice_id:id},order:"created_at",asc:true}).catch(()=>[]),
  loadItems({store:ctx.store}),loadSuppliers(),loadLastCosts(ctx.storeId),
  list("invoice_nfe_items",{eq:{invoice_id:id},order:"seq",asc:true}).catch(()=>[]),
  list("invoice_other_costs",{eq:{invoice_id:id},order:"created_at",asc:true}).catch(()=>[]),
  list("invoice_reversals",{eq:{invoice_id:id},order:"reversed_at"}).catch(()=>[])
 ]);
 const adj=costsTotal(costs);
 if(!ctx.isCurrent())return;
 if(inv.store_id!==ctx.storeId)throw Error("Esta nota pertence a outra loja.");
 const map=byId(items);const editable=inv.status==="pending";
 const supplier=suppliers.find(s=>s.id===inv.supplier_id);
 let order=null;if(inv.purchase_order_id){try{order=await get("purchase_orders",inv.purchase_order_id)}catch{}}
 // Nota vinda de NF-e: os itens da nota saem das linhas da NF-e pelo de-para (automático quando já cadastrado).
 const nfeMode=nfe.length>0;
 const maps=nfeMode?await loadMaps(inv.supplier_id):[];
 if(nfeMode&&editable){
  try{const r=await syncNfe({inv,nfe,lines,maps,storeId:ctx.storeId,adj});lines.splice(0,lines.length,...r.lines)}
  catch(error){toast("Não foi possível aplicar o de-para: "+errorMessage(error),"danger")}
 }
 if(!ctx.isCurrent())return;
 let currentLines=lines;
 const payTotal=()=>round2(pays.reduce((s,p)=>s+Number(p.amount||0),0));
 // Nota de NF-e: valor dos itens = soma de todas as linhas da NF-e (com ou sem de-para).
 const itemsSum=()=>round2(nfeMode?nfe.reduce((s,l)=>s+Number(l.total||0),0):currentLines.reduce((s,l)=>s+Number(l.line_total||0),0));
 // Total da nota = itens + outros custos (desconto abate; frete, seguro, despesas, IPI, ST somam).
 const itemsTotal=()=>round2(itemsSum()+adj);
 ctx.el.innerHTML=backLink(ctx.base+"/notas","Notas fiscais")+
  '<div class="doc-head"><div><div class="doc-title"><h1>Nota nº '+e(inv.invoice_number)+'</h1>'+statusPill(inv.status)+'</div><p class="muted" style="margin:6px 0 0">'+e(supplier?.name||"Sem fornecedor")+'</p></div>'+
  '<div class="page-actions">'+(editable?btn("Editar dados",{variant:"secondary",icon:"edit",attrs:"data-edit"})+btn("Cancelar nota",{variant:"ghost",attrs:"data-cancel"})+btn("Dar entrada no estoque",{variant:"ok",icon:"check",attrs:"data-receive"}):'')+
   // Estorno: só administrador da Matriz, em nota recebida (tira do estoque e volta para pendente).
   (inv.status==="received"&&canReverse(ctx.app)?btn("Estornar nota",{variant:"secondary",icon:"undo",attrs:"data-reverse"}):'')+'</div></div>'+
  '<div class="doc-meta"><div><small>Emissão</small><strong>'+dateBR(inv.issue_date)+'</strong></div><div><small>Entrada</small><strong>'+dateBR(inv.entry_date)+'</strong></div>'+
  '<div><small>Pedido vinculado</small><strong>'+(order?'<a href="'+ctx.base+'/pedidos/'+order.id+'">'+e(order.number)+'</a>':"—")+'</strong></div><div><small>Total da nota</small><strong data-items-total>'+money(itemsTotal())+'</strong></div></div>'+
  (inv.access_key?'<p class="muted" style="margin:-8px 0 16px;font-size:12px">'+(inv.series?'Série '+e(inv.series)+' · ':'')+'Chave: '+e(inv.access_key)+(inv.origin==="everest"?' · importada do Everest':'')+'</p>':'')+

  (revs.length&&inv.status==="pending"?alertBox("Nota estornada em "+dateBR(String(revs[0].reversed_at).slice(0,10))+": "+revs[0].reason+". Corrija e dê entrada de novo.","warn"):'')+
  (inv.status==="received"?alertBox("Entrada registrada em "+dateBR(inv.received_at)+". Os itens já compõem o estoque da loja.","ok"):'')+
  (nfeMode?nfeItemsCard({inv,nfe,lines,items:map,maps}):card("Itens da nota",'<div data-lines></div>',{flush:true,actions:editable&&order?btn("Importar itens do pedido "+order.number,{variant:"secondary",sm:true,icon:"download",attrs:"data-import"}):''}))+
  otherCostsCard({inv,costs,itemsSum:itemsSum(),editable,nfeMode})+
  '<div class="grid-2">'+card("Pagamentos",'<div data-pays></div>',{flush:true,actions:btn("Parcela",{variant:"secondary",sm:true,icon:"plus",attrs:"data-add-pay"})+btn("Gerar parcelas",{variant:"ghost",sm:true,attrs:"data-gen-pay"})})+
  card("Anexos",'<div data-atts></div>',{flush:true,actions:'<label class="btn btn-secondary btn-sm">'+icon("paperclip",16)+'<span>Anexar</span><input type="file" data-file hidden multiple accept=".pdf,.xml,.jpg,.jpeg,.png"></label>'})+'</div>';

 const linesUI=nfeMode?{lines:currentLines,addMany:async()=>0}:mountLines({el:ctx.el.querySelector("[data-lines]"),table:"invoice_items",parentKey:"invoice_id",parentId:id,extra:{store_id:ctx.storeId},
  lines,items:map,editable,costFor:itemId=>unitCost(itemId,lastCosts,map),emptyText:"Nenhum item lançado nesta nota",
  onChange:ls=>{currentLines=ls;ctx.el.querySelector("[data-items-total]").textContent=money(itemsTotal());drawPays()}});

 const drawPays=()=>{
  const box=ctx.el.querySelector("[data-pays]");
  const diff=round2(itemsTotal()-payTotal());
  box.innerHTML=(pays.length?'<ul class="list-plain">'+pays.map(p=>{const st=payState(p);
   const pa=atts.filter(a=>a.payment_id===p.id);
   return '<li data-pay="'+e(p.id)+'" class="pay-item"><div class="pay-main"><div><span class="label">'+money(p.amount)+'</span><small> · '+e(methodLabel(p.payment_method))+'</small><br><small>Vence '+dateBR(p.due_date)+(p.paid_at?' · pago em '+dateBR(p.paid_at):'')+'</small></div>'+
    '<div style="display:flex;gap:6px;align-items:center">'+statusPill(st)+(st!=="paid"?btn("Pagar",{variant:"secondary",sm:true,attrs:"data-pay-ok"}):'')+'<button class="icon-btn danger" data-pay-del aria-label="Excluir parcela">'+icon("x",16)+'</button></div></div>'+
    // Anexos da parcela (boleto, comprovante...): base para a visão de parcelas do financeiro.
    '<div class="pay-atts">'+pa.map(a=>'<span class="pay-att" data-att="'+e(a.id)+'">'+icon("paperclip",13)+'<button type="button" class="link-btn" data-att-open title="Abrir '+e(a.file_name)+'"><b>'+e(docLabel(a.doc_type))+'</b> '+e(a.file_name)+'</button><button type="button" class="icon-btn danger sm" data-att-del aria-label="Excluir anexo">'+icon("x",12)+'</button></span>').join("")+
    '<button type="button" class="pay-att-add'+(pa.length?'':' warn')+'" data-pay-att>'+icon("plus",13)+' '+(pa.length?'Anexar':(st==="paid"?'Anexar comprovante':'Anexar boleto'))+'</button></div></li>'}).join("")+'</ul>'
   :emptyState("cash","Nenhuma parcela","Registre as condições de pagamento da nota."))+
   (currentLines.length&&Math.abs(diff)>=0.01?'<div style="padding:0 18px 14px">'+alertBox((diff>0?"Faltam ":"Parcelas excedem em ")+money(Math.abs(diff))+" em relação ao valor dos itens.","warn")+'</div>':'');
  box.querySelectorAll("[data-pay-ok]").forEach(b=>b.onclick=async()=>{
   const pid=b.closest("li").dataset.pay;
   try{const s=await update("invoice_payments",pid,{paid_at:today(),status:PAY.paid});Object.assign(pays.find(p=>p.id===pid),s);toast("Pagamento registrado.");drawPays()}catch(error){toast(errorMessage(error),"danger")}
  });
  box.querySelectorAll("[data-pay-del]").forEach(b=>b.onclick=async()=>{
   const pid=b.closest("li").dataset.pay;const pa=atts.filter(a=>a.payment_id===pid);
   if(!await confirmDialog({title:"Excluir parcela?",text:pa.length?"Os "+pa.length+" anexo(s) desta parcela também serão excluídos.":"",confirmLabel:"Excluir",danger:true}))return;
   try{
    if(pa.length)await supabase.storage.from(ATTACH_BUCKET).remove(pa.map(a=>a.storage_path));
    await remove("invoice_payments",pid);pays.splice(pays.findIndex(p=>p.id===pid),1);
    for(const a of pa)atts.splice(atts.indexOf(a),1);drawPays();
   }catch(error){toast(errorMessage(error),"danger")}
  });
  box.querySelectorAll("[data-pay-att]").forEach(b=>b.onclick=()=>{
   const p=pays.find(x=>x.id===b.closest("li").dataset.pay);const paid=payState(p)==="paid";
   openDrawer({title:"Anexar na parcela de "+money(p.amount),submitLabel:"Enviar",body:'<div class="form-grid">'+
    '<div class="span-2">'+field("Tipo do documento",select("doc_type",DOC_TYPES,paid?"comprovante":"boleto",{placeholder:false}))+'</div>'+
    '<div class="span-2">'+field("Arquivo",'<input class="control" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.xml" required>',"PDF ou imagem, até 15 MB.")+'</div>'+
    '<p class="muted span-2" style="margin:0">Parcela com vencimento em '+dateBR(p.due_date)+' · '+e(methodLabel(p.payment_method))+'</p></div>',
    onSubmit:async form=>{const f=form.elements;const file=f.file.files[0];
     if(!file)throw Error("Escolha o arquivo.");if(file.size>15*1024*1024)throw Error("Limite de 15 MB por arquivo.");
     const path=ctx.storeId+"/"+id+"/parcela-"+p.id+"/"+Date.now()+"-"+safeName(file.name);
     const up=await supabase.storage.from(ATTACH_BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream"});
     if(up.error)throw Error(errorMessage(up.error));
     try{atts.push(await insert("invoice_attachments",{invoice_id:id,store_id:ctx.storeId,payment_id:p.id,doc_type:f.doc_type.value,file_name:file.name,mime_type:file.type||null,byte_size:file.size,storage_path:path,uploaded_by:ctx.userId}))}
     catch(error){await supabase.storage.from(ATTACH_BUCKET).remove([path]);throw error}
     toast(docLabel(f.doc_type.value)+" anexado à parcela.");drawPays();
    }});
  });
  bindAttActions(box,drawPays);
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
 function bindAttActions(box,redraw){
  box.querySelectorAll("[data-att-open]").forEach(b=>b.onclick=async()=>{
   const a=atts.find(x=>x.id===b.closest("[data-att]").dataset.att);
   const {data,error}=await supabase.storage.from(ATTACH_BUCKET).createSignedUrl(a.storage_path,300);
   if(error)return toast(errorMessage(error),"danger");window.open(data.signedUrl,"_blank","noopener");
  });
  box.querySelectorAll("[data-att-del]").forEach(b=>b.onclick=async()=>{
   const a=atts.find(x=>x.id===b.closest("[data-att]").dataset.att);
   if(!await confirmDialog({title:"Excluir anexo?",text:a.file_name,confirmLabel:"Excluir",danger:true}))return;
   try{await supabase.storage.from(ATTACH_BUCKET).remove([a.storage_path]);await remove("invoice_attachments",a.id);atts.splice(atts.indexOf(a),1);redraw()}catch(error){toast(errorMessage(error),"danger")}
  });
 }
 const drawAtts=()=>{
  const box=ctx.el.querySelector("[data-atts]");const noteAtts=atts.filter(a=>!a.payment_id);
  box.innerHTML=noteAtts.length?'<ul class="list-plain">'+noteAtts.map(a=>'<li data-att="'+e(a.id)+'"><div style="display:flex;gap:10px;align-items:center">'+icon("paperclip",16)+'<span class="label">'+e(a.file_name)+'</span></div><div style="display:flex;gap:6px">'+
   btn("Abrir",{variant:"secondary",sm:true,attrs:"data-att-open"})+'<button class="icon-btn danger" data-att-del aria-label="Excluir anexo">'+icon("x",16)+'</button></div></li>').join("")+'</ul>'
   :emptyState("paperclip","Nenhum anexo","Anexe o XML ou o PDF da nota. Boletos e comprovantes vão na própria parcela.");
  bindAttActions(box,drawAtts);
 };
 drawAtts();
 ctx.el.querySelector("[data-file]").addEventListener("change",async ev=>{
  for(const file of ev.target.files){
   if(file.size>15*1024*1024){toast(file.name+": limite de 15 MB.","danger");continue}
   const path=ctx.storeId+"/"+id+"/"+Date.now()+"-"+safeName(file.name);
   const up=await supabase.storage.from(ATTACH_BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream"});
   if(up.error){toast(/bucket not found/i.test(up.error.message)?"O armazenamento de anexos ainda não foi ativado no servidor.":errorMessage(up.error),"danger");continue}
   try{atts.push(await insert("invoice_attachments",{invoice_id:id,store_id:ctx.storeId,file_name:file.name,mime_type:file.type||null,byte_size:file.size,storage_path:path,uploaded_by:ctx.userId}));toast("Anexo enviado.")}
   catch(error){toast(errorMessage(error),"danger")}
  }
  ev.target.value="";drawAtts();
 });

 ctx.el.querySelector("[data-reverse]")?.addEventListener("click",()=>reverseInvoiceDialog({inv,storeName:ctx.store?.name||"",supplierName:supplier?.name,onDone:()=>ctx.reload()}));
 if(!editable)return;
 ctx.el.querySelector("[data-edit]").onclick=()=>editHeader(ctx,inv,suppliers);
 ctx.el.querySelector("[data-import]")?.addEventListener("click",async()=>{
  const ol=await list("purchase_order_items",{eq:{order_id:order.id}});
  const n=await linesUI.addMany(ol.filter(l=>Number(l.requested_quantity)>0).map(l=>({item_id:l.item_id,quantity:l.requested_quantity,unit_cost:l.unit_cost,line_total:lineTotal(l.requested_quantity,l.unit_cost),purchase_order_item_id:l.id})));
  toast(n?n+" item(ns) importado(s). Confira as quantidades e custos recebidos.":"Os itens do pedido já estão na nota.",n?"ok":"info");
 });
 if(editable)bindOtherCosts({root:ctx.el,inv,costs,itemsSum:itemsSum(),storeId:ctx.storeId,onChange:()=>ctx.reload()});
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

