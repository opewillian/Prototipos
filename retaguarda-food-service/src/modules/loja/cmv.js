// Loja · CMV por período entre duas contagens (rascunho ou finalizada; para SALVAR o fechamento, as duas precisam estar finalizadas).
// O usuário escolhe as datas num calendário que só libera os dias com contagem: 1º clique = estoque inicial, 2º = estoque final.
// Período dos documentos (por data): do dia seguinte ao estoque inicial até o dia do estoque final, inclusive.
//   Compras = notas RECEBIDAS pela data de entrada; transferências emitidas pela data da transferência; perdas registradas pela data da perda.
// CMV = estoque inicial + compras + transferências recebidas − transferências enviadas − estoque final.
// Só itens marcados "compõe CMV". Perdas já reduziram o estoque final: são mostradas à parte, sem subtrair de novo.
import {list,get,insert,insertMany} from "../../core/db.js";
import {e,money,num,dateBR,dateTimeBR,round2,pct,addDays,daysBetween,today} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,toast,emptyState,backLink,errorMessage,card,kpi,alertBox,searchBox,searchKey} from "../../core/ui.js";
import {loadItems,byId} from "../shared/catalog.js";

const d10=v=>String(v||"").slice(0,10);
const trDate=t=>d10(t.transfer_date||t.issued_at);
const stLabel=c=>c.status==="draft"?"rascunho":"finalizada";

export async function computeCMV(storeId,startId,endId){
 const [c1,c2,items]=await Promise.all([get("stock_counts",startId),get("stock_counts",endId),loadItems()]);
 if(c1.store_id!==storeId||c2.store_id!==storeId)throw Error("Contagens de outra loja.");
 if(c1.status==="cancelled"||c2.status==="cancelled")throw Error("Contagem cancelada não entra no CMV.");
 if(d10(c2.count_date)<=d10(c1.count_date))throw Error("O estoque final deve ser de uma data posterior ao inicial.");
 const map=byId(items);const cmvItem=id=>map.get(id)?.composes_cmv!==false;
 const from=addDays(d10(c1.count_date),1),to=d10(c2.count_date);
 const [l1,l2,invsAll,trsAll,lossesAll]=await Promise.all([
  list("stock_count_items",{eq:{count_id:startId}}),list("stock_count_items",{eq:{count_id:endId}}),
  list("invoices",{select:"id,invoice_number,entry_date,status",eq:{store_id:storeId},gte:{entry_date:from},lte:{entry_date:to}}),
  list("transfers",{select:"id,number,from_store_id,to_store_id,transfer_date,issued_at,status",or:"from_store_id.eq."+storeId+",to_store_id.eq."+storeId}),
  list("losses",{select:"id,loss_date,reason,status",eq:{store_id:storeId},gte:{loss_date:from},lte:{loss_date:to}})
 ]);
 const inPeriod=t=>trDate(t)>=from&&trDate(t)<=to;
 const invs=invsAll.filter(i=>i.status==="received");
 const trs=trsAll.filter(t=>t.status==="issued"&&inPeriod(t));
 const losses=lossesAll.filter(l=>l.status==="recorded");
 const pending={invs:invsAll.filter(i=>i.status==="pending"),trs:trsAll.filter(t=>t.status==="draft"&&inPeriod(t)),losses:lossesAll.filter(l=>l.status==="draft")};
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
 return {c1,c2,from,to,rows:list2,totals:t,docs:{invs,trs,losses},pending,days:daysBetween(c1.count_date,c2.count_date)};
}

