// Matriz · Painel (refeito em 24/11/2026, pedido do usuário): uma tabela com todas as lojas e o faturamento líquido
// de cada dia do mês. Linhas agrupadas pelo prefixo do código (marca: DEL primeiro, as outras em ordem alfabética) e,
// dentro do grupo, ordenadas pelo 2º pedaço do código (aeroporto). Rolagem horizontal, sem quebra de texto.
// Dias que ainda não fecharam (hoje em diante) mostram a projeção (public.sales_forecast, recalculada todo dia às 06:30),
// em itálico. Últimas colunas: Total realizado (dias fechados) e Total projetado (realizado + projeção até o fim do mês).
// Ordem fixa (data, loja) é obrigatória: a leitura vem em páginas de 1000 e, sem ordem, linhas se repetem ou somem.
// Abaixo: ranking de faturamento realizado no mês (loja, valor, % de participação).
// Fonte: public.sales_imports (líquido por loja e dia, gravado pela importação do Degust; RLS = quem vê Faturamento/CMV).
import {list} from "../../core/db.js";
import {e,money,today,addDays} from "../../core/format.js";
import {pageHead,card,emptyState} from "../../core/ui.js";

const MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const SEM=["dom","seg","ter","qua","qui","sex","sáb"];
const int=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
let month=null; // "AAAA-MM" escolhido (fica enquanto o app estiver aberto)
let rkMonth=null; // mês do ranking (independente da tabela diária)

