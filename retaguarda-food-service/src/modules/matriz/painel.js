// Matriz · Painel (refeito em 24/11/2026, pedido do usuário): uma tabela com todas as lojas e o faturamento líquido
// de cada dia do mês. Linhas agrupadas pelo prefixo do código (marca: DEL primeiro, as outras em ordem alfabética) e,
// dentro do grupo, ordenadas pelo 2º pedaço do código (aeroporto). Rolagem horizontal, sem quebra de texto.
// Ordem fixa (data, loja) é obrigatória: a leitura vem em páginas de 1000 e, sem ordem, linhas se repetem ou somem.
// Fonte: public.sales_imports (líquido por loja e dia, gravado pela importação do Degust; RLS = quem vê Faturamento/CMV).
import {list} from "../../core/db.js";
import {e,money,today,addDays} from "../../core/format.js";
import {pageHead,card,emptyState} from "../../core/ui.js";

const MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const SEM=["dom","seg","ter","qua","qui","sex","sáb"];
const int=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
let month=null; // "AAAA-MM" escolhido (fica enquanto o app estiver aberto)

export async function render(ctx){
 const hoje=today();
 if(!month)month=hoje.slice(0,7);
 const ini=month+"-01",last=new Date(+month.slice(0,4),+month.slice(5,7),0).getDate();
 // Dias do mês até ontem (o dia de hoje ainda está em andamento e a importação é feita no dia seguinte).
 const ontem=addDays(hoje,-1);
 const fimMes=month+"-"+String(last).padStart(2,"0"),fim=fimMes<ontem?fimMes:ontem;
 const days=[];for(let d=ini;d<=fim;d=addDays(d,1))days.push(d);

 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const rows=days.length?await list("sales_imports",{select:"store_id,business_date,net",gte:{business_date:ini},lte:{business_date:fim},order:"business_date",asc:true,order2:"store_id",asc2:true,limit:50000}):[];
 if(!ctx.isCurrent())return;

 const val=new Map();for(const r of rows)val.set(r.store_id+"|"+r.business_date,Number(r.net)||0);
 const parts=s=>String(s.code||s.id).split("-");
 const groups=new Map();
 for(const s of stores){const g=parts(s)[0]||"—";(groups.get(g)||groups.set(g,[]).get(g)).push(s)}
 const order=[...groups.keys()].sort((a,b)=>(a==="DEL"?-1:b==="DEL"?1:a.localeCompare(b)));
 for(const g of order)groups.get(g).sort((a,b)=>(parts(a)[1]||"").localeCompare(parts(b)[1]||"")||String(a.code).localeCompare(String(b.code)));

 const cell=(v,cls="")=>'<td class="num'+cls+'"'+(v?' title="'+e(money(v))+'"':'')+'>'+(v?int.format(v):'<span class="muted">—</span>')+'</td>';
 const wkd=d=>{const w=new Date(d+"T12:00:00").getDay();return w===0||w===6?" pm-wk":""};
 const sumOf=(ls,d)=>ls.reduce((t,s)=>t+(val.get(s.id+"|"+d)||0),0);
 const rowHtml=(label,ls,cls,href)=>{
  const per=days.map(d=>sumOf(ls,d)),tot=per.reduce((a,b)=>a+b,0);
  return '<tr class="'+cls+'"'+(href?' data-href="'+e(href)+'"':'')+'><th scope="row" class="pm-name">'+label+'</th>'+cell(tot," pm-tot")+per.map((v,i)=>cell(v,wkd(days[i]))).join("")+'</tr>';
 };
 let body="";
 for(const g of order){
  const ls=groups.get(g);
  body+=rowHtml('<span class="pm-grp">'+e(g)+'</span><small> · '+ls.length+(ls.length===1?' loja':' lojas')+'</small>',ls,"pm-group");
  for(const s of ls)body+=rowHtml('<span class="strong">'+e(s.code||s.id)+'</span>',[s],"pm-store","#/loja/"+encodeURIComponent(s.id)+"/faturamento");
 }
 const head='<tr><th scope="col" class="pm-name">Loja</th><th scope="col" class="num pm-tot">Total</th>'+
  days.map(d=>'<th scope="col" class="num'+wkd(d)+'">'+d.slice(8)+'<small>'+SEM[new Date(d+"T12:00:00").getDay()]+'</small></th>').join("")+'</tr>';
 const foot=rowHtml("Total da rede",stores,"pm-net");

 const [y,m]=month.split("-").map(Number);
 const prev=addDays(ini,-1).slice(0,7),next=addDays(fimMes,1).slice(0,7),canNext=next<=hoje.slice(0,7);
 const nav='<div class="pm-month"><button type="button" class="icon-btn" data-m="'+prev+'" aria-label="Mês anterior">‹</button>'+
  '<strong>'+MESES[m-1][0].toUpperCase()+MESES[m-1].slice(1)+' de '+y+'</strong>'+
  '<button type="button" class="icon-btn" data-m="'+next+'" aria-label="Próximo mês"'+(canNext?'':' disabled')+'>›</button></div>';
 const table=days.length&&stores.length?'<div class="pm-scroll"><table class="pm-table"><thead>'+head+'</thead><tbody>'+body+'</tbody><tfoot>'+foot+'</tfoot></table></div>':
  emptyState("chart",stores.length?"Sem dias fechados neste mês":"Nenhuma loja em operação",stores.length?"Os valores aparecem a partir do dia seguinte.":"");
 ctx.el.innerHTML=pageHead("Painel da Matriz","Faturamento líquido (R$) de cada loja, dia a dia, até ontem. Clique na loja para abrir o faturamento dela.",nav)+
  card("",table,{flush:true});
 ctx.el.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{month=b.dataset.m;render(ctx)});
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>{location.hash=tr.dataset.href.replace(/^#/,"")});
}