// Calendário de contagens: só os dias com contagem (rascunho ou finalizada) podem ser clicados.
const MONTHS=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function calendarPicker(root,counts,onPick){
 const byDate=new Map(counts.map(c=>[d10(c.count_date),c]));
 const dates=[...byDate.keys()].sort();
 let sel={a:null,b:null};
 let cur=(dates[dates.length-1]||today()).slice(0,7);
 const shift=(ym,n)=>{const [y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
 const month=ym=>{
  const [y,m]=ym.split("-").map(Number);const first=new Date(y,m-1,1).getDay();const len=new Date(y,m,0).getDate();
  let h='<div class="cal-month"><div class="cal-title">'+MONTHS[m-1]+' '+y+'</div><div class="cal-grid">'+["D","S","T","Q","Q","S","S"].map(w=>'<span class="cal-wd">'+w+'</span>').join("")+'<span></span>'.repeat(first);
  for(let d=1;d<=len;d++){
   const iso=ym+"-"+String(d).padStart(2,"0");const c=byDate.get(iso);
   const cls=["cal-day"];if(c)cls.push("has",c.status==="draft"?"draft":"fin");
   if(iso===sel.a)cls.push("start");if(iso===sel.b)cls.push("end");if(sel.a&&sel.b&&iso>sel.a&&iso<sel.b)cls.push("mid");
   h+=c?'<button type="button" class="'+cls.join(" ")+'" data-day="'+iso+'" title="'+e(c.display_id+" · "+stLabel(c))+'">'+d+'</button>':'<span class="'+cls.join(" ")+'">'+d+'</span>';
  }
  return h+'</div></div>';
 };
 const label=iso=>{const c=byDate.get(iso);return c?'<strong>'+dateBR(iso)+'</strong><small class="sub">'+e(c.display_id)+' · '+stLabel(c)+'</small>':'<span class="muted">Selecione no calendário</span>'};
 const draw=()=>{
  root.innerHTML='<div class="cal-sel"><div'+(!sel.a||sel.b?' class="on"':'')+'><small>Estoque inicial</small>'+label(sel.a)+'</div><div'+(sel.a&&!sel.b?' class="on"':'')+'><small>Estoque final</small>'+label(sel.b)+'</div></div>'+
   '<div class="cal-nav"><button type="button" class="icon-btn" data-nav="-1" aria-label="Mês anterior">‹</button><span class="muted">'+(sel.a&&!sel.b?"Agora escolha o estoque final":"Escolha o estoque inicial")+'</span><button type="button" class="icon-btn" data-nav="1" aria-label="Próximo mês">›</button></div>'+
   '<div class="cal-months">'+month(shift(cur,-1))+month(cur)+'</div>'+
   '<div class="cal-legend"><span><i class="cal-dot fin"></i>Finalizada</span><span><i class="cal-dot draft"></i>Rascunho</span><span class="muted">Só os dias com contagem podem ser escolhidos.</span></div>';
  root.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{cur=shift(cur,Number(b.dataset.nav));draw()});
  root.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{
   const d=b.dataset.day;
   if(!sel.a||sel.b)sel={a:d,b:null};else if(d>sel.a)sel.b=d;else sel={a:d,b:null};
   draw();onPick(sel.a&&sel.b?{start:byDate.get(sel.a),end:byDate.get(sel.b)}:null);
  });
 };
 draw();
}

