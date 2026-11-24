// Loja · Início (repaginada em 23/11/2026). Ranking de ticket médio da marca; notas pendentes (mais novas primeiro, páginas de 10) (mês passado x este mês). Gráfico "Vendas": medida (Faturamento, Ticket médio ou Cupons) × visão:
//   1) Faturamento dia a dia do mês atual (linha).
//   2) Faturamento mês a mês de janeiro a dezembro do ano + pontilhado com o ano anterior.
//   Nos dois, linha pontilhada vinho = projeção (tabela sales_forecast, recalculada todo dia às 06:30).
//   Por hora: média do líquido de cada hora (0h a 23h) por dia no mês atual x mês anterior (tracejado). As horas vêm dos
//   resumos de dia feitos a partir do cupom completo (desde 01/10/2026).
//   3) Últimos períodos de CMV (entre contagens seguidas) com o % sobre o faturamento.
// Faturamento = líquido das vendas do Degust (resumos no R2, via ../shared/vendas.js), o mesmo usado no CMV. Cada bloco só aparece com o módulo liberado.
import {list} from "../../core/db.js";
import {salesSummary,salesRanking} from "../shared/vendas.js";
import {e,money,num,dateBR,today,round2,pct} from "../../core/format.js";
import {card,dataTable,emptyState,alertBox} from "../../core/ui.js";
import {lineChart} from "../../core/chart.js";
import {computeCMV} from "./cmv.js";
import {enabledModules} from "../../areas/loja/shell.js";
import {loadSuppliers} from "../shared/catalog.js";

const BRAND="#85071D",GRAY="#8E8E93",PROJ=BRAND;
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const ym=d=>String(d).slice(0,7);

async function salesByDay(storeId,from,to){return (await salesSummary(storeId,from,to,{onlyDays:true})).days}

