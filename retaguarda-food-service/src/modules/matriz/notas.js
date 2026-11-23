// Matriz · Notas fiscais. Todas as notas de todas as lojas (pendentes, recebidas e canceladas), com filtros,
// atalho para abrir a nota na loja e ESTORNO das recebidas (só administrador da Matriz; ver ../shared/estorno.js).
// Embaixo, o histórico de estornos (invoice_reversals).
import {list} from "../../core/db.js";
import {e,money,dateBR,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,card,kpi,emptyState,searchKey,alertBox,statusPill} from "../../core/ui.js";
import {filterBar,bindFilters} from "../../core/filters.js";
import {loadSuppliers,byId} from "../shared/catalog.js";
import {canReverse,reverseInvoiceDialog} from "../shared/estorno.js";

export async function render(ctx){
 if(!canReverse(ctx.app)){ctx.el.innerHTML=pageHead("Notas fiscais")+alertBox("Somente administradores da Matriz podem ver as notas de todas as lojas.","warn");return}
 const [invoices,lines,revs,suppliers,users]=await Promise.all([
  list("invoices",{order:"entry_date"}),
  list("invoice_items",{select:"invoice_id,line_total"}).catch(()=>[]),
  list("invoice_reversals",{order:"reversed_at"}).catch(()=>[]),
  loadSuppliers(),
  list("user_profiles",{select:"user_id,display_name"}).catch(()=>[])
 ]);
 if(!ctx.isCurrent())return;
 const sup=byId(suppliers);const stores=new Map(ctx.app.stores.map(s=>[s.id,s.name]));
 const uname=id=>users.find(u=>u.user_id===id)?.display_name||"Usuário";
 const sumLines=new Map();for(const l of lines)sumLines.set(l.invoice_id,(sumLines.get(l.invoice_id)||0)+Number(l.line_total||0));
 const value=i=>i.total_amount!=null?Number(i.total_amount):round2(sumLines.get(i.id)||0);
 const revCount=new Map();for(const r of revs)revCount.set(r.invoice_id,(revCount.get(r.invoice_id)||0)+1);
 const storeOpts=[...new Set(invoices.map(i=>i.store_id))].map(id=>[id,stores.get(id)||id]).sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
 const supOpts=[...new Set(invoices.map(i=>i.supplier_id).filter(Boolean))].map(id=>[id,sup.get(id)?.name||"Fornecedor"]).sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
 const by=st=>invoices.filter(i=>i.status===st);
 ctx.el.innerHTML=pageHead("Notas fiscais","Todas as notas lançadas nas lojas. Notas recebidas podem ser estornadas para correção: a entrada sai do estoque e a nota volta para pendente.")+
  '<div class="kpis">'+kpi("Notas",invoices.length,storeOpts.length+" loja(s)",{icon:"receipt"})+
  kpi("Pendentes",by("pending").length,money(round2(by("pending").reduce((s,i)=>s+value(i),0))),{icon:"box",tone:"warn"})+
  kpi("Recebidas",by("received").length,money(round2(by("received").reduce((s,i)=>s+value(i),0))),{icon:"check",tone:"ok"})+
  kpi("Estornos feitos",revs.length,revs.length?"último em "+dateBR(String(revs[0].reversed_at).slice(0,10)):"",{icon:"undo",tone:"info"})+'</div>'+
  (invoices.length?filterBar({search:"Número, fornecedor ou chave",selects:[
   {key:"loja",all:"Todas as lojas",options:storeOpts},
   {key:"st",all:"Todas as situações",options:[["pending","Pendentes"],["received","Recebidas"],["cancelled","Canceladas"]]},
   {key:"sup",all:"Todos os fornecedores",options:supOpts}],dates:true,noun:["nota","notas"]}):'')+
  (invoices.length?'<p class="muted" style="margin:-6px 0 10px;font-size:13px"><span data-fcount></span> · <span data-fsum></span> · datas pela entrada</p>':'')+
  '<section class="card">'+(invoices.length?dataTable([
   {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)?.name||"Sem fornecedor")+'</small>'},
   {label:"Loja",render:i=>e(stores.get(i.store_id)||i.store_id)},
   {label:"Emissão",render:i=>dateBR(i.issue_date)},
   {label:"Entrada",render:i=>dateBR(i.entry_date)},
   {label:"Valor",cls:"num",render:i=>money(value(i))},
   {label:"Situação",render:i=>statusPill(i.status)+(revCount.get(i.id)?'<small class="sub">estornada '+revCount.get(i.id)+'×</small>':'')},
   {label:"",cls:"act",render:i=>btn("Abrir",{variant:"ghost",sm:true,href:"#/loja/"+encodeURIComponent(i.store_id)+"/notas/"+i.id})+
     (i.status==="received"?' '+btn("Estornar",{variant:"secondary",sm:true,icon:"undo",attrs:'data-rev="'+e(i.id)+'"'}):'')}
  ],invoices,{rowAttrs:i=>'data-search="'+e(searchKey(i.invoice_number,sup.get(i.supplier_id)?.name||"",i.access_key||""))+'" data-loja="'+e(i.store_id)+'" data-st="'+e(i.status)+'" data-sup="'+e(i.supplier_id||"")+'" data-date="'+e(i.entry_date||"")+'" data-total="'+e(value(i))+'"'}).replace('class="table"','class="table stack"')
  :emptyState("receipt","Nenhuma nota lançada","As notas lançadas nas lojas aparecem aqui."))+'</section>'+
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
