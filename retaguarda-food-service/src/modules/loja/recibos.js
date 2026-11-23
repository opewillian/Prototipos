// Loja · Faturamento › recibos de um dia.
// Clicar no dia (tabela "Por dia") abre um popin com os cupons do dia; clicar em um cupom abre, na frente, o recibo
// desenhado em estilo cartoon, "saindo da impressora". Os cupons vêm da função "degust" (ação "cupons"), lidos do
// arquivo completo do dia no R2 — só existem a partir de 01/10/2026 (antes disso guardamos só os resumos).
import {supabase} from "../../core/db.js";
import {e,money,num,dateBR} from "../../core/format.js";
import {openModal,dataTable,searchBox,searchKey,alertBox,errorMessage} from "../../core/ui.js";

const cache=new Map();
async function loadReceipts(storeId,day){
 const k=storeId+"|"+day;if(cache.has(k))return cache.get(k);
 const r=await supabase.functions.invoke("degust",{body:{acao:"cupons",storeId,data:day}});
 if(r.error){let msg=r.error.message;try{msg=JSON.parse(await r.error.context.text()).erro||msg}catch{}throw Error(msg)}
 cache.set(k,r.data);return r.data;
}
const hhmm=h=>String(h||"").slice(11,16)||"—";
const weekday=d=>new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long"});
const payLabel=c=>[...new Set(c.pagamentos.map(p=>p.forma))].join(" + ")||"—";

/** Popin com a tabela de recibos do dia. */
export async function receiptsModal(ctx,day){
 const store=ctx.store||ctx.app.stores.find(s=>s.id===ctx.storeId)||{};
 const m=openModal({title:"Recibos de "+dateBR(day)+" · "+weekday(day),body:'<div class="rc-wrap"><p class="muted" style="padding:18px">Carregando os recibos…</p></div>',wide:true});
 const wrap=[...document.querySelectorAll(".overlay-modal .rc-wrap")].pop();
 wrap.closest(".dialog")?.classList.add("dialog-xl");
 let data;
 try{data=await loadReceipts(ctx.storeId,day)}
 catch(error){wrap.innerHTML=alertBox("Não foi possível carregar os recibos: "+errorMessage(error),"danger");return}
 if(!document.body.contains(wrap))return;
 if(data.detalhe===false){wrap.innerHTML=alertBox("Recibos individuais só existem a partir de "+dateBR(data.desde)+". Antes disso o sistema guarda apenas o resumo de cada dia.","info");return}
 const list=(data.cupons||[]).slice().sort((a,b)=>String(a.hora).localeCompare(String(b.hora)));
 if(!list.length){wrap.innerHTML=alertBox("Nenhum recibo guardado para este dia.","info");return}
 const ok=list.filter(c=>!c.cancelada),net=ok.reduce((s,c)=>s+c.liquido,0);
 wrap.innerHTML=
  '<div class="rc-sum"><div><small>Recibos</small><strong>'+num(ok.length,0)+'</strong></div><div><small>Cancelados</small><strong>'+num(list.length-ok.length,0)+'</strong></div>'+
  '<div><small>Líquido</small><strong>'+money(Math.round(net*100)/100)+'</strong></div><div><small>Ticket médio</small><strong>'+money(ok.length?Math.round(net/ok.length*100)/100:0)+'</strong></div></div>'+
  '<div class="toolbar rc-tools">'+searchBox("rcq","Buscar por produto, pagamento, nº ou hora")+'<label class="rc-toggle"><input type="checkbox" id="rc-canc"> Mostrar cancelados</label></div>'+
  dataTable([
   {label:"Hora",render:c=>'<span class="strong">'+e(hhmm(c.hora))+'</span>'},
   {label:"Recibo",render:c=>(c.nfce?'NFC-e '+e(c.nfce):'Nº '+e(c.id))+'<small class="sub">Caixa '+e(c.pdv)+'</small>'},
   {label:"Itens",cls:"num",render:c=>num(c.itens.filter(i=>!i.cancelado).reduce((s,i)=>s+i.qtd,0))},
   {label:"Pagamento",render:c=>e(payLabel(c))},
   {label:"Valor",cls:"num",render:c=>c.cancelada?'<s class="muted">'+money(c.liquido)+'</s>':'<strong>'+money(c.liquido)+'</strong>'},
   {label:"Situação",render:c=>c.cancelada?'<span class="pill pill-danger">Cancelado</span>':'<span class="pill pill-ok">Pago</span>'}
  ],list,{rowAttrs:c=>'class="row-link rc-row'+(c.cancelada?' rc-canc':'')+'" tabindex="0" data-rc="'+e(c.id)+'" data-search="'+e(searchKey(hhmm(c.hora),String(c.nfce??""),String(c.id),payLabel(c),...c.itens.map(i=>i.nome)))+'"'});
 const q=wrap.querySelector("#rcq"),cb=wrap.querySelector("#rc-canc");
 const filter=()=>{const s=searchKey(q.value).trim();wrap.querySelectorAll("tr[data-rc]").forEach(tr=>tr.hidden=(!cb.checked&&tr.classList.contains("rc-canc"))||(!!s&&!tr.dataset.search.includes(s)))};
 q.addEventListener("input",filter);cb.addEventListener("change",filter);filter();
 const open=id=>{const c=list.find(x=>String(x.id)===String(id));if(c)receiptCartoon(c,store,day)};
 wrap.querySelectorAll("tr[data-rc]").forEach(tr=>{tr.onclick=()=>open(tr.dataset.rc);tr.onkeydown=ev=>{if(ev.key==="Enter")open(tr.dataset.rc)}});
 return m;
}

