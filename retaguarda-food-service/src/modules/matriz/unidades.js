// Matriz · Unidades: somente consulta. Lojas são provisionadas fora da retaguarda.
import {list,count} from "../../core/db.js";
import {e} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,alertBox} from "../../core/ui.js";

const FEATURES=[["counts","Contagem"],["lists","Listas"],["orders","Pedidos"],["notes","Notas"],["transfers","Transferências"],["losses","Perdas"],["cmv","CMV"]];

export async function render(ctx){
 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const members=await list("store_memberships",{select:"store_id,active"});
 if(!ctx.isCurrent())return;
 const users=s=>members.filter(m=>m.store_id===s&&m.active).length;
 ctx.el.innerHTML=pageHead("Unidades","Lojas em operação e módulos liberados para cada uma.")+
  alertBox("Novas lojas são incluídas pela administração do sistema. Fale com o suporte para abrir uma unidade.","info")+
  '<div class="choose-grid">'+stores.map(s=>{
   const flags=ctx.app.flags[s.id]||{};
   return '<article class="card" style="margin:0"><div class="card-body"><div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><span class="kpi-icon">'+icon("store",20)+'</span><div><strong style="font-size:16px;color:var(--ink)">'+e(s.name)+'</strong><small class="sub muted" style="display:block">'+e(s.code||"")+' · '+users(s.id)+' usuário(s)</small></div></div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px">'+FEATURES.map(([k,l])=>'<span class="pill '+(flags[k]?"pill-ok":"pill-muted")+'">'+e(l)+'</span>').join("")+'</div>'+
    '<div style="margin-top:16px"><a class="btn btn-secondary btn-sm" href="#/loja/'+encodeURIComponent(s.id)+'">Abrir loja</a></div></div></article>';
  }).join("")+'</div>';
}
export {count};
