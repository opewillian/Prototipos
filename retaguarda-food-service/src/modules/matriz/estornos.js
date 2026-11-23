// Matriz · Estorno de notas. Lista as notas RECEBIDAS de todas as lojas para estornar (só administrador da Matriz)
// e o histórico de estornos (invoice_reversals). O estorno em si: ../shared/estorno.js.
import {list} from "../../core/db.js";
import {e,money,dateBR} from "../../core/format.js";
import {pageHead,btn,dataTable,card,emptyState,searchKey,alertBox} from "../../core/ui.js";
import {filterBar,bindFilters} from "../../core/filters.js";
import {loadSuppliers,byId} from "../shared/catalog.js";
import {canReverse,reverseInvoiceDialog} from "../shared/estorno.js";

export async function render(ctx){
 if(!canReverse(ctx.app)){ctx.el.innerHTML=pageHead("Estorno de notas")+alertBox("Somente administradores da Matriz podem estornar notas.","warn");return}
 const [invoices,revs,suppliers,users]=await Promise.all([
  list("invoices",{eq:{status:"received"},order:"entry_date"}),
  list("invoice_reversals",{order:"reversed_at"}).catch(()=>[]),
  loadSuppliers(),
  list("user_profiles",{select:"user_id,display_name"}).catch(()=>[])
 ]);
 if(!ctx.isCurrent())return;
 const sup=byId(suppliers);const stores=new Map(ctx.app.stores.map(s=>[s.id,s.name]));
 const uname=id=>users.find(u=>u.user_id===id)?.display_name||"Usuário";
 const storeOpts=[...new Set(invoices.map(i=>i.store_id))].map(id=>[id,stores.get(id)||id]).sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
 ctx.el.innerHTML=pageHead("Estorno de notas","Notas já recebidas que precisam ser corrigidas: o estorno tira a entrada do estoque e devolve a nota para pendente.")+
  (invoices.length?filterBar({search:"Número ou fornecedor",selects:[{key:"st",all:"Todas as lojas",options:storeOpts}],dates:true,noun:["nota","notas"]}):'')+
  '<section class="card">'+(invoices.length?dataTable([
   {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)?.name||"Sem fornecedor")+'</small>'},
   {label:"Loja",render:i=>e(stores.get(i.store_id)||i.store_id)},
   {label:"Entrada",render:i=>dateBR(i.entry_date)},
   {label:"Recebida em",render:i=>i.received_at?dateBR(String(i.received_at).slice(0,10)):'—'},
   {label:"Valor",cls:"num",render:i=>i.total_amount!=null?money(i.total_amount):'—'},
   {label:"",cls:"act",render:i=>btn("Abrir",{variant:"ghost",sm:true,href:"#/loja/"+encodeURIComponent(i.store_id)+"/notas/"+i.id})+' '+btn("Estornar",{variant:"secondary",sm:true,attrs:'data-rev="'+e(i.id)+'"'})}
  ],invoices,{rowAttrs:i=>'data-search="'+e(searchKey(i.invoice_number,sup.get(i.supplier_id)?.name||""))+'" data-st="'+e(i.store_id)+'" data-date="'+e(i.entry_date||"")+'" data-total="'+e(i.total_amount||0)+'"'}).replace('class="table"','class="table stack"')
  :emptyState("receipt","Nenhuma nota recebida","Quando uma loja der entrada numa nota, ela aparece aqui para estorno, se precisar."))+'</section>'+
  card("Histórico de estornos",revs.length?dataTable([
   {label:"Quando",render:r=>dateBR(String(r.reversed_at).slice(0,10))+'<small class="sub">'+e(uname(r.reversed_by))+'</small>'},
   {label:"Nota",render:r=>'<a href="#/loja/'+encodeURIComponent(r.store_id)+'/notas/'+e(r.invoice_id)+'">Nº '+e(r.invoice_number||"")+'</a><small class="sub">'+e(stores.get(r.store_id)||r.store_id)+'</small>'},
   {label:"Motivo",render:r=>e(r.reason)},
   {label:"Saiu do estoque",cls:"num",render:r=>money(r.total_value||0)+'<small class="sub">'+(Array.isArray(r.movements)?r.movements.length:0)+' movimento(s)</small>'}
  ],revs):'<p class="muted" style="padding:14px 18px;margin:0">Nenhum estorno feito.</p>',{flush:true});
 if(invoices.length)bindFilters(ctx.el,{noun:["nota","notas"]});
 ctx.el.querySelectorAll("[data-rev]").forEach(b=>b.onclick=()=>{
  const inv=invoices.find(i=>i.id===b.dataset.rev);
  reverseInvoiceDialog({inv,storeName:stores.get(inv.store_id)||inv.store_id,supplierName:sup.get(inv.supplier_id)?.name,onDone:()=>ctx.reload()});
 });
}