export async function render(ctx){
 const on=new Set(enabledModules(ctx.app,ctx.storeId).map(m=>m.id));
 const showSales=on.has("faturamento"),showCmv=on.has("cmv"),showNotes=on.has("notas");
 const t=today(),mStart=t.slice(0,8)+"01",curM=ym(t);
 const Y=Number(t.slice(0,4)),PY=Y-1;   // ano atual e o anterior (comparativo)
 const [days,ranking,forecast,counts,invoices,suppliers]=await Promise.all([
  showSales?salesByDay(ctx.storeId,PY+"-01-01",t).catch(()=>[]):[],
  showSales?salesRanking(ctx.storeId).catch(error=>({erro:error.message})):null,
  showSales?list("sales_forecast",{select:"business_date,projected_net",eq:{store_id:ctx.storeId},order:"business_date",asc:true}).catch(()=>[]):[],
  showCmv?list("stock_counts",{select:"id,display_id,count_date,status",eq:{store_id:ctx.storeId},order:"count_date",asc:true}):[],
  showNotes?list("invoices",{select:"id,invoice_number,issue_date,entry_date,total_amount,supplier_id",eq:{store_id:ctx.storeId,status:"pending"}}).catch(()=>[]):[],
  showNotes?loadSuppliers().catch(()=>[]):[]
 ]);
 if(!ctx.isCurrent())return;
 // ---- Vendas (gráfico): três medidas — Faturamento (líquido), Ticket médio (líquido ÷ cupons) e Cupons (nº de vendas).
 const isoD=d=>String(d.business_date).slice(0,10);
 const dayRec=new Map(days.map(d=>[isoD(d),{net:Number(d.net||0),n:Number(d.sales||0)}]));
 // Primeiro dia com vendas importadas: antes dele não há dado (linha vazia, não zero).
 const firstDay=[...dayRec.keys()].sort()[0]||"9999";
 const val=(met,net,n)=>met==="tkt"?(n?round2(net/n):null):met==="cup"?n:round2(net);
 const agg=list=>list.reduce((s,x)=>({net:s.net+x.net,n:s.n+x.n}),{net:0,n:0});
 // Dia a dia (mês atual)
 const lastDay=new Date(Y,Number(t.slice(5,7)),0).getDate(),mm=t.slice(5,7);
 const dLabels=[],dKeys=[];
 for(let i=1;i<=lastDay;i++){dLabels.push(String(i));dKeys.push(Y+"-"+mm+"-"+String(i).padStart(2,"0"))}
 const dayOf=d=>d>t||d<firstDay?null:(dayRec.get(d)??(d<t?{net:0,n:0}:null));
 const monthRec=agg(dKeys.map(dayOf).filter(Boolean));
 // Projeção do faturamento (dias que faltam do mês). Só existe para Faturamento.
 const fc=new Map(forecast.filter(f=>String(f.business_date).slice(0,10)>=t).map(f=>[String(f.business_date).slice(0,10),Number(f.projected_net)]));
 const dProj=dKeys.map(d=>fc.get(d)??null);
 const fcMonth=round2(dProj.reduce((s,v)=>s+(v||0),0)),hasProj=fcMonth>0;
 // Mês a mês: janeiro a dezembro do ano atual e, tracejado, o mesmo mês do ano anterior.
 const byMonth=new Map();for(const [d,r] of dayRec){const k=ym(d),x=byMonth.get(k)||{net:0,n:0};x.net+=r.net;x.n+=r.n;byMonth.set(k,x)}
 const months=MESES.map((_,i)=>String(i+1).padStart(2,"0"));
 const monOf=m=>m>curM||m<ym(firstDay)?null:(byMonth.get(m)||{net:0,n:0});
 const ci=Number(mm)-1;
 // Por hora: média por dia de cada hora (só dias com horas no resumo, desde 01/10/2026).
 const hourOf=m=>{const ds=days.filter(d=>ym(isoD(d))===m&&Array.isArray(d.hours));
  return {days:ds.length,h:Array.from({length:24},(_,h)=>({net:ds.reduce((s,d)=>s+Number(d.hours[h]||0),0),n:ds.reduce((s,d)=>s+Number(d.hoursN?.[h]||0),0)}))}};
 const prevM=Number(mm)===1?(PY+"-12"):(Y+"-"+String(Number(mm)-1).padStart(2,"0"));
 const hCur=hourOf(curM),hPrev=hourOf(prevM),HORAS=Array.from({length:24},(_,h)=>h+"h");
 const mesLabel=m=>MESES[Number(m.slice(5,7))-1]+"/"+m.slice(0,4);
 /** Valores da hora: faturamento e cupons = média por dia; ticket = líquido ÷ cupons da hora. */
 const hourVals=(H,met)=>H.days?H.h.map(x=>met==="tkt"?(x.n?round2(x.net/x.n):null):met==="cup"?round2(x.n/H.days):round2(x.net/H.days)):Array(24).fill(null);

 // Períodos de CMV: cada par de contagens seguidas (sem as canceladas), do mais recente para trás (até 6).
 let periods=[];
 if(showCmv){
  const cs=counts.filter(c=>c.status!=="cancelled");
  const pairs=[];for(let i=cs.length-1;i>0&&pairs.length<6;i--)pairs.push([cs[i-1],cs[i]]);
  periods=await Promise.all(pairs.map(async([a,b])=>{
   try{const r=await computeCMV(ctx.storeId,a.id,b.id);return {a,b,cmv:r.totals.cmv,rev:r.revenue?.net??null,partial:!!r.revenue&&r.revenue.daysImported<r.revenue.daysTotal}}
   catch(error){return {a,b,error:error.message,rev:null}}
  }));
  if(!ctx.isCurrent())return;
 }

 ctx.el.innerHTML='<header class="page-head"><div><h1>'+e(ctx.store.name)+'</h1></div></header>'+
  (showSales?card("Vendas",'<div class="chart-total"><span data-chart-total></span><small data-chart-sub></small></div><div data-chart></div>',
    {actions:'<div class="chart-ctrls"><div class="seg" role="tablist" aria-label="Medida"><button type="button" role="tab" data-met="fat">Faturamento</button><button type="button" role="tab" data-met="tkt">Ticket médio</button><button type="button" role="tab" data-met="cup">Cupons</button></div>'+
     '<div class="seg" role="tablist" aria-label="Visualização"><button type="button" role="tab" data-view="dia">Dia a dia</button><button type="button" role="tab" data-view="mes">Mês a mês</button><button type="button" role="tab" data-view="hora">Por hora</button></div></div>'}):'')+
  (showSales?rankingCard(ctx,ranking):'')+
  (showCmv?card("CMV por período",periods.length?dataTable([
    {label:"Período",render:p=>'<span class="strong">'+dateBR(p.a.count_date)+' a '+dateBR(p.b.count_date)+'</span><small class="sub">'+e(p.a.display_id)+' → '+e(p.b.display_id)+((p.a.status==="draft"||p.b.status==="draft")?' · contagem em rascunho':'')+'</small>'},
    {label:"CMV",cls:"num",render:p=>p.error?'<span class="muted">—</span>':money(p.cmv)},
    {label:"Faturamento",cls:"num",render:p=>p.rev==null?'<span class="muted">—</span>':money(p.rev)+(p.partial?'<small class="sub text-warn">dias faltando</small>':'')},
    {label:"CMV / faturamento",cls:"num",render:p=>p.rev?'<strong>'+pct(p.cmv/p.rev)+'</strong>':'<span class="muted">—</span>'}
   ],periods,{rowHref:p=>ctx.base+"/cmv/novo/"+p.a.id+"/"+p.b.id})
   :emptyState("chart","Nenhum período de CMV","São necessárias duas contagens em datas diferentes."),{flush:true}):'')+
  (showNotes?card("Notas pendentes de entrada ("+invoices.length+")",'<div data-nt></div>',{flush:true}):'')+
  (!showSales&&!showCmv&&!showNotes?alertBox("Nenhum módulo com resumo liberado para esta loja.","info"):'');
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 if(showSales&&ranking&&!ranking.erro)drawRanking(ctx,ranking,null);
 if(showNotes)drawNotes(ctx,invoices,new Map(suppliers.map(x=>[x.id,x.name])),0);
 if(showSales){
  // Um gráfico só; o botão no topo troca entre dia a dia (mês atual), mês a mês (12 meses x ano anterior) e por hora.
  const box=ctx.el.querySelector("[data-chart]"),tot=ctx.el.querySelector("[data-chart-total]"),sub=ctx.el.querySelector("[data-chart-sub]");
  const NAME={fat:"Faturamento",tkt:"Ticket médio",cup:"Cupons"};
  const draw=()=>{
   try{localStorage.setItem("rfs-inicio-fat",view);localStorage.setItem("rfs-inicio-met",metric)}catch{}
   ctx.el.querySelectorAll("[data-view]").forEach(b=>{const on=b.dataset.view===view;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on))});
   ctx.el.querySelectorAll("[data-met]").forEach(b=>{const on=b.dataset.met===metric;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on))});
   const met=metric,fmt=met==="cup"?(v=>num(v,v%1?1:0)):money,proj=met==="fat"&&hasProj;
   if(view==="dia"){
    const vals=dKeys.map(d=>{const r=dayOf(d);return r?val(met,r.net,r.n):null});
    let pj=null;
    if(proj){pj=dProj.slice();let k=vals.length-1;while(k>=0&&vals[k]==null)k--;if(k>=0&&pj[k]==null)pj[k]=vals[k]}
    const mLab=MESES[Number(mm)-1]+"/"+Y;
    tot.textContent=fmt(val(met,monthRec.net,monthRec.n)??0);
    sub.textContent=(met==="cup"?" cupons no mês de ":" no mês de ")+mLab+(proj?" · projeção do mês "+money(round2(monthRec.net+fcMonth)):"");
    lineChart(box,{labels:dLabels,series:[{name:NAME[met],color:BRAND,values:vals},...(pj?[{name:"Projeção",color:PROJ,dash:true,values:pj}]:[])],format:fmt,tickEvery:5,ariaLabel:NAME[met]+" por dia no mês atual"});
   }else if(view==="hora"){
    const base=hCur.days?hCur:hPrev,baseM=hCur.days?curM:prevM;
    if(!base.days){box._lcRO?.disconnect();box._lcRO=null;tot.textContent="—";sub.textContent=" sem vendas por hora no período";box.innerHTML='<p class="muted" style="padding:24px 0;margin:0">As vendas por hora existem a partir de 01/10/2026.</p>';return}
    const cur=hourVals(hCur,met),prev=hourVals(hPrev,met),bv=hourVals(base,met);
    const peak=bv.reduce((b,x,h)=>(x??-1)>(bv[b]??-1)?h:b,0);
    tot.textContent=fmt(bv[peak]??0);
    sub.textContent=(met==="tkt"?" de ticket médio no horário de maior ticket":met==="cup"?" cupons por dia, em média, no horário de pico":" por dia, em média, no horário de pico")+" ("+peak+"h às "+(peak+1)+"h) · "+mesLabel(baseM)+" ("+base.days+" dias)";
    lineChart(box,{labels:HORAS,series:[{name:mesLabel(curM),color:BRAND,values:cur},{name:mesLabel(prevM),color:GRAY,dash:true,values:prev}].filter(x=>x.values.some(y=>y!=null)),format:fmt,tickEvery:2,ariaLabel:NAME[met]+" por hora do dia, mês atual e anterior"});
   }else{
    const cur=months.map(m=>{const r=monOf(Y+"-"+m);return r?val(met,r.net,r.n):null}),prev=months.map(m=>{const r=monOf(PY+"-"+m);return r?val(met,r.net,r.n):null});
    let pj=null;
    if(proj){pj=months.map(()=>null);pj[ci]=round2((byMonth.get(curM)?.net||0)+fcMonth);if(ci>0&&cur[ci-1]!=null)pj[ci-1]=cur[ci-1]}
    const yr=agg(months.map(m=>monOf(Y+"-"+m)).filter(Boolean));
    tot.textContent=fmt(val(met,yr.net,yr.n)??0);sub.textContent=(met==="cup"?" cupons em ":" em ")+Y;
    lineChart(box,{labels:MESES,series:[{name:String(Y),color:BRAND,values:cur},...(pj?[{name:"Projeção "+Y,color:PROJ,dash:true,values:pj}]:[]),{name:String(PY),color:GRAY,dash:true,values:prev}],format:fmt,tickEvery:1,ariaLabel:NAME[met]+" por mês no ano atual e no anterior"});
   }
  };
  const show=v=>{view=v;draw()};
  ctx.el.querySelectorAll("[data-met]").forEach(b=>b.onclick=()=>{metric=b.dataset.met;draw()});
  ctx.el.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>show(b.dataset.view));
  show(view);
 }
}
// Ranking de ticket médio da marca: mês passado x este mês (até ontem), ordenado pela variação; a loja vista em destaque.
// Largura total, páginas de 10 em 10; abre na página da loja vista.
const MES_N=m=>MESES[Number(String(m).slice(5,7))-1]+"/"+String(m).slice(0,4);
const RK_PAGE=10;
function rankingRows(R){
 const rows=R.lojas.slice().sort((a,b)=>(b.var??-Infinity)-(a.var??-Infinity)||(b.cur??0)-(a.cur??0));
 let pos=0;for(const r of rows)r.pos=r.var==null?null:++pos;
 return rows;
}
function rankingCard(ctx,R){
 if(!R||R.erro)return card("Ranking de ticket médio",'<p class="muted" style="padding:16px 18px;margin:0">'+e(R?.erro?"Não foi possível carregar o ranking: "+R.erro:"Sem dados.")+'</p>');
 return card("Ranking de ticket médio",'<div data-rk></div><p class="muted" style="margin:0;padding:10px 18px;font-size:12px">Ticket médio = faturamento líquido ÷ cupons. Este mês até '+e(dateBR(R.ate))+'. Ordenado pela variação.</p>',{flush:true,cls:"rk-card"});
}
function drawRanking(ctx,R,page){
 const box=ctx.el.querySelector("[data-rk]");if(!box)return;
 const rows=rankingRows(R),pages=Math.max(1,Math.ceil(rows.length/RK_PAGE));
 const meIdx=rows.findIndex(r=>r.store_id===ctx.storeId),me=rows[meIdx];
 if(page==null)page=meIdx>=0?Math.floor(meIdx/RK_PAGE):0;
 page=Math.max(0,Math.min(pages-1,page));
 if(!rows.length){box.innerHTML='<p class="muted" style="padding:16px 18px;margin:0">Nenhuma loja da marca com vendas importadas.</p>';return}
 const fmtVar=v=>v==null?'<span class="muted">—</span>':'<span class="rk-var '+(v>0?"up":v<0?"down":"")+'">'+(v>0?"▲ +":v<0?"▼ ":"")+pct(v)+'</span>';
 const slice=rows.slice(page*RK_PAGE,page*RK_PAGE+RK_PAGE);
 box.innerHTML='<div class="table-wrap"><table class="table rk"><thead><tr><th class="num">#</th><th>Loja</th><th class="num">'+e(MES_N(R.mesAnterior))+'</th><th class="num">'+e(MES_N(R.mesAtual))+'</th><th class="num">Variação</th></tr></thead><tbody>'+
  slice.map(r=>{const isMe=r.store_id===ctx.storeId;
   return '<tr class="'+(isMe?"rk-me":"")+'"><td class="num" data-label="#">'+(r.pos??"")+'</td><td data-label="Loja"><span class="strong">'+e(r.name||r.code)+'</span>'+(isMe?' <span class="tag">esta loja</span>':'')+'</td>'+
    '<td class="num" data-label="'+e(MES_N(R.mesAnterior))+'">'+(r.prev==null?'<span class="muted">—</span>':money(r.prev))+'</td>'+
    '<td class="num" data-label="'+e(MES_N(R.mesAtual))+'">'+(r.cur==null?'<span class="muted">—</span>':money(r.cur))+'</td>'+
    '<td class="num" data-label="Variação">'+fmtVar(r.var)+'</td></tr>'}).join("")+'</tbody></table></div>'+
  '<div class="rk-pager"><span class="muted">'+(page*RK_PAGE+1)+'–'+Math.min(rows.length,page*RK_PAGE+RK_PAGE)+' de '+rows.length+'</span>'+
  (me?'<button type="button" class="rk-me-link" data-rk-me>Esta loja: '+(me.pos?me.pos+'º':'sem posição')+'</button>':'')+
  '<span class="rk-pages"><button type="button" class="icon-btn" data-rk-go="'+(page-1)+'"'+(page===0?" disabled":"")+' aria-label="Página anterior">‹</button>'+
  Array.from({length:pages},(_,i)=>'<button type="button" class="rk-pg'+(i===page?" on":"")+'" data-rk-go="'+i+'"'+(i===page?' aria-current="page"':'')+'>'+(i+1)+'</button>').join("")+
  '<button type="button" class="icon-btn" data-rk-go="'+(page+1)+'"'+(page===pages-1?" disabled":"")+' aria-label="Próxima página">›</button></span></div>';
 box.querySelectorAll("[data-rk-go]").forEach(b=>b.onclick=()=>drawRanking(ctx,R,Number(b.dataset.rkGo)));
 box.querySelector("[data-rk-me]")?.addEventListener("click",()=>drawRanking(ctx,R,null));
}
// Notas pendentes de entrada: da mais nova para a mais antiga (data de entrada; sem ela, a emissão), páginas de 10.
const NT_PAGE=10;
function pager(page,pages,total,attr){
 return '<div class="rk-pager"><span class="muted">'+(total?(page*NT_PAGE+1)+'–'+Math.min(total,page*NT_PAGE+NT_PAGE)+' de '+total:'')+'</span>'+
  (pages>1?'<span class="rk-pages"><button type="button" class="icon-btn" '+attr+'="'+(page-1)+'"'+(page===0?" disabled":"")+' aria-label="Página anterior">‹</button>'+
  Array.from({length:pages},(_,i)=>'<button type="button" class="rk-pg'+(i===page?" on":"")+'" '+attr+'="'+i+'"'+(i===page?' aria-current="page"':'')+'>'+(i+1)+'</button>').join("")+
  '<button type="button" class="icon-btn" '+attr+'="'+(page+1)+'"'+(page===pages-1?" disabled":"")+' aria-label="Próxima página">›</button></span>':'')+'</div>';
}
function drawNotes(ctx,invoices,sup,page){
 const box=ctx.el.querySelector("[data-nt]");if(!box)return;
 if(!invoices.length){box.innerHTML=emptyState("check","Nenhuma nota pendente","Todas as notas já deram entrada no estoque.");return}
 const key=i=>String(i.entry_date||i.issue_date||"");
 const rows=invoices.slice().sort((a,b)=>key(b).localeCompare(key(a))||String(b.invoice_number).localeCompare(String(a.invoice_number)));
 const pages=Math.ceil(rows.length/NT_PAGE);page=Math.max(0,Math.min(pages-1,page));
 const total=round2(rows.reduce((s,i)=>s+Number(i.total_amount||0),0));
 box.innerHTML=dataTable([
   {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)||"Sem fornecedor")+'</small>'},
   {label:"Emissão",render:i=>dateBR(i.issue_date)},
   {label:"Entrada",render:i=>dateBR(i.entry_date)},
   {label:"Valor",cls:"num",render:i=>money(i.total_amount||0)}
  ],rows.slice(page*NT_PAGE,page*NT_PAGE+NT_PAGE),{rowHref:i=>ctx.base+"/notas/"+i.id}).replace('class="table"','class="table stack"')+
  pager(page,pages,rows.length,"data-nt-go")+
  '<p class="muted" style="margin:0;padding:0 18px 12px;font-size:13px">Total pendente: <strong>'+money(total)+'</strong></p>';
 box.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 box.querySelectorAll("[data-nt-go]").forEach(b=>b.onclick=()=>drawNotes(ctx,invoices,sup,Number(b.dataset.ntGo)));
}
let view=(()=>{try{const v=localStorage.getItem("rfs-inicio-fat");return v==="mes"||v==="hora"?v:"dia"}catch{return "dia"}})();
let metric=(()=>{try{const v=localStorage.getItem("rfs-inicio-met");return v==="tkt"||v==="cup"?v:"fat"}catch{return "fat"}})();