/** O recibo em estilo cartoon, na frente do popin. */
function receiptCartoon(c,store,day){
 // Recibo cancelado: mostra os itens (riscados), que vêm marcados como cancelados.
 const items=c.cancelada?c.itens:c.itens.filter(i=>!i.cancelado);
 const line=(l,r,cls="")=>'<div class="rcp-line '+cls+'"><span>'+l+'</span><span>'+r+'</span></div>';
 let k=0;const st=()=>' style="--i:'+(k++)+'"';
 const body=
  '<div class="rcp-head"'+st()+'><strong>'+e(store.name||"Loja")+'</strong><small>'+(c.nfce?'NFC-e nº '+e(c.nfce)+' · ':'')+'Caixa '+e(c.pdv)+'</small>'+
  '<small>'+dateBR(day)+' às '+e(hhmm(c.hora))+'</small></div>'+
  '<div class="rcp-cut"'+st()+'></div>'+
  items.map(i=>'<div class="rcp-item"'+st()+'><div class="rcp-iname"><b>'+num(i.qtd)+'×</b> '+e(i.nome)+'</div><div class="rcp-ival">'+money(i.total)+
   (i.desconto?'<small>− '+money(i.desconto)+'</small>':'')+'</div>'+(i.qtd!==1?'<small class="rcp-unit">'+money(i.unit)+' / '+e(i.unid.toLowerCase()||"un")+'</small>':'')+'</div>').join("")+
  '<div class="rcp-cut"'+st()+'></div>'+
  '<div class="rcp-tot"'+st()+'>'+(c.cancelada?"":line("Subtotal",money(c.bruto)))+(c.desconto?line("Descontos","− "+money(c.desconto),"rcp-disc"):"")+(c.acrescimo?line("Acréscimos","+ "+money(c.acrescimo)):"")+
  line("TOTAL",money(c.liquido),"rcp-big")+'</div>'+
  '<div class="rcp-pays"'+st()+'>'+c.pagamentos.map(p=>'<div class="rcp-pay"><span class="rcp-chip">'+e(p.forma)+'</span><span>'+(p.adm?'<small>'+e(p.adm)+(p.parcelas>1?' · '+p.parcelas+'x':'')+'</small>':'')+money(p.valor)+'</span></div>').join("")+
  (c.troco?line("Troco",money(c.troco)):"")+'</div>';
 const ov=document.createElement("div");
 ov.className="rcp-overlay";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-label","Recibo");
 ov.innerHTML='<div class="rcp-stage"><div class="rcp-printer"><span class="rcp-led"></span><span class="rcp-slot"></span></div>'+
  '<div class="rcp-paper'+(c.cancelada?' is-canc':'')+'" style="--n:'+k+'">'+body+'<div class="rcp-stamp" style="--i:'+k+'">'+(c.cancelada?"CANCELADO":"PAGO")+'</div></div>'+
  '<button type="button" class="rcp-close" aria-label="Fechar recibo">✕</button></div>';
 const close=()=>{ov.classList.add("out");setTimeout(()=>ov.remove(),220);window.removeEventListener("keydown",onKey,true)};
 // Esc fecha só o recibo (o popin dos recibos fica aberto).
 const onKey=ev=>{if(ev.key==="Escape"){ev.stopPropagation();ev.preventDefault();close()}};
 window.addEventListener("keydown",onKey,true);
 ov.addEventListener("mousedown",ev=>{if(ev.target===ov||ev.target.classList.contains("rcp-stage"))close()});
 ov.querySelector(".rcp-close").onclick=close;
 document.body.appendChild(ov);
 ov.querySelector(".rcp-close").focus();
}