export async function render(ctx){
 const hoje=today();
 if(!month)month=hoje.slice(0,7);
 const ini=month+"-01",last=new Date(+month.slice(0,4),+month.slice(5,7),0).getDate();
 const fimMes=month+"-"+String(last).padStart(2,"0");
 // Realizado: até ontem (a importação do dia é feita na manhã seguinte). De hoje até o fim do mês: projeção.
 const ontem=addDays(hoje,-1),fimReal=fimMes<ontem?fimMes:ontem,iniProj=hoje>ini?hoje:ini;
 const days=[];for(let d=ini;d<=fimMes;d=addDays(d,1))days.push(d);
 const isProj=d=>d>fimReal;

 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const [rows,fc]=await Promise.all([
  fimReal>=ini?list("sales_imports",{select:"store_id,business_date,net",gte:{business_date:ini},lte:{business_date:fimReal},order:"business_date",asc:true,order2:"store_id",asc2:true,limit:50000}):[],
  fimMes>=iniProj?list("sales_forecast",{select:"store_id,business_date,projected_net",gte:{business_date:iniProj},lte:{business_date:fimMes},order:"business_date",asc:true,order2:"store_id",asc2:true,limit:20000}).catch(()=>[]):[]
 ]);
 if(!ctx.isCurrent())return;

 const val=new Map();
 for(const r of fc)val.set(r.store_id+"|"+r.business_date,Number(r.projected_net)||0);
 for(const r of rows)val.set(r.store_id+"|"+r.business_date,Number(r.net)||0);
 const parts=s=>String(s.code||s.id).split("-");
 const groups=new Map();
 for(const s of stores){const g=parts(s)[0]||"—";(groups.get(g)||groups.set(g,[]).get(g)).push(s)}
 const order=[...groups.keys()].sort((a,b)=>(a==="DEL"?-1:b==="DEL"?1:a.localeCompare(b)));
 for(const g of order)groups.get(g).sort((a,b)=>(parts(a)[1]||"").localeCompare(parts(b)[1]||"")||String(a.code).localeCompare(String(b.code)));

 const wkd=d=>{const w=new Date(d+"T12:00:00").getDay();return w===0||w===6?" pm-wk":""};
 const cls=d=>wkd(d)+(isProj(d)?" pm-proj":"");
 const cell=(v,c="",tip="")=>'<td class="num'+c+'"'+(v?' title="'+e((tip?tip+": ":"")+money(v))+'"':'')+'>'+(v?int.format(v):'<span class="muted">—</span>')+'</td>';
 const sumOf=(ls,d)=>ls.reduce((t,s)=>t+(val.get(s.id+"|"+d)||0),0);
 const rowHtml=(label,ls,rc,href)=>{
  const per=days.map(d=>sumOf(ls,d));
  const real=per.reduce((t,v,i)=>t+(isProj(days[i])?0:v),0),proj=per.reduce((a,b)=>a+b,0);
  return '<tr class="'+rc+'"'+(href?' data-href="'+e(href)+'"':'')+'><th scope="row" class="pm-name">'+label+'</th>'+
   per.map((v,i)=>cell(v,cls(days[i]),isProj(days[i])?"Projetado":"")).join("")+
   cell(real," pm-tot pm-first","Realizado")+cell(proj," pm-tot","Projetado no mês")+'</tr>';
 };
 let body="";
 for(const g of order){
  const ls=groups.get(g);
  body+=rowHtml('<span class="pm-grp">'+e(g)+'</span><small> · '+ls.length+(ls.length===1?' loja':' lojas')+'</small>',ls,"pm-group");
  for(const s of ls)body+=rowHtml('<span class="strong">'+e(s.code||s.id)+'</span>',[s],"pm-store","#/loja/"+encodeURIComponent(s.id)+"/faturamento");
 }
 const head='<tr><th scope="col" class="pm-name">Loja</th>'+
  days.map(d=>'<th scope="col" class="num'+cls(d)+'"'+(isProj(d)?' title="Projeção"':'')+'>'+d.slice(8)+'<small>'+(isProj(d)?'proj. ':'')+SEM[new Date(d+"T12:00:00").getDay()]+'</small></th>').join("")+
  '<th scope="col" class="num pm-tot pm-first">Total geral<small>realizado</small></th><th scope="col" class="num pm-tot">Total projetado<small>fim do mês</small></th></tr>';
 const foot=rowHtml("Total da rede",stores,"pm-net");

 const [y,m]=month.split("-").map(Number);
 const prev=addDays(ini,-1).slice(0,7),next=addDays(fimMes,1).slice(0,7),canNext=next<=hoje.slice(0,7);
 const nav='<div class="pm-month"><button type="button" class="icon-btn" data-m="'+prev+'" aria-label="Mês anterior">‹</button>'+
  '<strong>'+MESES[m-1][0].toUpperCase()+MESES[m-1].slice(1)+' de '+y+'</strong>'+
  '<button type="button" class="icon-btn" data-m="'+next+'" aria-label="Próximo mês"'+(canNext?'':' disabled')+'>›</button></div>';
 const table=stores.length?'<div class="pm-scroll"><table class="pm-table"><thead>'+head+'</thead><tbody>'+body+'</tbody><tfoot>'+foot+'</tfoot></table></div>':
  emptyState("store","Nenhuma loja em operação");
 const temProj=days.some(isProj);
 ctx.el.innerHTML=pageHead("Painel da Matriz","Faturamento líquido (R$) de cada loja, dia a dia"+(temProj?"; de hoje em diante, em itálico, a projeção":"")+". Clique na loja para abrir o faturamento dela.",nav)+
  card("",table,{flush:true})+'<section class="card" data-rk-card></section>';
 ctx.el.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{month=b.dataset.m;render(ctx)});
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>{location.hash=tr.dataset.href.replace(/^#/,"")});
 if(!rkMonth)rkMonth=month;
 drawRanking(ctx,stores);
 // Abre rolada até o fim: últimos dias (com a projeção) e as colunas de total à vista.
 const sc=ctx.el.querySelector(".pm-scroll");if(sc)sc.scrollLeft=sc.scrollWidth;
}

// Ranking de faturamento (realizado no mês, até ontem): loja, valor e % de participação na rede. Só lojas com venda.
// Tem o próprio seletor de mês; só este card é refeito ao trocar.
async function drawRanking(ctx,stores){
 const box=ctx.el.querySelector("[data-rk-card]");if(!box)return;
 const hoje=today(),ontem=addDays(hoje,-1),mm=rkMonth;
 const ini=mm+"-01",fimMes=mm+"-"+String(new Date(+mm.slice(0,4),+mm.slice(5,7),0).getDate()).padStart(2,"0"),fim=fimMes<ontem?fimMes:ontem;
 const [y,m]=mm.split("-").map(Number);
 const prev=addDays(ini,-1).slice(0,7),next=addDays(fimMes,1).slice(0,7),canNext=next<=hoje.slice(0,7);
 const nav='<div class="pm-month"><button type="button" class="icon-btn" data-rkm="'+prev+'" aria-label="Mês anterior do ranking">‹</button>'+
  '<strong>'+MESES[m-1][0].toUpperCase()+MESES[m-1].slice(1)+' de '+y+'</strong>'+
  '<button type="button" class="icon-btn" data-rkm="'+next+'" aria-label="Próximo mês do ranking"'+(canNext?'':' disabled')+'>›</button></div>';
 const head=sub=>'<header class="card-head"><h2>Ranking de faturamento'+(sub?'<small class="pm-rk-sub"> '+sub+'</small>':'')+'</h2>'+nav+'</header>';
 const bind=()=>box.querySelectorAll("[data-rkm]").forEach(b=>b.onclick=()=>{rkMonth=b.dataset.rkm;drawRanking(ctx,stores)});
 box.innerHTML=head("")+'<div class="card-body"><p class="muted" style="margin:0">Carregando…</p></div>';bind();
 const rows=fim>=ini?await list("sales_imports",{select:"store_id,net",gte:{business_date:ini},lte:{business_date:fim},order:"business_date",asc:true,order2:"store_id",asc2:true,limit:50000}):[];
 if(!ctx.isCurrent()||mm!==rkMonth)return;
 const tot=new Map();for(const r of rows)tot.set(r.store_id,(tot.get(r.store_id)||0)+(Number(r.net)||0));
 const rk=stores.map(st=>({st,v:tot.get(st.id)||0})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
 const rkTot=rk.reduce((t,x)=>t+x.v,0),pctF=new Intl.NumberFormat("pt-BR",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2});
 const body=rk.length?'<div class="pm-scroll pm-rk-scroll"><table class="pm-table pm-rk"><thead><tr><th scope="col" class="num">#</th><th scope="col">Loja</th><th scope="col" class="num">Faturamento</th><th scope="col" class="num">Participação</th></tr></thead><tbody>'+
  rk.map((x,i)=>{const p=rkTot?x.v/rkTot:0;return '<tr class="pm-store" data-href="#/loja/'+encodeURIComponent(x.st.id)+'/faturamento"><td class="num muted">'+(i+1)+'º</td><td><span class="strong">'+e(x.st.code||x.st.id)+'</span>'+(x.st.name&&x.st.name!==x.st.code?' <span class="muted">· '+e(x.st.name)+'</span>':'')+'</td>'+
   '<td class="num">'+money(x.v)+'</td><td class="num"><span class="pm-bar"><i style="width:'+(p/(rk[0].v/rkTot)*100).toFixed(1)+'%"></i></span>'+pctF.format(p)+'</td></tr>'}).join("")+
  '</tbody><tfoot><tr><td></td><td>Total da rede · '+rk.length+' lojas</td><td class="num">'+money(rkTot)+'</td><td class="num">'+pctF.format(1)+'</td></tr></tfoot></table></div>':
  emptyState("chart","Sem faturamento no mês");
 box.innerHTML=head(fim<fimMes&&fim>=ini?"até "+fim.slice(8)+"/"+fim.slice(5,7):"")+'<div class="card-body flush">'+body+'</div>';bind();
 box.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>{location.hash=tr.dataset.href.replace(/^#/,"")});
}
