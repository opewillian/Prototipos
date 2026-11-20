// Sugestões enquanto digita, para qualquer <input list="..."> do sistema (itens em listas, contagem, pedidos, notas…).
// Troca a lista nativa do navegador (que no celular quase não aparece e só procura pelo começo) por uma lista
// própria: procura por partes do nome ou do código, sem acento, e aceita teclado (↑ ↓ Enter Esc) e toque.
// Ao escolher, preenche o campo e dispara Enter, que é o que cada tela já usa para adicionar o item.
import {e,normalizeText} from "./format.js";

const MAX=40;
let pop=null,cur=null,hl=-1,shown=[];

function options(inp){
 const dl=document.getElementById(inp.dataset.suggest);
 if(!dl)return [];
 if(!dl._opts||dl._n!==dl.options.length){
  dl._opts=[...dl.options].map(o=>{const v=o.value;const [name,code]=v.split(" · ");return {v,name,code:code||"",key:normalizeText(v)}});
  dl._n=dl.options.length;
 }
 return dl._opts;
}
function place(){
 if(!pop||!cur)return;
 const r=cur.getBoundingClientRect(),below=innerHeight-r.bottom;
 pop.style.left=r.left+"px";pop.style.width=Math.max(r.width,260)+"px";
 if(below<220&&r.top>below){pop.style.top="";pop.style.bottom=(innerHeight-r.top+4)+"px";pop.style.maxHeight=Math.min(320,r.top-12)+"px"}
 else{pop.style.bottom="";pop.style.top=(r.bottom+4)+"px";pop.style.maxHeight=Math.min(320,below-12)+"px"}
}
function close(){if(pop){pop.remove();pop=null}hl=-1;shown=[]}
function render(){
 const q=normalizeText(cur.value).trim();
 if(!q){close();return}
 const words=q.split(/\s+/);
 const all=options(cur).filter(o=>words.every(w=>o.key.includes(w)));
 // Primeiro quem começa com o que foi digitado (nome ou código), depois o resto em ordem alfabética.
 all.sort((a,b)=>(normalizeText(b.name).startsWith(q)||normalizeText(b.code).startsWith(q))-(normalizeText(a.name).startsWith(q)||normalizeText(a.code).startsWith(q)));
 shown=all.slice(0,MAX);hl=shown.length?0:-1;
 if(!pop){pop=document.createElement("ul");pop.className="suggest-pop";pop.setAttribute("role","listbox");
  pop.addEventListener("mousedown",ev=>ev.preventDefault()); // não tira o foco do campo
  pop.addEventListener("click",ev=>{const li=ev.target.closest("li[data-i]");if(li)pick(+li.dataset.i)});
  document.body.appendChild(pop)}
 pop.innerHTML=shown.length?shown.map((o,i)=>'<li role="option" data-i="'+i+'"'+(i===hl?' class="hl" aria-selected="true"':'')+'><span>'+e(o.name)+'</span>'+(o.code?'<small>'+e(o.code)+'</small>':'')+'</li>').join("")+
  (all.length>MAX?'<li class="suggest-more">Mais '+(all.length-MAX)+' resultado(s): continue digitando</li>':'')
  :'<li class="suggest-more">Nenhum item encontrado</li>';
 place();
}
function move(d){
 if(!shown.length)return;hl=(hl+d+shown.length)%shown.length;
 pop.querySelectorAll("li[data-i]").forEach((li,i)=>{li.classList.toggle("hl",i===hl);if(i===hl){li.setAttribute("aria-selected","true");li.scrollIntoView({block:"nearest"})}else li.removeAttribute("aria-selected")});
}
function pick(i){
 const o=shown[i];if(!o||!cur)return;
 const inp=cur;inp.value=o.v;close();
 inp.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
}
function adopt(inp){
 if(inp.dataset.suggest||!inp.getAttribute("list"))return;
 inp.dataset.suggest=inp.getAttribute("list");inp.removeAttribute("list");inp.setAttribute("autocomplete","off");
 inp.setAttribute("role","combobox");inp.setAttribute("aria-autocomplete","list");
 inp.addEventListener("input",()=>{cur=inp;render()});
 inp.addEventListener("keydown",ev=>{
  if(!pop||cur!==inp)return;
  if(ev.key==="ArrowDown"){ev.preventDefault();move(1)}
  else if(ev.key==="ArrowUp"){ev.preventDefault();move(-1)}
  else if(ev.key==="Escape"){ev.stopPropagation();close()}
  else if(ev.key==="Enter"&&ev.isTrusted&&hl>=0){inp.value=shown[hl].v;close()} // segue para o Enter da tela, já com o item escolhido
 },true);
 inp.addEventListener("blur",()=>setTimeout(()=>{if(cur===inp&&document.activeElement!==inp)close()},120));
}
/** Liga uma vez, no início do app. */
export function enableSuggest(){
 document.addEventListener("focusin",ev=>{const t=ev.target;if(t instanceof HTMLInputElement&&t.getAttribute("list"))adopt(t)});
 addEventListener("resize",place);addEventListener("scroll",place,true);
 addEventListener("hashchange",close);
}
