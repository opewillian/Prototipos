// Loja · Início (repaginada em 23/11/2026):
//   1) Faturamento dia a dia do mês atual (linha).
//   2) Faturamento mês a mês de janeiro a dezembro do ano + pontilhado com o ano anterior.
//   Nos dois, linha pontilhada vinho = projeção (tabela sales_forecast, recalculada todo dia às 06:30).
//   Por hora: média do líquido de cada hora (0h a 23h) por dia no mês atual x mês anterior (tracejado). As horas vêm dos
//   resumos de dia feitos a partir do cupom completo (desde 01/10/2026).
//   3) Últimos períodos de CMV (entre contagens seguidas) com o % sobre o faturamento.
//   4) Notas pendentes de entrada no estoque.
// Faturamento = líquido das vendas do Degust (resumos no R2, via ../shared/vendas.js), o mesmo usado no CMV. Cada bloco só aparece com o módulo liberado.
import {list} from "../../core/db.js";
import {salesSummary} from "../shared/vendas.js";
import {e,money,dateBR,today,round2,pct} from "../../core/format.js";
import {card,dataTable,emptyState,alertBox} from "../../core/ui.js";
import {lineChart} from "../../core/chart.js";
import {loadSuppliers} from "../shared/catalog.js";
import {computeCMV} from "./cmv.js";
import {enabledModules} from "../../areas/loja/shell.js";

const BRAND="#85071D",GRAY="#8E8E93",PROJ=BRAND;
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const ym=d=>String(d).slice(0,7);

async function salesByDay(storeId,from,to){return (await salesSummary(storeId,from,to,{onlyDays:true})).days}

