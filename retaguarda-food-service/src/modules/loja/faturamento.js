// Loja · Faturamento. Vendas importadas da Linx Degust One (função "degust", docs/sql/34-vendas-degust.sql).
// Período por dia de caixa. Vendas canceladas ficam fora dos valores (só contadas).
// As vendas ficam só no Cloudflare R2: o resumo vem da função "degust" (ação "resumo", ver ../shared/vendas.js).
// Clicar em um dia da tabela "Por dia" abre os recibos do dia (./recibos.js).
// Administrador da Matriz pode importar (ou reimportar) os dias do período: cada dia é apagado e gravado de novo.
import {supabase} from "../../core/db.js";
import {salesSummary,clearSalesCache} from "../shared/vendas.js";
import {receiptsModal} from "./recibos.js";
import {e,money,num,dateBR,today,addDays,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,card,toast,alertBox,searchBox,searchKey,errorMessage} from "../../core/ui.js";

const range={};          // período escolhido por loja (enquanto a página estiver aberta)
const pct=(a,b)=>b?(Math.round(a/b*1000)/10).toLocaleString("pt-BR")+"%":"—";
const days=(from,to)=>{const out=[];for(let d=from;d<=to;d=addDays(d,1))out.push(d);return out};
// Quadro retrátil (fechado ao abrir a página): só o Resumo do período fica sempre aberto.
const fold=(title,body,opts={})=>'<details class="card fold"><summary class="card-head"><h2>'+e(title)+'</h2><span class="fold-right">'+(opts.actions||"")+'<span class="fold-chev" aria-hidden="true"></span></span></summary><div class="card-body flush">'+body+'</div></details>';
const weekday=d=>new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","");


