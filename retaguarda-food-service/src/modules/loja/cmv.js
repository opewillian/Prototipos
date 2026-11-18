// Loja · CMV por período entre duas contagens finalizadas.
// CMV = estoque inicial + compras recebidas + transferências recebidas − transferências enviadas − estoque final.
// Só itens marcados "compõe CMV". Perdas já reduziram o estoque final: são mostradas à parte, sem subtrair de novo.
import {list,get,insert,insertMany} from "../../core/db.js";
import {e,money,num,dateBR,dateTimeBR,round2,pct} from "../../core/format.js";
import {pageHead,btn,dataTable,openDrawer,field,select,toast,emptyState,backLink,errorMessage,card,kpi,alertBox,searchBox,searchKey} from "../../core/ui.js";
import {loadItems,byId} from "../shared/catalog.js";

export async function computeCMV(storeId,startId,endId){
 const [c1,c2,items]=await Promise.all([get("stock_counts",startId),get("stock_counts",endId),loadItems()]);
 if(c1.store_id!==storeId||c2.store_id!==storeId)throw Error("Contagens de outra loja.");
 if(c1.status!=="finalized"||c2.status!=="finalized")throw Error("Use apenas contagens finalizadas.");
 if(String(c2.count_date)<=String(c1.count_date))throw Error("A contagem final deve ser posterior à inicial.");
 const map=byId(items);const cmvItem=id=>map.get(id)?.composes_cmv!==false;
 const [l1,l2,invs,trs,losses]=await Promise.all([
  list("stock_count_items",{eq:{count_id:startId}}),list("stock_count_items",{eq:{count_id:endId}}),
  list("invoices",{select:"id,invoice_number,entry_date",eq:{store_id:storeId,status:"received"},gt:{entry_date:c1.count_date},lte:{entry_date:c2.count_date}}),
  list("transfers",{select:"id,number,from_store_id,to_store_id,issued_at",eq:{status:"issued"},or:"from_store_id.eq."+storeId+",to_store_id.eq."+storeId,gt:{issued_at:c1.finalized_at},lte:{issued_at:c2.finalized_at}}),
  list("losses",{select:"id,loss_date,reason",eq:{store_id:storeId,status:"recorded"},gt:{loss_date:c1.count_date},lte:{loss_date:c2.count_date}})
 ]);
 const [invLines,trLines,lossLines]=await Promise.all([
  list("invoice_items",{in:{invoice_id:invs.map(i=>i.id)}}),list("transfer_items",{in:{transfer_id:trs.map(t=>t.id)}}),list("loss_items",{in:{loss_id:losses.map(l=>l.id)}})
 ]);
 const rows=new Map();
 const row=id=>rows.get(id)||rows.set(id,{item_id:id,oq:0,ov:0,pq:0,pv:0,tiq:0,tiv:0,toq:0,tov:0,lq:0,lv:0,cq:0,cv:0}).get(id);
 for(const l of l1)if(cmvItem(l.item_id)){const r=row(l.item_id);r.oq+=Number(l.counted_quantity);r.ov+=Number(l.line_total)}
 for(const l of l2)if(cmvItem(l.item_id)){const r=row(l.item_id);r.cq+=Number(l.counted_quantity);r.cv+=Number(l.line_total)}
 for(const l of invLines)if(cmvItem(l.item_id)){const r=row(l.item_id);r.pq+=Number(l.quantity);r.pv+=Number(l.line_total)}
 const trDir=new Map(trs.map(t=>[t.id,t.to_store_id===storeId?"in":"out"]));
 for(const l of trLines)if(cmvItem(l.item_id)){const r=row(l.item_id);if(trDir.get(l.transfer_id)==="in"){r.tiq+=Number(l.quantity);r.tiv+=Number(l.line_total)}else{r.toq+=Number(l.quantity);r.tov+=Number(l.line_total)}}
 for(const l of lossLines)if(cmvItem(l.item_id)){const r=row(l.item_id);r.lq+=Number(l.quantity);r.lv+=Number(l.line_total)}
 const list2=[...rows.values()].map(r=>({...r,item:map.get(r.item_id)||{name:"Item"},cmv:round2(r.ov+r.pv+r.tiv-r.tov-r.cv)}))
  .sort((a,b)=>b.cmv-a.cmv);
 const sum=k=>round2(list2.reduce((s,r)=>s+r[k],0));
 const t={opening:sum("ov"),purchases:sum("pv"),tin:sum("tiv"),tout:sum("tov"),losses:sum("lv"),closing:sum("cv")};
 t.cmv=round2(t.opening+t.purchases+t.tin-t.tout-t.closing);
 return {c1,c2,rows:list2,totals:t,docs:{invs,trs,losses},days:Math.round((new Date(c2.count_date)-new Date(c1.count_date))/86400000)};
}

