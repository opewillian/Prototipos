// Tour guiado da Retaguarda: botão "Tour" na barra superior. Destaca cada parte da tela e explica para que serve.
// Os passos dependem do ambiente (Matriz ou Loja) e só aparecem para o que existe na tela (módulos liberados).
// Teclado: → / Enter avança, ← volta, Esc fecha.
import {e} from "./format.js";

const grp=name=>'.sb-group[data-group="'+name+'"]';

function steps(area){
 const common=[
  {title:"Bem-vindo à Retaguarda",text:"A Retaguarda junta estoque, compras, faturamento e CMV das lojas em um só lugar. Este tour mostra onde fica cada coisa. Leva menos de um minuto."},
  {sel:".sb",side:"right",title:"Menu",text:"Aqui ficam os módulos, separados por grupo. Você só vê o que foi liberado para o seu usuário. O botão ☰ no topo recolhe ou abre o menu."},
  {sel:".sb-search",side:"right",title:"Pesquisar no menu",text:"Digite o nome de uma tela (ex.: \"notas\") e aperte Enter para ir direto a ela."},
  {sel:"[data-env-field]:not([hidden])",title:"Ambiente",text:"Matriz é a visão central: cadastros e acompanhamento de todas as lojas. Loja é a rotina do dia a dia de uma unidade."},
  {sel:"#store-combo",title:"Loja",text:"Troque de loja por aqui, buscando pelo nome ou código. Atalho: Ctrl+K. Ao trocar, você continua na mesma tela."}
 ];
 const loja=[
  {sel:'#nav a[href$="/inicio"]',side:"right",title:"Início",text:"Resumo da loja: faturamento do mês com a projeção até o fim do mês (linha pontilhada), comparação com o ano anterior, CMV de cada período e notas que ainda não deram entrada."},
  {sel:grp("Financeiro"),side:"right",title:"Financeiro · Faturamento",text:"Vendas do caixa (Degust), importadas sozinhas todo dia às 6h. Mostra o faturamento por dia, os produtos mais vendidos e as formas de pagamento."},
  {sel:grp("Estoque"),side:"right",title:"Estoque",text:"Contagem: inventário feito por listas, fica em rascunho até ser finalizado. Listas: quais itens contar. Transferências e Perdas: o que saiu da loja para outra unidade ou foi perdido."},
  {sel:grp("Compras"),side:"right",title:"Compras",text:"Pedidos de compra aos fornecedores e Notas fiscais. Na nota você confere o de-para dos itens e a data de entrada; ao dar entrada, ela passa a contar no estoque e no CMV."},
  {sel:grp("Análise"),side:"right",title:"Análise · CMV",text:"Escolha duas contagens: estoque inicial + compras + transferências recebidas − enviadas − estoque final = CMV. Clique nos números para ver a memória de cálculo e use \"Análise completa\" para achar divergências."}
 ];
 const matriz=[
  {sel:'#nav a[href$="/painel"]',side:"right",title:"Painel",text:"Visão consolidada das lojas em operação e dos pedidos mais recentes."},
  {sel:'#nav a[href$="/pedidos"]',side:"right",title:"Pedidos das lojas",text:"Todos os pedidos de compra das lojas, com filtro por loja, fornecedor e situação."},
  {sel:'#nav a[href$="/notas"]',side:"right",title:"Notas fiscais",text:"Notas de todas as lojas que você acessa, para acompanhar o que está pendente de entrada."},
  {sel:grp("Cadastros"),side:"right",title:"Cadastros",text:"Itens, marcas, fornecedores e de-para valem para todas as lojas. Em Usuários e acessos você libera lojas e módulos para cada pessoa; o Log mostra quem mudou o quê."}
 ];
 const end=[{sel:"[data-tour]",title:"Pronto!",text:"Sempre que precisar, clique em Tour para ver esta explicação de novo."}];
 return [...common,...(area==="matriz"?matriz:loja),...end];
}

let active=null;

