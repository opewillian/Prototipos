// Loja · Início (repaginada em 23/11/2026):
//   1) Faturamento dia a dia do mês atual (linha).
//   2) Faturamento mês a mês (12 meses) + linha pontilhada com o mesmo mês do ano anterior.
//   3) Notas pendentes de entrada no estoque.
//   4) Últimos períodos de CMV (entre contagens seguidas) com o % sobre o faturamento.
// Faturamento = líquido das vendas do Degust (sales_by_day), o mesmo usado no CMV. Cada bloco só aparece com o módulo liberado.
import {list,supabase} from "../../core/db.js";
import {e,money,dateBR,today,round2,pct} from "../../core/format.js";
import {card,dataTable,emptyState,alertBox} from "../../core/ui.js";
import {lineChart} from "../../core/chart.js";
import {loadSuppliers} from "../shared/catalog.js";
import {computeCMV} from "./cmv.js";
import {enabledModules} from "../../areas/loja/shell.js";

const BRAND="#85071D",GRAY="#8E8E93";
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const ym=d=>String(d).slice(0,7);
const shiftMonth=(m,n)=>{const [y,mm]=m.split("-").map(Number);const d=new Date(y,mm-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const monthLabel=m=>MESES[Number(m.slice(5,7))-1]+"/"+m.slice(2,4);

async function salesByDay(storeId,from,to){
 const {data,error}=await supabase.rpc("sales_by_day",{p_store:storeId,p_from:from,p_to:to});
 if(error)throw error;return data||[];
}

export async function render(ctx){
 const on=new Set(enabledModules(ctx.app,ctx.storeId).map(m=>m.id));
 const showSales=on.has("faturamento"),showNotes=on.has("notas"),showCmv=on.has("cmv");
 const t=today(),mStart=t.slice(0,8)+"01",curM=ym(t);
 const firstM=shiftMonth(curM,-23);   // 12 meses + os 12 do ano anterior
 const [days,invoices,suppliers,counts]=await Promise.all([
  showSales?salesByDay(ctx.storeId,firstM+"-01",t).catch(()=>[]):[],
  showNotes?list("invoices",{select:"id,invoice_number,issue_date,entry_date,total_amount,supplier_id",eq:{store_id:ctx.storeId,status:"pending"},order:"entry_date",asc:true}):[],
  showNotes?loadSuppliers().catch(()=>[]):[],
  showCmv?list("stock_counts",{select:"id,display_id,count_date,status",eq:{store_id:ctx.storeId},order:"count_date",asc:true}):[]
 ]);
 if(!ctx.isCurrent())return;
 const sup=new Map(suppliers.map(s=>[s.id,s.name]));
 const byDate=new Map(days.map(d=>[String(d.business_date).slice(0,10),Number(d.net||0)]));
 // Mês atual, dia a dia (dias futuros ficam sem valor; hoje só aparece se já tiver venda importada).
 const lastDay=new Date(Number(t.slice(0,4)),Number(t.slice(5,7)),0).getDate();
 const dLabels=[],dVals=[];
 for(let i=1;i<=lastDay;i++){const d=mStart.slice(0,8)+String(i).padStart(2,"0");dLabels.push(String(i));dVals.push(d<=t?(byDate.get(d)??(d<t?0:null)):null)}
 const monthTotal=round2(dVals.reduce((s,v)=>s+(v||0),0));
 // Mês a mês: últimos 12 meses e o mesmo mês do ano anterior (antes do início da importação: sem dado).
 const byMonth=new Map();for(const [d,v] of byDate)byMonth.set(ym(d),(byMonth.get(ym(d))||0)+v);
 const months=[];for(let i=11;i>=0;i--)months.push(shiftMonth(curM,-i));
 const firstData=[...byMonth.keys()].sort()[0];
 const val=m=>firstData&&m>=firstData?round2(byMonth.get(m)||0):null;
 const mCur=months.map(val),mPrev=months.map(m=>val(shiftMonth(m,-12)));

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
  (showSales?'<div class="grid-2">'+
   card("Faturamento do mês · "+MESES[Number(t.slice(5,7))-1]+"/"+t.slice(0,4),'<div class="chart-total">'+money(monthTotal)+'</div><div data-chart="dia"></div>')+
   card("Faturamento mês a mês",'<div data-chart="mes"></div>')+'</div>':'')+
  (showNotes?card("Notas pendentes de entrada ("+invoices.length+")",invoices.length?dataTable([
    {label:"Nota",render:i=>'<span class="strong">Nº '+e(i.invoice_number)+'</span><small class="sub">'+e(sup.get(i.supplier_id)||"Sem fornecedor")+'</small>'},
    {label:"Emissão",render:i=>dateBR(i.issue_date)},
    {label:"Entrada",render:i=>dateBR(i.entry_date)},
    {label:"Valor",cls:"num",render:i=>money(i.total_amount||0)}
   ],invoices,{rowHref:i=>ctx.base+"/notas/"+i.id}).replace('class="table"','class="table stack"')+
   '<p class="muted" style="margin:0;padding:10px 18px;font-size:13px">Total pendente: <strong>'+money(notesTotal)+'</strong></p>'
   :emptyState("check","Nenhuma nota pendente","Todas as notas já deram entrada no estoque."),{flush:true}):'')+
  (showCmv?card("CMV por período",periods.length?dataTable([
    {label:"Período",render:p=>'<span class="strong">'+dateBR(p.a.count_date)+' a '+dateBR(p.b.count_date)+'</span><small class="sub">'+e(p.a.display_id)+' → '+e(p.b.display_id)+((p.a.status==="draft"||p.b.status==="draft")?' · contagem em rascunho':'')+'</small>'},
    {label:"CMV",cls:"num",render:p=>p.error?'<span class="muted">—</span>':money(p.cmv)},
    {label:"Faturamento",cls:"num",render:p=>p.rev==null?'<span class="muted">—</span>':money(p.rev)+(p.partial?'<small class="sub text-warn">dias faltando</small>':'')},
    {label:"CMV / faturamento",cls:"num",render:p=>p.rev?'<strong>'+pct(p.cmv/p.rev)+'</strong>':'<span class="muted">—</span>'}
   ],periods,{rowHref:p=>ctx.base+"/cmv/novo/"+p.a.id+"/"+p.b.id})
   :emptyState("chart","Nenhum período de CMV","São necessárias duas contagens em datas diferentes."),{flush:true}):'')+
  (!showSales&&!showNotes&&!showCmv?alertBox("Nenhum módulo com resumo liberado para esta loja.","info"):'');
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 if(showSales){
  lineChart(ctx.el.querySelector('[data-chart="dia"]'),{labels:dLabels,series:[{name:"Faturamento",color:BRAND,values:dVals}],format:money,tickEvery:5,ariaLabel:"Faturamento por dia no mês atual"});
  lineChart(ctx.el.querySelector('[data-chart="mes"]'),{labels:months.map(monthLabel),series:[
   {name:"Faturamento",color:BRAND,values:mCur},{name:"Mesmo mês do ano anterior",color:GRAY,dash:true,values:mPrev}],format:money,tickEvery:2,ariaLabel:"Faturamento por mês"});
 }
}