export async function render(ctx){
 if(ctx.params[0]==="novo")return preview(ctx,ctx.params[1],ctx.params[2]);
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [closings,countsAll]=await Promise.all([
  list("cmv_closings",{eq:{store_id:ctx.storeId},order:"end_date"}),
  list("stock_counts",{select:"id,display_id,count_date,status",eq:{store_id:ctx.storeId},order:"count_date"})
 ]);
 if(!ctx.isCurrent())return;
 const counts=countsAll.filter(c=>c.status!=="cancelled");
 const last=closings[0];
 const avg=closings.length?round2(closings.reduce((s,c)=>s+Number(c.cmv_value||0),0)/closings.length):0;
 ctx.el.innerHTML=pageHead("CMV","Custo da mercadoria consumida entre duas contagens, com memória de cálculo por item.")+
  '<div class="kpis">'+kpi("Último CMV",last?money(last.cmv_value):"—",last?dateBR(last.start_date)+" a "+dateBR(last.end_date):"Nenhum fechamento",{icon:"chart"})+
  kpi("Média dos fechamentos",closings.length?money(avg):"—",closings.length+" fechamento(s)",{icon:"layers",tone:"info"})+
  kpi("Perdas no último período",last?money(last.eligible_losses):"—",last&&Number(last.cmv_value)?pct(Number(last.eligible_losses)/Number(last.cmv_value))+" do CMV":"",{icon:"trash",tone:"warn"})+
  kpi("Contagens disponíveis",counts.length,counts.filter(c=>c.status==="draft").length+" em rascunho",{icon:"clipboard",tone:"ok"})+'</div>'+
  card("Calcular CMV",counts.length<2?'<div style="padding:14px 18px">'+alertBox("São necessárias duas contagens (rascunho ou finalizadas) em datas diferentes para calcular o CMV.","info")+'</div>':
   '<div class="cal-wrap"><div class="cal-row"><button type="button" class="date-range" data-open aria-expanded="false">'+icon("calendar")+'<span data-range>Selecionar datas</span></button>'+
   btn("Calcular CMV",{icon:"chart",attrs:"data-go disabled"})+'</div>'+
   '<div class="cal-pop" data-cal hidden></div>'+
   '<p class="muted" style="margin:10px 0 0;font-size:13px">Compras (pela data de entrada), transferências e perdas entram do dia seguinte ao estoque inicial até o dia do estoque final.</p></div>')+
  '<section class="card">'+(closings.length?dataTable([
   {label:"Período",render:c=>'<span class="strong">'+dateBR(c.start_date)+' a '+dateBR(c.end_date)+'</span>'},
   {label:"Estoque inicial",cls:"num",render:c=>money(c.opening_stock)},{label:"Compras",cls:"num",render:c=>money(c.eligible_purchases)},
   {label:"Estoque final",cls:"num",render:c=>money(c.closing_stock)},{label:"Perdas",cls:"num",render:c=>money(c.eligible_losses)},
   {label:"CMV",cls:"num",render:c=>'<strong>'+money(c.cmv_value)+'</strong>'}
  ],closings,{rowHref:c=>ctx.base+"/cmv/"+c.id}).replace('class="table"','class="table stack"'):emptyState("chart","Nenhum fechamento de CMV","Escolha as datas acima, confira o cálculo e salve o fechamento."))+'</section>';
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 const pop=ctx.el.querySelector("[data-cal]");if(!pop)return;
 const go=ctx.el.querySelector("[data-go]");const rangeEl=ctx.el.querySelector("[data-range]");const opener=ctx.el.querySelector("[data-open]");
 let pick=null;
 const show=v=>{pop.hidden=!v;opener.setAttribute("aria-expanded",String(v))};
 opener.onclick=()=>show(pop.hidden);
 calendarPicker(pop,counts,p=>{
  pick=p;go.disabled=!p;
  rangeEl.textContent=p?dateBR(p.start.count_date)+" a "+dateBR(p.end.count_date):"Selecionar datas";
  if(p)show(false);
 });
 show(true);
 go.onclick=()=>{if(pick)ctx.go(ctx.base+"/cmv/novo/"+pick.start.id+"/"+pick.end.id)};
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
  card("Resumo do período",'<ul class="list-plain calc"><li><span>Estoque inicial ('+dateBR(r.c1.count_date)+')</span><strong>'+money(t.opening)+'</strong></li>'+
   '<li><span>+ Compras recebidas ('+r.docs.invs.length+' nota(s))</span><strong>'+money(t.purchases)+'</strong></li>'+
   '<li><span>+ Transferências recebidas</span><strong>'+money(t.tin)+'</strong></li><li><span>− Transferências enviadas</span><strong>'+money(t.tout)+'</strong></li>'+
   '<li><span>− Estoque final ('+dateBR(r.c2.count_date)+')</span><strong>'+money(t.closing)+'</strong></li><li class="total"><span class="label">CMV do período</span><strong>'+money(t.cmv)+'</strong></li>'+
   '<li><span class="muted">Perdas registradas (já incluídas no CMV)</span><strong class="text-warn">'+money(t.losses)+'</strong></li>'+
   '<li><span class="muted">Documentos de</span><strong>'+dateBR(r.from)+' a '+dateBR(r.to)+'</strong></li>'+
   '<li><span class="muted">Período</span><strong>'+r.days+' dias</strong></li></ul>',{flush:true})+'</div>';
}
function bindMemory(ctx){const q=ctx.el.querySelector("#q");q?.addEventListener("input",()=>{const t=searchKey(q.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(x=>x.hidden=!!t&&!x.dataset.search.includes(t))})}

// Avisos do que ficou de fora: contagens em rascunho e documentos ainda não lançados no período.
function warnings(r){
 const out=[];const drafts=[r.c1,r.c2].filter(c=>c.status==="draft");
 if(drafts.length)out.push(alertBox("Contagem em rascunho: "+drafts.map(c=>c.display_id+" ("+dateBR(c.count_date)+")").join(" e ")+". O cálculo usa as quantidades digitadas até agora; para salvar o fechamento, finalize as contagens.","info"));
 const p=r.pending,parts=[];
 if(p.invs.length)parts.push(p.invs.length+" nota(s) pendente(s)");if(p.trs.length)parts.push(p.trs.length+" transferência(s) em rascunho");if(p.losses.length)parts.push(p.losses.length+" perda(s) em rascunho");
 if(parts.length)out.push(alertBox("Fora do cálculo, no período de "+dateBR(r.from)+" a "+dateBR(r.to)+": "+parts.join(", ")+". Receba/emita/registre para entrarem no CMV.","warn"));
 return out.join("");
}

async function preview(ctx,s,en){
 const r=await computeCMV(ctx.storeId,s,en);
 if(!ctx.isCurrent())return;
 const exists=(await list("cmv_closings",{select:"id",eq:{store_id:ctx.storeId,start_count_id:s,end_count_id:en}}))[0];
 const canSave=r.c1.status==="finalized"&&r.c2.status==="finalized";
 ctx.el.innerHTML=backLink(ctx.base+"/cmv","CMV")+
  '<div class="doc-head"><div><div class="doc-title"><h1>CMV de '+dateBR(r.c1.count_date)+' a '+dateBR(r.c2.count_date)+'</h1><span class="pill pill-warn">Prévia</span></div><p class="muted" style="margin:6px 0 0">Estoque inicial '+e(r.c1.display_id)+' ('+stLabel(r.c1)+') → estoque final '+e(r.c2.display_id)+' ('+stLabel(r.c2)+') · documentos de '+dateBR(r.from)+' a '+dateBR(r.to)+'</p></div>'+
  '<div class="page-actions">'+(exists?btn("Ver fechamento salvo",{variant:"secondary",href:ctx.base+"/cmv/"+exists.id}):canSave?btn("Salvar fechamento",{variant:"ok",icon:"check",attrs:"data-save"}):'')+'</div></div>'+
  warnings(r)+
  '<div class="kpis">'+kpi("CMV do período",money(r.totals.cmv),"",{icon:"chart"})+kpi("Compras",money(r.totals.purchases),r.docs.invs.length+" nota(s) recebida(s)",{icon:"receipt",tone:"info"})+kpi("Perdas",money(r.totals.losses),r.totals.cmv?pct(r.totals.losses/r.totals.cmv)+" do CMV":"",{icon:"trash",tone:"warn"})+kpi("Itens",r.rows.length,"compõem o CMV",{icon:"box",tone:"ok"})+'</div>'+
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
