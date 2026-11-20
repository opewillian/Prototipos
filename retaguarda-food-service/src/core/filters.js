// Barra de filtros em uma linha (Transferências, Contagens, Perdas…). Filtra as linhas já na tela, sem ir ao banco.
// As linhas precisam de data-search (texto), data-<key> para cada select, data-date (AAAA-MM-DD) e data-total (valor).
import {e,money,round2} from "./format.js";
import {icon} from "./icons.js";

/** cfg: {search:"placeholder", selects:[{key, all:"Todas…", options:[[valor,rótulo]]}], dates:true, noun:["contagem","contagens"]} */
export function filterBar(cfg){
 return '<section class="card fbar-card"><div class="fbar">'+
  (cfg.search?'<label class="search fbar-search">'+icon("search",16)+'<input id="fb-q" placeholder="'+e(cfg.search)+'" autocomplete="off"></label>':'')+
  (cfg.selects||[]).map(s=>'<select class="control fbar-sel" data-fkey="'+e(s.key)+'" aria-label="'+e(s.all)+'"><option value="">'+e(s.all)+'</option>'+
   s.options.map(([v,l])=>'<option value="'+e(v)+'">'+e(l)+'</option>').join("")+'</select>').join("")+
  (cfg.dates?'<input class="control fbar-date" type="date" id="fb-from" title="Data inicial" aria-label="Data inicial"><span class="fbar-sep">até</span><input class="control fbar-date" type="date" id="fb-to" title="Data final" aria-label="Data final">':'')+
  '<button type="button" class="fbar-clear" data-fclear title="Limpar filtros">Limpar</button>'+
  '</div></section>';
}

export function bindFilters(root,cfg){
 const [one,many]=cfg.noun||["registro","registros"];
 const q=root.querySelector("#fb-q"),from=root.querySelector("#fb-from"),to=root.querySelector("#fb-to"),sels=[...root.querySelectorAll("[data-fkey]")];
 const norm=v=>String(v||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
 const run=()=>{
  const t=norm(q?.value),a=from?.value||"",b=to?.value||"";let n=0,sum=0;
  root.querySelectorAll("tr[data-search]").forEach(r=>{const d=r.dataset;
   const ok=(!t||d.search.includes(t))&&sels.every(s=>!s.value||d[s.dataset.fkey]===s.value)&&(!a||d.date>=a)&&(!b||d.date<=b);
   r.hidden=!ok;if(ok){n++;sum+=Number(d.total||0)}});
  const c=root.querySelector("[data-fcount]");if(c)c.textContent=n+" "+(n===1?one:many);
  const m=root.querySelector("[data-fsum]");if(m)m.textContent=money(round2(sum));
  root.querySelector("[data-fclear]")?.classList.toggle("on",!!(t||a||b||sels.some(s=>s.value)));
 };
 [q,from,to,...sels].filter(Boolean).forEach(x=>x.addEventListener("input",run));
 root.querySelector("[data-fclear]")?.addEventListener("click",()=>{[q,from,to,...sels].filter(Boolean).forEach(x=>x.value="");run()});
 run();
}
