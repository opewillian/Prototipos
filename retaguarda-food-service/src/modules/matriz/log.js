// Matriz · Log de alterações: quem fez o quê, quando e em qual loja (audit_events).
import {list} from "../../core/db.js";
import {e,dateTimeBR,today,addDays} from "../../core/format.js";
import {pageHead,dataTable,emptyState,kpi,searchBox,searchKey} from "../../core/ui.js";
import {TRACKED} from "../../core/audit.js";

const ACTIONS={insert:"Criou",update:"Alterou",delete:"Excluiu",access:"Alterou acessos"};
const STATUS={draft:"rascunho",finalized:"finalizada",cancelled:"cancelado",pending:"pendente",received:"recebida",sent:"enviado",realizing:"em andamento",realized:"realizado",issued:"emitida",recorded:"registrada",paid:"paga"};
const fmt=v=>v===null||v===undefined||v===""?"vazio":v===true?"sim":v===false?"não":String(STATUS[v]||v);
const FIELDS={name:"nome",code:"código",category:"categoria",item_type:"tipo",brand:"marca",base_unit:"unidade",default_unit_cost:"custo padrão",minimum_stock:"estoque mínimo",composes_cmv:"compõe CMV",active:"situação",
 tax_id:"CNPJ/CPF",phone:"telefone",email:"e-mail",preferred:"preferencial",list_type:"uso",status:"situação",delivery_date:"entrega",observation:"observação",notes:"observações",
 invoice_number:"número",supplier_id:"fornecedor",issue_date:"emissão",entry_date:"entrada",access_key:"chave",purchase_order_id:"pedido vinculado",amount:"valor",due_date:"vencimento",payment_method:"forma de pagamento",reason:"motivo",loss_date:"data",count_date:"data"};

export function describe(ev){
 const d=ev.details||{};
 if(ev.action==="access")return (d.changes||[]).map(c=>'<li>'+e(c)+'</li>').join("")||'<li>Sem diferenças</li>';
 const out=[];
 if(d.registro)out.push('<li><strong>'+e(d.registro)+'</strong></li>');
 if(d.status)out.push('<li>Situação: '+e(STATUS[d.status]||d.status)+'</li>');
 else if(d.alteracoes?.length)for(const a of d.alteracoes)out.push('<li>'+e((FIELDS[a.campo]||a.campo)+": "+fmt(a.de)+" → "+fmt(a.para))+'</li>');
 else if(d.campos?.length)out.push('<li>Campos: '+e(d.campos.map(c=>FIELDS[c]||c).join(", "))+'</li>');
 return out.join("");
}

export async function render(ctx){
 const [events,profiles]=await Promise.all([
  list("audit_events",{order:"created_at",gte:{created_at:addDays(today(),-90)},limit:3000}),
  list("user_profiles",{select:"user_id,display_name"})
 ]);
 if(!ctx.isCurrent())return;
 const who=id=>profiles.find(p=>p.user_id===id)?.display_name||"Usuário";
 const where=id=>id==="matriz"?"Matriz":ctx.app.stores.find(s=>s.id===id)?.name||id;
 const types=[...new Set(events.map(x=>x.entity_type))].filter(t=>TRACKED[t]);
 const todayN=events.filter(x=>String(x.created_at).slice(0,10)===today()).length;
 ctx.el.innerHTML=pageHead("Log de alterações","Registro das alterações feitas na Retaguarda nos últimos 90 dias. O log não pode ser editado nem apagado.")+
  '<div class="kpis">'+kpi("Alterações hoje",todayN,"",{icon:"edit"})+kpi("Últimos 90 dias",events.length,"",{icon:"layers",tone:"info"})+
  kpi("Pessoas",new Set(events.map(x=>x.user_id)).size,"fizeram alterações",{icon:"users",tone:"ok"})+
  kpi("Alterações de acesso",events.filter(x=>x.action==="access").length,"",{icon:"shield",tone:"warn"})+'</div>'+
  '<section class="card"><div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar por pessoa, registro ou loja")+
  '<select class="control" id="f-type"><option value="">Todos os tipos</option>'+types.map(t=>'<option value="'+e(t)+'">'+e(TRACKED[t])+'</option>').join("")+'</select>'+
  '<select class="control" id="f-where"><option value="">Todas as lojas e Matriz</option><option value="matriz">Matriz</option>'+ctx.app.stores.filter(s=>s.store_type==="operational").map(s=>'<option value="'+e(s.id)+'">'+e(s.name)+'</option>').join("")+'</select>'+
  '<span class="grow"></span><span class="muted"><b data-count>0</b> registro(s)</span></div>'+
  (events.length?dataTable([
   {label:"Data e hora",render:x=>e(dateTimeBR(x.created_at))},
   {label:"Pessoa",render:x=>'<span class="strong">'+e(who(x.user_id))+'</span>'},
   {label:"Ação",render:x=>e(ACTIONS[x.action]||x.action)+'<small class="sub">'+e(TRACKED[x.entity_type]||x.entity_type||"")+'</small>'},
   {label:"Onde",render:x=>e(where(x.store_id))},
   {label:"Detalhes",render:x=>'<ul class="log-changes">'+describe(x)+'</ul>'}
  ],events,{rowAttrs:x=>'data-search="'+e(searchKey(who(x.user_id),where(x.store_id),x.details?.registro,(x.details?.changes||[]).join(" ")))+'" data-type="'+e(x.entity_type)+'" data-where="'+e(x.store_id)+'"'}).replace('class="table"','class="table stack"')
  :emptyState("layers","Nenhuma alteração registrada","As alterações feitas a partir de agora aparecerão aqui."))+'</section>';
 const run=()=>{const q=searchKey(ctx.el.querySelector("#q").value).trim(),t=ctx.el.querySelector("#f-type").value,w=ctx.el.querySelector("#f-where").value;let n=0;
  ctx.el.querySelectorAll("tr[data-search]").forEach(r=>{const ok=(!q||r.dataset.search.includes(q))&&(!t||r.dataset.type===t)&&(!w||r.dataset.where===w);r.hidden=!ok;if(ok)n++});
  ctx.el.querySelector("[data-count]").textContent=n};
 ["#q","#f-type","#f-where"].forEach(s=>ctx.el.querySelector(s).addEventListener("input",run));run();
}