export async function render(ctx){
 const store=ctx.store||ctx.app.stores.find(s=>s.id===ctx.storeId)||{};
 const yesterday=addDays(today(),-1);
 const r=range[ctx.storeId]||(range[ctx.storeId]={from:today().slice(0,8)+"01",to:yesterday<today().slice(0,8)+"01"?today():yesterday});
 const sum=await salesSummary(ctx.storeId,r.from,r.to);
 const byDay=sum.days,byProd=sum.products,byPay=sum.payments,imports=sum.imported.map(d=>({business_date:d}));
 if(!ctx.isCurrent())return;
 const N=v=>Number(v||0);
 const dayMap=new Map(byDay.map(d=>[String(d.business_date).slice(0,10),d]));
 const imported=new Set(imports.map(i=>String(i.business_date).slice(0,10)));
 const allDays=days(r.from,r.to);
 const t={sales:0,cancelled:0,gross:0,discount:0,net:0};
 for(const d of byDay){t.sales+=N(d.sales);t.cancelled+=N(d.cancelled);t.gross+=N(d.gross);t.discount+=N(d.discount);t.net+=N(d.net)}
 const ticket=t.sales?round2(t.net/t.sales):0;
 const missing=allDays.filter(d=>!imported.has(d)&&d<=today());
 const prodTotal=byProd.reduce((s,p)=>s+N(p.net),0);
 const payTotal=byPay.reduce((s,p)=>s+N(p.amount),0);
 const canImport=!!ctx.app.isAdmin&&!!store.degust_code;

 ctx.el.innerHTML=pageHead("Faturamento","",
   canImport?btn("Importar vendas do período",{icon:"refresh",attrs:"data-import"}):"")+
  '<section class="card"><div class="toolbar" style="padding:14px 18px;gap:10px;flex-wrap:wrap;align-items:flex-end">'+
   '<label class="field" style="margin:0"><span class="field-label">De</span><input class="control" type="date" name="from" value="'+e(r.from)+'"></label>'+
   '<label class="field" style="margin:0"><span class="field-label">Até</span><input class="control" type="date" name="to" value="'+e(r.to)+'"></label>'+
   btn("Este mês",{variant:"secondary",sm:true,attrs:'data-q="mes"'})+btn("Mês passado",{variant:"secondary",sm:true,attrs:'data-q="ant"'})+btn("Últimos 7 dias",{variant:"secondary",sm:true,attrs:'data-q="7"'})+
  '</div></section>'+
  (!store.degust_code?alertBox("Esta loja ainda não está vinculada a um código do Degust. Peça à Matriz para fazer o vínculo.","info"):'')+
  (missing.length&&store.degust_code?alertBox(missing.length+" dia(s) do período ainda sem vendas importadas"+(canImport?': use "Importar vendas do período".':'.'),"warn"):'')+
  card("Resumo do período",'<ul class="list-plain calc">'+
   '<li><span>Vendas</span><strong>'+num(t.sales,0)+'</strong></li>'+
   '<li><span>Valor bruto dos produtos</span><strong>'+money(round2(t.gross))+'</strong></li>'+
   '<li><span>− Descontos</span><strong>'+money(round2(t.discount))+'</strong></li>'+
   '<li class="total"><span class="label">Faturamento líquido</span><strong>'+money(round2(t.net))+'</strong></li>'+
   '<li><span class="muted">Ticket médio</span><strong>'+money(ticket)+'</strong></li>'+
   '<li><span class="muted">Vendas canceladas (fora dos valores)</span><strong>'+num(t.cancelled,0)+'</strong></li></ul>',{flush:true})+
  fold("Por dia",dataTable([
   {label:"Dia",render:d=>'<span class="strong">'+dateBR(d)+'</span><small class="sub">'+weekday(d)+'</small>'},
   {label:"Vendas",cls:"num",render:d=>dayMap.has(d)?num(N(dayMap.get(d).sales),0):(imported.has(d)?'0':'<span class="muted">não importado</span>')},
   {label:"Canceladas",cls:"num",render:d=>dayMap.has(d)?num(N(dayMap.get(d).cancelled),0):'<span class="muted">—</span>'},
   {label:"Bruto",cls:"num",render:d=>dayMap.has(d)?money(N(dayMap.get(d).gross)):'<span class="muted">—</span>'},
   {label:"Descontos",cls:"num",render:d=>dayMap.has(d)?money(N(dayMap.get(d).discount)):'<span class="muted">—</span>'},
   {label:"Líquido",cls:"num",render:d=>dayMap.has(d)?'<strong>'+money(N(dayMap.get(d).net))+'</strong>':'<span class="muted">—</span>'},
   {label:"Ticket médio",cls:"num",render:d=>{const x=dayMap.get(d);return x&&N(x.sales)?money(round2(N(x.net)/N(x.sales))):'<span class="muted">—</span>'}}
  ],allDays.slice().reverse(),{rowAttrs:d=>dayMap.has(d)&&N(dayMap.get(d).sales)+N(dayMap.get(d).cancelled)>0?'class="day-link" data-day="'+d+'" tabindex="0" title="Ver os recibos do dia"':""}),{flush:true,actions:'<small class="muted">Clique em um dia para ver os recibos</small>'})+
  fold("Produtos vendidos ("+byProd.length+")",'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("qp","Buscar produto")+'</div>'+dataTable([
   {label:"Produto",render:p=>'<span class="strong">'+e(p.product_name||"Produto")+'</span><small class="sub">Cód. '+e(p.product_code??"")+'</small>'},
   {label:"Qtd",cls:"num",render:p=>num(N(p.quantity))},
   {label:"Bruto",cls:"num",render:p=>money(N(p.total))+(N(p.discount)?'<small class="sub">− '+money(N(p.discount))+'</small>':'')},
   {label:"Líquido",cls:"num",render:p=>'<strong>'+money(N(p.net))+'</strong>'},
   {label:"% do total",cls:"num",render:p=>pct(N(p.net),prodTotal)}
  ],byProd,{rowAttrs:p=>'data-search="'+e(searchKey(p.product_name||"",String(p.product_code??"")))+'"',empty:'<p class="muted" style="padding:14px 18px;margin:0">Nenhuma venda no período.</p>'}),{flush:true})+
  fold("Formas de pagamento",dataTable([
   {label:"Forma",render:p=>'<span class="strong">'+e(p.method)+'</span>'+(p.brand?'<small class="sub">'+e(p.brand)+'</small>':'')},
   {label:"Qtd",cls:"num",render:p=>num(N(p.payments),0)},
   {label:"Valor",cls:"num",render:p=>money(N(p.amount))+'<small class="sub">'+pct(N(p.amount),payTotal)+'</small>'}
  ],byPay,{empty:'<p class="muted" style="padding:14px 18px;margin:0">Nenhum pagamento no período.</p>'}),{flush:true});

 // Período
 const setRange=(from,to)=>{if(!from||!to)return;if(to<from)[from,to]=[to,from];range[ctx.storeId]={from,to};ctx.reload()};
 ctx.el.querySelectorAll('input[name=from],input[name=to]').forEach(i=>i.addEventListener("change",()=>setRange(ctx.el.querySelector('input[name=from]').value,ctx.el.querySelector('input[name=to]').value)));
 ctx.el.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{
  const q=b.dataset.q,m=today().slice(0,8)+"01";
  if(q==="mes")setRange(m,today());
  else if(q==="ant"){const end=addDays(m,-1);setRange(end.slice(0,8)+"01",end)}
  else setRange(addDays(today(),-7),addDays(today(),-1));
 });
 // Recibos do dia (popin) → recibo em estilo cartoon.
 ctx.el.querySelectorAll("tr[data-day]").forEach(tr=>{const go=()=>receiptsModal(ctx,tr.dataset.day);tr.onclick=go;tr.onkeydown=ev=>{if(ev.key==="Enter")go()}});
 const qp=ctx.el.querySelector("#qp");
 qp?.addEventListener("input",()=>{const s=searchKey(qp.value).trim();ctx.el.querySelectorAll("tr[data-search]").forEach(x=>x.hidden=!!s&&!x.dataset.search.includes(s))});

 // Importação (admin): um dia por vez, do mais antigo ao mais recente; dias futuros ficam de fora.
 ctx.el.querySelector("[data-import]")?.addEventListener("click",async ev=>{
  const b=ev.currentTarget;const label=b.querySelector("span");const ds=allDays.filter(d=>d<=today());
  if(!ds.length)return toast("Nenhum dia para importar.","danger");
  b.disabled=true;let ok=0,fail=[];
  for(const d of ds){
   label.textContent="Importando "+dateBR(d)+" ("+(ok+fail.length+1)+"/"+ds.length+")…";
   try{
    const res=await supabase.functions.invoke("degust",{body:{acao:"importar",storeId:ctx.storeId,data:d}});
    if(res.error){let msg=res.error.message;try{msg=JSON.parse(await res.error.context.text()).erro||msg}catch{}throw Error(msg)}
    ok++;
   }catch(error){fail.push(dateBR(d)+": "+errorMessage(error))}
   if(!ctx.isCurrent())return;
  }
  clearSalesCache();
  toast(ok+" dia(s) importado(s)"+(fail.length?"; "+fail.length+" com erro":"")+".",fail.length?"danger":"ok");
  if(fail.length)console.warn("Falhas na importação:",fail);
  ctx.reload();
 });
}
