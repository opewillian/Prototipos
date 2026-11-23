// Gráfico de linha em SVG (sem biblioteca). Um eixo só; grade discreta; linha de 2px com pontas arredondadas;
// passar o mouse mostra a linha vertical (crosshair) e a dica com todos os valores daquele ponto.
// series: [{name, color, dash?:boolean, values:[number|null,...]}]  labels: rótulos do eixo X (mesmo tamanho de values).
import {e} from "./format.js";

const niceMax=v=>{if(!(v>0))return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p};
const compact=v=>new Intl.NumberFormat("pt-BR",{notation:"compact",maximumFractionDigits:1}).format(v);

/** Desenha dentro de `el`. Retorna uma função para redesenhar (ex.: ao redimensionar). */
export function lineChart(el,{labels,series,format=v=>String(v),tickEvery=1,height=240,ariaLabel=""}){
 const draw=()=>{
  const W=Math.max(280,el.clientWidth||600),H=height,pad={l:52,r:14,t:12,b:28};
  const iw=W-pad.l-pad.r,ih=H-pad.t-pad.b,n=labels.length;
  const max=niceMax(Math.max(0,...series.flatMap(s=>s.values.filter(v=>v!=null))));
  const x=i=>pad.l+(n<=1?iw/2:i*iw/(n-1)),y=v=>pad.t+ih-(v/max)*ih;
  const ticks=[0,.25,.5,.75,1].map(f=>f*max);
  let svg='<svg class="lc-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+e(ariaLabel)+'">';
  svg+=ticks.map(t=>'<line class="lc-grid" x1="'+pad.l+'" x2="'+(W-pad.r)+'" y1="'+y(t)+'" y2="'+y(t)+'"/><text class="lc-ytick" x="'+(pad.l-8)+'" y="'+(y(t)+4)+'">'+e(compact(t))+'</text>').join("");
  svg+=labels.map((l,i)=>i%tickEvery===0||i===n-1?'<text class="lc-xtick" x="'+x(i)+'" y="'+(H-8)+'">'+e(l)+'</text>':'').join("");
  for(const s of series){
   // Quebra a linha onde não há valor (null).
   let d="",pen=false;
   s.values.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?"L":"M")+x(i).toFixed(1)+" "+y(v).toFixed(1)+" ";pen=true});
   if(d)svg+='<path class="lc-line" d="'+d+'" stroke="'+s.color+'"'+(s.dash?' stroke-dasharray="5 5"':'')+'/>';
   // Ponto isolado (sem vizinhos) vira marcador para não sumir.
   s.values.forEach((v,i)=>{if(v!=null&&s.values[i-1]==null&&s.values[i+1]==null)svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4" fill="'+s.color+'"/>'});
  }
  svg+='<line class="lc-cross" y1="'+pad.t+'" y2="'+(pad.t+ih)+'" x1="0" x2="0" hidden/>';
  svg+=series.map((s,k)=>'<circle class="lc-dot" data-k="'+k+'" r="4.5" fill="'+s.color+'" hidden/>').join("");
  svg+='<rect class="lc-hit" x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'"/></svg>';
  el.innerHTML='<div class="lc-wrap">'+svg+'<div class="lc-tip" hidden></div></div>'+
   (series.length>1?'<div class="lc-legend">'+series.map(s=>'<span><i class="lc-key'+(s.dash?" dash":"")+'" style="--c:'+s.color+'"></i>'+e(s.name)+'</span>').join("")+'</div>':'');
  const svgEl=el.querySelector("svg"),tip=el.querySelector(".lc-tip"),cross=el.querySelector(".lc-cross"),dots=[...el.querySelectorAll(".lc-dot")];
  const hide=()=>{tip.hidden=true;cross.setAttribute("hidden","");dots.forEach(d=>d.setAttribute("hidden",""))};
  const show=clientX=>{
   const r=svgEl.getBoundingClientRect();const px=(clientX-r.left)*(W/r.width);
   const i=Math.max(0,Math.min(n-1,Math.round(n<=1?0:(px-pad.l)/(iw/(n-1)))));
   if(series.every(s=>s.values[i]==null))return hide();
   cross.setAttribute("x1",x(i));cross.setAttribute("x2",x(i));cross.removeAttribute("hidden");
   dots.forEach((d,k)=>{const v=series[k].values[i];if(v==null)d.setAttribute("hidden","");else{d.setAttribute("cx",x(i));d.setAttribute("cy",y(v));d.removeAttribute("hidden")}});
   tip.innerHTML='<strong>'+e(labels[i])+'</strong>'+series.map(s=>'<div><i class="lc-key'+(s.dash?" dash":"")+'" style="--c:'+s.color+'"></i><span>'+e(s.name)+'</span><b>'+(s.values[i]==null?"—":e(format(s.values[i])))+'</b></div>').join("");
   tip.hidden=false;const left=x(i)*(r.width/W);tip.style.left=Math.min(Math.max(left,70),r.width-70)+"px";
  };
  const hit=el.querySelector(".lc-hit");
  hit.addEventListener("mousemove",ev=>show(ev.clientX));hit.addEventListener("mouseleave",hide);
  hit.addEventListener("touchstart",ev=>show(ev.touches[0].clientX),{passive:true});
 };
 draw();
 // Redesenha ao mudar a largura; um observador por elemento (trocar o gráfico no mesmo lugar substitui o anterior).
 el._lcRO?.disconnect();
 let t;const ro=new ResizeObserver(()=>{clearTimeout(t);t=setTimeout(draw,120)});ro.observe(el);el._lcRO=ro;
 return draw;
}
