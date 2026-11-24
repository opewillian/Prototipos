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

// Ranking de faturamento (realizado no mês, até ontem): loja, valor e % de participação na rede. Só lojas com venda; páginas de no mínimo 10 (até o fim do card, ao lado das pizzas); largura das colunas fixa.
// Tem o próprio seletor de mês; só este card é refeito ao trocar. À direita: pizzas de participação por marca (1º prefixo)
// e por aeroporto (2º prefixo); clique na fatia mostra as lojas daquele prefixo.
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
 // Linhas por página: no mínimo 10; se a coluna das pizzas for mais alta, cabe mais lojas até o fim do card.
 // Largura das colunas fixa (medida com todas as lojas), para a tabela não mudar de tamanho ao trocar de página.
 let PG=10,first=0,colW=null,pages=1;
 const pager=page=>'<div class="rk-pager"><span class="muted">'+(rk.length?(page*PG+1)+'–'+Math.min(rk.length,page*PG+PG)+' de '+rk.length+' lojas':'')+'</span>'+
  (pages>1?'<span class="rk-pages"><button type="button" class="icon-btn" data-rkp="'+(page-1)+'"'+(page===0?' disabled':'')+' aria-label="Página anterior">‹</button>'+
  Array.from({length:pages},(_,k)=>'<button type="button" class="rk-pg'+(k===page?' on':'')+'" data-rkp="'+k+'"'+(k===page?' aria-current="page"':'')+'>'+(k+1)+'</button>').join("")+
  '<button type="button" class="icon-btn" data-rkp="'+(page+1)+'"'+(page===pages-1?' disabled':'')+' aria-label="Próxima página">›</button></span>':'')+'</div>';
 const sub=fim<fimMes&&fim>=ini?"até "+fim.slice(8)+"/"+fim.slice(5,7):"";
 // Pizzas de participação: 1º prefixo do código (marca) e 2º prefixo (aeroporto). Clique abre as lojas do prefixo.
 const pies=rk.length?pieCard("marca","Participação por marca",groupBy(rk,0),rkTot,pctF)+pieCard("aero","Participação por aeroporto",groupBy(rk,1),rkTot,pctF):"";
 const rowHtml=(x,i)=>{const p=rkTot?x.v/rkTot:0;return '<tr class="pm-store'+(i<3?' pm-top':'')+'" data-href="#/loja/'+encodeURIComponent(x.st.id)+'/faturamento"><td class="num muted">'+(i+1)+'º</td><td><span class="strong">'+e(x.st.code||x.st.id)+'</span>'+(x.st.name&&x.st.name!==x.st.code?' <span class="muted">· '+e(x.st.name)+'</span>':'')+'</td>'+
  '<td class="num">'+money(x.v)+'</td><td class="num"><span class="pm-bar"><i style="width:'+(p/(rk[0].v/rkTot)*100).toFixed(1)+'%"></i></span>'+pctF.format(p)+'</td></tr>'};
 const tableHtml=(from,to)=>'<div class="pm-scroll pm-rk-scroll"><table class="pm-table pm-rk"'+(colW?' style="table-layout:fixed;width:'+colW.reduce((a,b)=>a+b,0)+'px"':'')+'>'+
  (colW?'<colgroup>'+colW.map(w=>'<col style="width:'+w+'px">').join("")+'</colgroup>':'')+
  '<thead><tr><th scope="col" class="num">#</th><th scope="col">Loja</th><th scope="col" class="num">Faturamento</th><th scope="col" class="num">Participação</th></tr></thead><tbody>'+
  rk.slice(from,to).map((x,k)=>rowHtml(x,from+k)).join("")+
  '</tbody><tfoot><tr><td></td><td>Total da rede · '+rk.length+' lojas</td><td class="num">'+money(rkTot)+'</td><td class="num">'+pctF.format(1)+'</td></tr></tfoot></table></div>';
 const draw=page=>{
  page=Math.max(0,Math.min(pages-1,page));first=page*PG;
  const tb=box.querySelector("[data-rk-tbl]");
  tb.innerHTML=tableHtml(page*PG,page*PG+PG)+pager(page);
  tb.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>{location.hash=tr.dataset.href.replace(/^#/,"")});
  tb.querySelectorAll("[data-rkp]").forEach(b=>b.onclick=()=>draw(Number(b.dataset.rkp)));
 };
 // Mede tudo uma vez (todas as lojas): largura de cada coluna e altura de linha, cabeçalho, rodapé e paginação.
 let rowH=40,fixedH=150;
 const measure=()=>{
  const tb=box.querySelector("[data-rk-tbl]");
  tb.innerHTML=tableHtml(0,rk.length)+pager(0);
  const t=tb.querySelector("table");
  colW=[...t.tHead.rows[0].cells].map(c=>Math.ceil(c.getBoundingClientRect().width));
  const rows=t.tBodies[0].rows;rowH=rows.length?rows[0].getBoundingClientRect().height:40;
  fixedH=t.tHead.getBoundingClientRect().height+t.tFoot.getBoundingClientRect().height+(tb.querySelector(".rk-pager")?.getBoundingClientRect().height||50)+2;
 };
 const fit=()=>{
  const piesH=box.querySelector(".pm-pies")?.getBoundingClientRect().height||0;
  const n=Math.max(10,Math.floor((piesH-fixedH)/rowH));
  if(n===PG&&box.querySelector("[data-rk-tbl] table"))return;
  PG=n;pages=Math.max(1,Math.ceil(rk.length/PG));draw(Math.floor(first/PG));
 };
 if(!rk.length){box.innerHTML=head(sub)+'<div class="card-body">'+emptyState("chart","Sem faturamento no mês")+'</div>';bind();return}
 box.innerHTML=head(sub)+'<div class="card-body flush pm-rk-grid"><div class="pm-rk-tbl" data-rk-tbl></div><div class="pm-pies">'+pies+'</div></div>';bind();
 measure();PG=0;fit();
 bindPies(box,rkTot,pctF);
 // Abrir o detalhe de uma pizza aumenta a coluna da direita: a página do ranking acompanha.
 if(window.ResizeObserver){const ro=new ResizeObserver(()=>{if(!box.isConnected){ro.disconnect();return}fit()});ro.observe(box.querySelector(".pm-pies"))}
}

// ------------------------------------------------------------------ Pizzas de participação
// Cores: paleta categórica validada (ordem fixa por fatia, do maior para o menor); a partir da 9ª fatia, "Outros" em cinza.
const PIE_COLORS=["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#6250d6","#e34948"],PIE_OTHER="#a3a3a8";
function groupBy(rk,idx){
 const m=new Map();
 for(const x of rk){const k=String(x.st.code||x.st.id).split("-")[idx]||"—";const g=m.get(k)||m.set(k,{k,v:0,items:[]}).get(k);g.v+=x.v;g.items.push(x)}
 const gs=[...m.values()].sort((a,b)=>b.v-a.v);
 if(gs.length<=8)return gs;
 const rest=gs.slice(7);
 return [...gs.slice(0,7),{k:"Outros",v:rest.reduce((t,g)=>t+g.v,0),items:rest.flatMap(g=>g.items),other:rest.map(g=>g.k),subs:rest}];
}
const pieState={};
function pieCard(id,title,gs,tot,pctF){
 pieState[id]=gs;
 const R=80,C=90;let a0=-Math.PI/2;
 const arcs=gs.map((g,i)=>{
  const frac=tot?g.v/tot:0,a1=a0+frac*2*Math.PI,col=g.other?PIE_OTHER:PIE_COLORS[i];
  let d;
  if(frac>=0.9999)d='M'+C+' '+(C-R)+' A'+R+' '+R+' 0 1 1 '+(C-0.01)+' '+(C-R)+' Z';
  else{const x0=C+R*Math.cos(a0),y0=C+R*Math.sin(a0),x1=C+R*Math.cos(a1),y1=C+R*Math.sin(a1);d='M'+C+' '+C+' L'+x0.toFixed(2)+' '+y0.toFixed(2)+' A'+R+' '+R+' 0 '+(frac>0.5?1:0)+' 1 '+x1.toFixed(2)+' '+y1.toFixed(2)+' Z'}
  a0=a1;
  return '<path d="'+d+'" fill="'+col+'" data-pie="'+id+'" data-i="'+i+'" tabindex="0" role="button" aria-label="'+e(g.k+": "+pctF.format(frac))+'"><title>'+e(g.k+" · "+pctF.format(frac)+" · "+money(g.v))+'</title></path>';
 }).join("");
 const leg=gs.map((g,i)=>'<button type="button" class="pm-leg" data-pie="'+id+'" data-i="'+i+'"><i style="background:'+(g.other?PIE_OTHER:PIE_COLORS[i])+'"></i><span class="pm-leg-k">'+e(g.k)+'</span><span class="pm-leg-p">'+pctF.format(tot?g.v/tot:0)+'</span><span class="pm-leg-v muted">'+money(g.v)+'</span></button>').join("");
 return '<div class="pm-pie" data-pie-box="'+id+'"><h3>'+e(title)+'</h3><div class="pm-pie-row"><svg viewBox="0 0 180 180" width="130" height="130" class="pm-pie-svg" aria-label="'+e(title)+'">'+arcs+'</svg><div class="pm-legend">'+leg+'</div></div>'+
  '<div class="pm-pie-det" data-pie-det="'+id+'"><p class="muted">Clique numa fatia ou na legenda para ver as lojas.</p></div></div>';
}
function bindPies(box,tot,pctF){
 const detRow=(x,gv,ind)=>'<tr class="pm-store'+(ind?' pm-det-ind':'')+'" data-href="#/loja/'+encodeURIComponent(x.st.id)+'/faturamento"><td><span class="strong">'+e(x.st.code||x.st.id)+'</span></td><td class="num">'+money(x.v)+'</td><td class="num">'+pctF.format(tot?x.v/tot:0)+'</td></tr>';
 box.querySelectorAll("[data-pie]").forEach(el=>{
  const act=()=>{
   const id=el.dataset.pie,i=Number(el.dataset.i),g=pieState[id][i],det=box.querySelector('[data-pie-det="'+id+'"]');
   box.querySelectorAll('[data-pie="'+id+'"]').forEach(x=>x.classList.toggle("on",Number(x.dataset.i)===i));
   box.querySelector('[data-pie-box="'+id+'"]').classList.add("sel");
   const its=g.items.slice().sort((a,b)=>b.v-a.v);
   det.innerHTML='<div class="pm-det-head"><strong>'+e(g.k)+'</strong><span class="muted">'+its.length+(its.length===1?' loja':' lojas')+' · '+money(g.v)+' · '+pctF.format(tot?g.v/tot:0)+' da rede</span>'+
    '</div>'+
    '<div class="pm-det-scroll"><table class="pm-table pm-det"><thead><tr><th scope="col">Loja</th><th scope="col" class="num">Faturamento</th><th scope="col" class="num" title="Participação no faturamento da rede">% da rede</th></tr></thead><tbody>'+
    (g.subs
     // "Outros": agrupado pelo prefixo (aeroporto/marca), cada grupo com subtotal. % sempre sobre a rede inteira (pedido do usuário).
     ? g.subs.map(sg=>'<tr class="pm-det-grp"><td><span class="pm-grp">'+e(sg.k)+'</span> <small class="muted">· '+sg.items.length+(sg.items.length===1?' loja':' lojas')+'</small></td><td class="num">'+money(sg.v)+'</td><td class="num">'+pctF.format(tot?sg.v/tot:0)+'</td></tr>'+
        sg.items.slice().sort((a,b)=>b.v-a.v).map(x=>detRow(x,g.v,true)).join("")).join("")
     : its.map(x=>detRow(x,g.v,false)).join(""))+
    '</tbody></table></div>';
   det.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>{location.hash=tr.dataset.href.replace(/^#/,"")});
  };
  el.addEventListener("click",act);
  el.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();act()}});
 });
}