export async function render(ctx){
 const on=new Set(enabledModules(ctx.app,ctx.storeId).map(m=>m.id));
 const showSales=on.has("faturamento"),showNotes=on.has("notas"),showCmv=on.has("cmv");
 const t=today(),mStart=t.slice(0,8)+"01",curM=ym(t);
 const Y=Number(t.slice(0,4)),PY=Y-1;   // ano atual e o anterior (comparativo)
 const [days,forecast,invoices,suppliers,counts]=await Promise.all([
  showSales?salesByDay(ctx.storeId,PY+"-01-01",t).catch(()=>[]):[],
  showSales?list("sales_forecast",{select:"business_date,projected_net",eq:{store_id:ctx.storeId},order:"business_date",asc:true}).catch(()=>[]):[],
  showNotes?list("invoices",{select:"id,invoice_number,issue_date,entry_date,total_amount,supplier_id",eq:{store_id:ctx.storeId,status:"pending"},order:"entry_date",asc:true}):[],
  showNotes?loadSuppliers().catch(()=>[]):[],
  showCmv?list("stock_counts",{select:"id,display_id,count_date,status",eq:{store_id:ctx.storeId},order:"count_date",asc:true}):[]
 ]);
 if(!ctx.isCurrent())return;
 const sup=new Map(suppliers.map(s=>[s.id,s.name]));
 const byDate=new Map(days.map(d=>[String(d.business_date).slice(0,10),Number(d.net||0)]));
 // Primeiro dia com vendas importadas: antes dele não há dado (linha vazia, não zero).
 const firstDay=[...byDate.keys()].sort()[0]||"9999";
 const dayVal=d=>d>t||d<firstDay?null:(byDate.get(d)??(d<t?0:null));
 // Mês atual, dia a dia.
 const lastDay=new Date(Y,Number(t.slice(5,7)),0).getDate(),mm=t.slice(5,7);
 const dLabels=[],dVals=[];
 for(let i=1;i<=lastDay;i++){const dd=String(i).padStart(2,"0");dLabels.push(String(i));dVals.push(dayVal(Y+"-"+mm+"-"+dd))}
 const monthTotal=round2(dVals.reduce((s,v)=>s+(v||0),0));
 // Projeção (dias futuros do mês atual). A linha pontilhada começa no último dia com venda, para emendar na linha real.
 const fc=new Map(forecast.filter(f=>String(f.business_date).slice(0,10)>=t).map(f=>[String(f.business_date).slice(0,10),Number(f.projected_net)]));
 const dProj=dLabels.map((_,i)=>fc.get(Y+"-"+mm+"-"+String(i+1).padStart(2,"0"))??null);
 const fcMonth=round2(dProj.reduce((s,v)=>s+(v||0),0)),hasProj=fcMonth>0;
 if(hasProj){let k=dVals.length-1;while(k>=0&&dVals[k]==null)k--;if(k>=0&&dProj[k]==null)dProj[k]=dVals[k]}
 // Mês a mês: janeiro a dezembro do ano atual e, pontilhado, o mesmo mês do ano anterior.
 const byMonth=new Map();for(const [d,v] of byDate)byMonth.set(ym(d),(byMonth.get(ym(d))||0)+v);
 const months=MESES.map((_,i)=>String(i+1).padStart(2,"0"));
 const monVal=m=>m>curM||m<ym(firstDay)?null:round2(byMonth.get(m)||0);
 const mCur=months.map(m=>monVal(Y+"-"+m)),mPrev=months.map(m=>monVal(PY+"-"+m));
 // Mês atual projetado = vendido até agora + projeção dos dias que faltam; emenda no mês anterior.
 const ci=Number(mm)-1,mProj=months.map(()=>null);
 if(hasProj){mProj[ci]=round2((mCur[ci]||0)+fcMonth);if(ci>0&&mCur[ci-1]!=null)mProj[ci-1]=mCur[ci-1]}

 // Por hora: média por dia de cada hora, no mês atual e no anterior (só dias com horas no resumo).
 const hourAvg=m=>{const ds=days.filter(d=>ym(String(d.business_date).slice(0,10))===m&&Array.isArray(d.hours));
  if(!ds.length)return {n:0,vals:Array(24).fill(null)};
  return {n:ds.length,vals:Array.from({length:24},(_,h)=>round2(ds.reduce((s,d)=>s+Number(d.hours[h]||0),0)/ds.length))}};
 const prevM=Number(mm)===1?(PY+"-12"):(Y+"-"+String(Number(mm)-1).padStart(2,"0"));
 const hCur=hourAvg(curM),hPrev=hourAvg(prevM),HORAS=Array.from({length:24},(_,h)=>h+"h");
 const mesLabel=m=>MESES[Number(m.slice(5,7))-1]+"/"+m.slice(0,4);

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

 const notesTotal=round2(invoices.reduce((s,i)=>s+Number(i.total_amount||0),0));
 ctx.el.innerHTML='<header class="page-head"><div><h1>'+e(ctx.store.name)+'</h1></div></header>'+
  (showSales?card("Faturamento",'<div class="chart-total"><span data-chart-total></span><small data-chart-sub></small></div><div data-chart></div>',
    {actions:'<div class="seg" role="tablist" aria-label="Visualização do faturamento"><button type="button" role="tab" data-view="dia">Dia a dia</button><button type="button" role="tab" data-view="mes">Mês a mês</button><button type="button" role="tab" data-view="hora">Por hora</button></div>'}):'')+
  (showCmv?card("CMV por período",periods.length?dataTable([
    {label:"Período",render:p=>'<span class="strong">'+dateBR(p.a.count_date)+' a '+dateBR(p.b.count_date)+'</span><small class="sub">'+e(p.a.display_id)+' → '+e(p.b.display_id)+((p.a.status==="draft"||p.b.status==="draft")?' · contagem em rascunho':'')+'</small>'},
    {label:"CMV",cls:"num",render:p=>p.error?'<span class="muted">—</span>':money(p.cmv)},
    {label:"Faturamento",cls:"num",render:p=>p.rev==null?'<span class="muted">—</span>':money(p.rev)+(p.partial?'<small class="sub text-warn">dias faltando</small>':'')},
    {label:"CMV / faturamento",cls:"num",render:p=>p.rev?'<strong>'+pct(p.cmv/p.rev)+'</strong>':'<span class="muted">—</span>'}
   ],periods,{rowHref:p=>ctx.base+"/cmv/novo/"+p.a.id+"/"+p.b.id})
   :emptyState("chart","Nenhum período de CMV","São necessárias duas contagens em datas diferentes."),{flush:true}):'')+
  (showNotes?card("Notas pendentes de entrada ("+invoices.length+")",invoices.length?dataTable([
    {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)||"Sem fornecedor")+'</small>'},
    {label:"Emissão",render:i=>dateBR(i.issue_date)},
    {label:"Entrada",render:i=>dateBR(i.entry_date)},
    {label:"Valor",cls:"num",render:i=>money(i.total_amount||0)}
   ],invoices,{rowHref:i=>ctx.base+"/notas/"+i.id}).replace('class="table"','class="table stack"')+
   '<p class="muted" style="margin:0;padding:10px 18px;font-size:13px">Total pendente: <strong>'+money(notesTotal)+'</strong></p>'
   :emptyState("check","Nenhuma nota pendente","Todas as notas já deram entrada no estoque."),{flush:true}):'')+
  (!showSales&&!showNotes&&!showCmv?alertBox("Nenhum módulo com resumo liberado para esta loja.","info"):'');
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 if(showSales){
  // Um gráfico só; o botão no topo troca entre dia a dia (mês atual), mês a mês (12 meses x ano anterior) e por hora.
  const box=ctx.el.querySelector("[data-chart]"),tot=ctx.el.querySelector("[data-chart-total]"),sub=ctx.el.querySelector("[data-chart-sub]");
  const yearTotal=round2(mCur.reduce((s,v)=>s+(v||0),0));
  const show=v=>{
   view=v;try{localStorage.setItem("rfs-inicio-fat",v)}catch{}
   ctx.el.querySelectorAll("[data-view]").forEach(b=>{const on=b.dataset.view===v;b.classList.toggle("on",on);b.setAttribute("aria-selected",String(on))});
   if(v==="dia"){
    tot.textContent=money(monthTotal);sub.textContent=" no mês de "+MESES[Number(mm)-1]+"/"+Y+(hasProj?" · projeção do mês "+money(round2(monthTotal+fcMonth)):"");
    lineChart(box,{labels:dLabels,series:[{name:"Faturamento",color:BRAND,values:dVals},...(hasProj?[{name:"Projeção",color:PROJ,dash:true,values:dProj}]:[])],format:money,tickEvery:5,ariaLabel:"Faturamento por dia no mês atual, com projeção"});
   }else if(v==="hora"){
    const base=hCur.n?hCur:hPrev,baseM=hCur.n?curM:prevM;
    if(!base.n){box._lcRO?.disconnect();box._lcRO=null;tot.textContent="—";sub.textContent=" sem vendas por hora no período";box.innerHTML='<p class="muted" style="padding:24px 0;margin:0">As vendas por hora existem a partir de 01/10/2026.</p>';return}
    const peak=base.vals.reduce((b,x,h)=>x>(base.vals[b]||0)?h:b,0);
    tot.textContent=money(base.vals[peak]);sub.textContent=" por dia, em média, no horário de pico ("+peak+"h às "+(peak+1)+"h) · "+mesLabel(baseM)+" ("+base.n+" dias)";
    lineChart(box,{labels:HORAS,series:[{name:mesLabel(curM),color:BRAND,values:hCur.vals},{name:mesLabel(prevM),color:GRAY,dash:true,values:hPrev.vals}].filter(x=>x.values.some(y=>y!=null)),format:money,tickEvery:2,ariaLabel:"Faturamento médio por hora do dia, mês atual e anterior"});
   }else{
    tot.textContent=money(yearTotal);sub.textContent=" em "+Y;
    lineChart(box,{labels:MESES,series:[{name:String(Y),color:BRAND,values:mCur},...(hasProj?[{name:"Projeção "+Y,color:PROJ,dash:true,values:mProj}]:[]),{name:String(PY),color:GRAY,dash:true,values:mPrev}],format:money,tickEvery:1,ariaLabel:"Faturamento por mês no ano atual e no anterior"});
   }
  };
  ctx.el.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>show(b.dataset.view));
  show(view);
 }
}
let view=(()=>{try{const v=localStorage.getItem("rfs-inicio-fat");return v==="mes"||v==="hora"?v:"dia"}catch{return "dia"}})();