export async function render(ctx){
 if(ctx.params[0]==="novo")return preview(ctx,ctx.params[1],ctx.params[2]);
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [closings,counts]=await Promise.all([
  list("cmv_closings",{eq:{store_id:ctx.storeId},order:"end_date"}),
  list("stock_counts",{select:"id,display_id,count_date",eq:{store_id:ctx.storeId,status:"finalized"},order:"count_date"})
 ]);
 if(!ctx.isCurrent())return;
 const last=closings[0];
 const avg=closings.length?round2(closings.reduce((s,c)=>s+Number(c.cmv_value||0),0)/closings.length):0;
 ctx.el.innerHTML=pageHead("CMV","Custo da mercadoria consumida entre duas contagens, com memória de cálculo por item.",btn("Novo fechamento",{icon:"plus",attrs:"data-new",disabled:counts.length<2}))+
  '<div class="kpis">'+kpi("Último CMV",last?money(last.cmv_value):"—",last?dateBR(last.start_date)+" a "+dateBR(last.end_date):"Nenhum fechamento",{icon:"chart"})+
  kpi("Média dos fechamentos",closings.length?money(avg):"—",closings.length+" fechamento(s)",{icon:"layers",tone:"info"})+
  kpi("Perdas no último período",last?money(last.eligible_losses):"—",last&&Number(last.cmv_value)?pct(Number(last.eligible_losses)/Number(last.cmv_value))+" do CMV":"",{icon:"trash",tone:"warn"})+
  kpi("Contagens disponíveis",counts.length,"finalizadas",{icon:"clipboard",tone:"ok"})+'</div>'+
  (counts.length<2?alertBox("São necessárias duas contagens finalizadas para fechar o CMV de um período.","info"):'')+
  '<section class="card">'+(closings.length?dataTable([
   {label:"Período",render:c=>'<span class="strong">'+dateBR(c.start_date)+' a '+dateBR(c.end_date)+'</span>'},
   {label:"Estoque inicial",cls:"num",render:c=>money(c.opening_stock)},{label:"Compras",cls:"num",render:c=>money(c.eligible_purchases)},
   {label:"Estoque final",cls:"num",render:c=>money(c.closing_stock)},{label:"Perdas",cls:"num",render:c=>money(c.eligible_losses)},
   {label:"CMV",cls:"num",render:c=>'<strong>'+money(c.cmv_value)+'</strong>'}
  ],closings,{rowHref:c=>ctx.base+"/cmv/"+c.id}).replace('class="table"','class="table stack"'):emptyState("chart","Nenhum fechamento de CMV","Feche o primeiro período escolhendo a contagem inicial e a final."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelector("[data-new]")?.addEventListener("click",()=>{
  const opts=counts.map(c=>[c.id,c.display_id+" · "+dateBR(c.count_date)]);
  openDrawer({title:"Novo fechamento de CMV",submitLabel:"Calcular",body:'<div class="form-grid">'+
   '<div class="span-2">'+field("Contagem inicial",select("start",opts,counts[1]?.id||"",{required:true}))+'</div>'+
   '<div class="span-2">'+field("Contagem final",select("end",opts,counts[0]?.id||"",{required:true}))+'</div></div>',
   onSubmit:async form=>{const s=form.elements.start.value,en=form.elements.end.value;if(!s||!en||s===en)throw Error("Escolha duas contagens diferentes.");ctx.go(ctx.base+"/cmv/novo/"+s+"/"+en)}});
 });
}

function memoryView(ctx,r){
 const t=r.totals;
 return '<div class="grid-3">'+card("Itens · memória de cálculo",'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar item")+'</div>'+dataTable([
   {label:"Item",render:x=>'<span class="strong">'+e(x.item.name)+'</span><small class="sub">'+e(x.item.base_unit||"")+'</small>'},
   {label:"Inicial",cls:"num",render:x=>num(x.oq)+'<small class="sub">'+money(x.ov)+'</small>'},
   {label:"Compras",cls:"num",render:x=>num(x.pq)+'<small class="sub">'+money(x.pv)+'</small>'},
   {label:"Transf. líquida",cls:"num",render:x=>num(x.tiq-x.toq)+'<small class="sub">'+money(x.tiv-x.tov)+'</small>'},
   {label:"Final",cls:"num",render:x=>num(x.cq)+'<small class="sub">'+money(x.cv)+'</small>'},
   {label:"Perdas",cls:"num",render:x=>x.lq?num(x.lq)+'<small class="sub">'+money(x.lv)+'</small>':'<span class="muted">—</span>'},
   {label:"CMV",cls:"num",render:x=>'<strong>'+money(x.cmv)+'</strong>'}
  ],r.rows,{rowAttrs:x=>'data-search="'+e(searchKey(x.item.name,x.item.code))+'"'}),{flush:true})+
  card("Resumo do período",'<ul class="list-plain calc"><li><span>Estoque inicial</span><strong>'+money(t.opening)+'</strong></li>'+
   '<li><span>+ Compras recebidas ('+r.docs.invs.length+' nota(s))</span><strong>'+money(t.purchases)+'</strong></li>'+
   '<li><span>+ Transferências recebidas</span><strong>'+money(t.tin)+'</strong></li><li><span>− Transferências enviadas</span><strong>'+money(t.tout)+'</strong></li>'+
   '<li><span>− Estoque final</span><strong>'+money(t.closing)+'</strong></li><li class="total"><span class="label">CMV do período</span><strong>'+money(t.cmv)+'</strong></li>'+
   '<li><span class="muted">Perdas registradas (já incluídas no CMV)</span><strong class="text-warn">'+money(t.losses)+'</strong></li>'+
   '<li><span class="muted">Período</span><strong>'+r.days+' dias</strong></li></ul>',{flush:true})+'</div>';
}
function bindMemory(ctx){const q=ctx.el.querySelector("#q");q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(x=>x.hidden=!!t&&!x.dataset.search.includes(t))})}