export function startTour(root){
 if(active)active.close();
 const shell=root.querySelector("#shell");
 const mobile=()=>window.matchMedia("(max-width:960px)").matches;
 const list=steps(shell?.dataset.area).filter(s=>!s.sel||visible(root.querySelector(s.sel)));
 if(!list.length)return;
 const wasCollapsed=shell?.classList.contains("collapsed");
 const ov=document.createElement("div");
 ov.className="tour";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-label","Tour do sistema");
 ov.innerHTML='<div class="tour-hole" hidden></div><div class="tour-card" role="document"><div class="tour-step"></div><h3></h3><p></p>'+
  '<div class="tour-actions"><button type="button" class="btn btn-ghost" data-tour-skip>Sair do tour</button><span class="tour-sp"></span>'+
  '<button type="button" class="btn btn-ghost" data-tour-prev>Voltar</button><button type="button" class="btn btn-primary" data-tour-next>Próximo</button></div></div>';
 document.body.appendChild(ov);
 const hole=ov.querySelector(".tour-hole"),card=ov.querySelector(".tour-card");
 let i=0;
 const target=s=>s.sel?root.querySelector(s.sel):null;
 function place(){
  const s=list[i],el=target(s);
  const vw=window.innerWidth,vh=window.innerHeight,cw=Math.min(360,vw-32);
  card.style.width=cw+"px";
  ov.classList.toggle("tour-dim",!el);
  if(!el){hole.hidden=true;card.style.left=Math.round((vw-cw)/2)+"px";card.style.top=Math.round(Math.max(16,(vh-card.offsetHeight)/2))+"px";card.classList.add("center");return}
  card.classList.remove("center");
  const r=el.getBoundingClientRect(),pad=6;
  Object.assign(hole.style,{left:(r.left-pad)+"px",top:(r.top-pad)+"px",width:(r.width+pad*2)+"px",height:(r.height+pad*2)+"px"});hole.hidden=false;
  const ch=card.offsetHeight;let left,top;
  if(s.side==="right"&&r.right+16+cw<=vw){left=r.right+16;top=r.top}
  else{left=r.left;top=r.bottom+14;if(top+ch>vh-16)top=r.top-ch-14}
  left=Math.max(16,Math.min(left,vw-cw-16));top=Math.max(16,Math.min(top,vh-ch-16));
  card.style.left=Math.round(left)+"px";card.style.top=Math.round(top)+"px";
 }
 function show(n){
  i=Math.max(0,Math.min(list.length-1,n));
  const s=list[i],el=target(s);
  // Passos do menu: abre o menu (recolhido no computador ou escondido no celular).
  const inMenu=!!el?.closest(".sb");
  if(shell){
   if(mobile())shell.classList.toggle("nav-open",inMenu);
   else shell.classList.toggle("collapsed",inMenu?false:!!wasCollapsed);
   if(inMenu&&el.classList.contains("sb-group"))el.classList.add("open");
  }
  ov.querySelector(".tour-step").textContent=(i+1)+" de "+list.length;
  ov.querySelector("h3").textContent=s.title;
  ov.querySelector("p").innerHTML=e(s.text);
  ov.querySelector("[data-tour-prev]").hidden=i===0;
  ov.querySelector("[data-tour-next]").textContent=i===list.length-1?"Concluir":"Próximo";
  el?.scrollIntoView({block:"nearest"});
  requestAnimationFrame(place);
  ov.querySelector("[data-tour-next]").focus();
 }
 const onKey=ev=>{
  if(ev.key==="Escape"){ev.preventDefault();close()}
  else if(ev.key==="ArrowRight"){ev.preventDefault();next()}
  else if(ev.key==="ArrowLeft"){ev.preventDefault();show(i-1)}
 };
 const next=()=>i===list.length-1?close():show(i+1);
 function close(){
  ov.remove();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("keydown",onKey,true);
  if(shell){shell.classList.remove("nav-open");shell.classList.toggle("collapsed",!!wasCollapsed)}
  active=null;root.querySelector("[data-tour]")?.focus();
 }
 ov.querySelector("[data-tour-next]").onclick=next;
 ov.querySelector("[data-tour-prev]").onclick=()=>show(i-1);
 ov.querySelector("[data-tour-skip]").onclick=close;
 ov.addEventListener("click",ev=>{if(ev.target===ov)close()});
 window.addEventListener("resize",place);window.addEventListener("scroll",place,true);document.addEventListener("keydown",onKey,true);
 active={close};
 show(0);
}

// O passo só entra se o elemento existe e aparece (o menu conta mesmo recolhido ou escondido no celular: o tour abre).
function visible(el){
 if(!el||el.closest("[hidden]"))return false;
 if(el.closest(".sb"))return true;
 return el.getClientRects().length>0;
}