async function preview(ctx,s,en){
 const r=await computeCMV(ctx.storeId,s,en);
 if(!ctx.isCurrent())return;
 const exists=(await list("cmv_closings",{select:"id",eq:{store_id:ctx.storeId,start_count_id:s,end_count_id:en}}))[0];
 ctx.el.innerHTML=backLink(ctx.base+"/cmv","CMV")+
  '<div class="doc-head"><div><div class="doc-title"><h1>CMV de '+dateBR(r.c1.count_date)+' a '+dateBR(r.c2.count_date)+'</h1><span class="pill pill-warn">Prévia</span></div><p class="muted" style="margin:6px 0 0">Contagens '+e(r.c1.display_id)+' → '+e(r.c2.display_id)+'</p></div>'+
  '<div class="page-actions">'+(exists?btn("Ver fechamento salvo",{variant:"secondary",href:ctx.base+"/cmv/"+exists.id}):btn("Salvar fechamento",{variant:"ok",icon:"check",attrs:"data-save"}))+'</div></div>'+
  '<div class="kpis">'+kpi("CMV do período",money(r.totals.cmv),"",{icon:"chart"})+kpi("Compras",money(r.totals.purchases),"",{icon:"receipt",tone:"info"})+kpi("Perdas",money(r.totals.losses),r.totals.cmv?pct(r.totals.losses/r.totals.cmv)+" do CMV":"",{icon:"trash",tone:"warn"})+kpi("Itens",r.rows.length,"compõem o CMV",{icon:"box",tone:"ok"})+'</div>'+
  memoryView(ctx,r);
 bindMemory(ctx);
 ctx.el.querySelector("[data-save]")?.addEventListener("click",async ev=>{
  const b=ev.currentTarget;b.disabled=true;
  try{
   const t=r.totals;
   const c=await insert("cmv_closings",{store_id:ctx.storeId,start_count_id:s,end_count_id:en,start_date:r.c1.count_date,end_date:r.c2.count_date,
    opening_stock:t.opening,eligible_purchases:round2(t.purchases+t.tin-t.tout),eligible_losses:t.losses,closing_stock:t.closing,cmv_value:t.cmv,closed_at:new Date().toISOString(),closed_by:ctx.userId});
   try{await insertMany("cmv_closing_items",r.rows.filter(x=>x.cmv!==0).map(x=>({closing_id:c.id,item_id:x.item_id,component_type:"cmv",quantity:round2(x.oq+x.pq+x.tiq-x.toq-x.cq),unit_cost:x.oq+x.pq+x.tiq-x.toq-x.cq?round2(x.cmv/(x.oq+x.pq+x.tiq-x.toq-x.cq)):0,line_total:x.cmv})))}
   catch(error){console.warn("Detalhamento do CMV não gravado:",error)}
   toast("Fechamento salvo.");ctx.go(ctx.base+"/cmv/"+c.id);
  }catch(error){toast(errorMessage(error),"danger");b.disabled=false}
 });
}

async function detail(ctx,id){
 const c=await get("cmv_closings",id);
 if(c.store_id!==ctx.storeId)throw Error("Fechamento de outra loja.");
 const r=await computeCMV(ctx.storeId,c.start_count_id,c.end_count_id);
 if(!ctx.isCurrent())return;
 const changed=Math.abs(r.totals.cmv-Number(c.cmv_value))>=0.01;
 ctx.el.innerHTML=backLink(ctx.base+"/cmv","CMV")+
  '<div class="doc-head"><div><div class="doc-title"><h1>CMV de '+dateBR(c.start_date)+' a '+dateBR(c.end_date)+'</h1><span class="pill pill-ok">Fechado</span></div><p class="muted" style="margin:6px 0 0">Fechado em '+dateTimeBR(c.closed_at)+'</p></div>'+
  '<div class="page-actions">'+btn("Imprimir",{variant:"secondary",icon:"printer",attrs:"data-print"})+'</div></div>'+
  '<div class="kpis">'+kpi("CMV do período",money(c.cmv_value),"",{icon:"chart"})+kpi("Estoque inicial",money(c.opening_stock),"",{icon:"box",tone:"info"})+kpi("Compras líquidas",money(c.eligible_purchases),"inclui transferências",{icon:"receipt",tone:"ok"})+kpi("Estoque final",money(c.closing_stock),"Perdas: "+money(c.eligible_losses),{icon:"clipboard",tone:"warn"})+'</div>'+
  (changed?alertBox("Documentos do período mudaram depois do fechamento: o cálculo atual dá "+money(r.totals.cmv)+".","warn"):'')+memoryView(ctx,r);
 bindMemory(ctx);ctx.el.querySelector("[data-print]").onclick=()=>window.print();
}
