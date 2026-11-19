// Matriz · Usuários e acessos.
// Liberação única: o usuário recebe uma lista de lojas e UM conjunto de módulos, que vale para todas
// as lojas liberadas (ex.: Notas fiscais liberado = notas de todas as suas lojas). A Matriz tem seus
// próprios módulos. O banco guarda por loja (store_memberships + user_tab_permissions) e aplica RLS.
import {list,insert,supabase} from "../../core/db.js";
import {e,dateBR,dateTimeBR,initials} from "../../core/format.js";
import {pageHead,dataTable,openDrawer,openModal,select,toggle,toast,emptyState,kpi,btn,searchBox,bindSearch,searchKey,alertBox} from "../../core/ui.js";
import {STORE_TABS,MATRIX_TABS} from "../../core/access.js";
import {logEvent} from "../../core/audit.js";
import {describe} from "./log.js";

export const ROLES=[["store_manager","Gerente"],["store_operator","Operador"],["viewer","Consulta"]];
const roleLabel=r=>r==="matrix_admin"?"Administrador":(ROLES.find(x=>x[0]===r)||[,r])[1];

/** Estado atual de acesso de um usuário, no formato da tela. */
function currentAccess(stores,mem,perms){
 const m=sid=>mem.find(x=>x.store_id===sid&&x.active);
 const admin=m("matriz")?.role==="matrix_admin";
 const selected=stores.filter(s=>m(s.id)).map(s=>s.id);
 const role=(selected.length&&m(selected[0])?.role)||"store_operator";
 const pick=(sid,tab,fallbackRole)=>{
  const rows=perms.filter(p=>p.store_id===sid);
  if(!rows.length)return fallbackRole==="viewer"?"v":"e";
  const r=rows.find(p=>p.tab_code===tab);return !r||!r.can_view?"":r.can_edit?"e":"v";
 };
 const storeMods={};for(const [t] of STORE_TABS)storeMods[t]=selected.length?pick(selected[0],t,role):"e";
 // Lojas com liberações diferentes entre si (modelo antigo por loja).
 const differs=selected.some(sid=>STORE_TABS.some(([t])=>pick(sid,t,m(sid)?.role)!==storeMods[t]));
 const matrixMods={};for(const [t] of MATRIX_TABS){const r=perms.find(p=>p.store_id==="matriz"&&p.tab_code===t);matrixMods[t]=m("matriz")&&r?.can_view?(r.can_edit?"e":"v"):""}
 return {admin,selected,role,storeMods,matrixMods,differs};
}
const LEVEL={"":"Sem acesso",v:"Ver",e:"Ver e editar"};

export async function render(ctx){
 const [profiles,members,perms,events]=await Promise.all([
  list("user_profiles",{order:"display_name",asc:true}),list("store_memberships"),list("user_tab_permissions"),
  list("audit_events",{eq:{entity_type:"user_access"},order:"created_at",limit:500})
 ]);
 if(!ctx.isCurrent())return;
 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const storeName=id=>stores.find(s=>s.id===id)?.name||id;
 const of=uid=>members.filter(m=>m.user_id===uid);
 const summary=p=>{
  const a=currentAccess(stores,of(p.user_id),perms.filter(x=>x.user_id===p.user_id));
  const tags=[];
  if(a.admin)tags.push('<span class="pill pill-info">Administrador da Matriz</span>');
  else if(Object.values(a.matrixMods).some(Boolean))tags.push('<span class="tag">Matriz: '+e(MATRIX_TABS.filter(([t])=>a.matrixMods[t]).map(([,l])=>l.split(" ")[0]).join(", "))+'</span>');
  if(a.selected.length)tags.push('<span class="tag">'+e(a.selected.map(storeName).join(", "))+'</span>');
  return tags.join(" ")||'<span class="muted">Sem acesso</span>';
 };
 ctx.el.innerHTML=pageHead("Usuários e acessos","Libere as lojas e os módulos de cada pessoa. Os módulos valem para todas as lojas liberadas.")+
  '<div class="kpis">'+kpi("Usuários ativos",profiles.filter(p=>p.active!==false).length,"",{icon:"users"})+
  kpi("Administradores",new Set(members.filter(m=>m.role==="matrix_admin"&&m.active).map(m=>m.user_id)).size,"",{icon:"shield",tone:"info"})+
  kpi("Com acesso a lojas",new Set(members.filter(m=>m.store_id!=="matriz"&&m.active).map(m=>m.user_id)).size,"",{icon:"store",tone:"ok"})+
  kpi("Sem acesso",profiles.filter(p=>!of(p.user_id).some(m=>m.active)).length,"",{icon:"alert",tone:"warn"})+'</div>'+
  alertBox("Para criar o login de uma nova pessoa, solicite ao suporte. Depois de criado, libere aqui as lojas e os módulos.","info")+
  '<section class="card"><div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar usuário")+'</div>'+(profiles.length?dataTable([
   {label:"Usuário",render:p=>'<span style="display:flex;gap:10px;align-items:center"><span class="avatar">'+e(initials(p.display_name))+'</span><span><span class="strong">'+e(p.display_name||"Sem nome")+'</span>'+(p.user_id===ctx.userId?'<small class="sub">Você</small>':'')+'</span></span>'},
   {label:"Acessos",render:summary},
   {label:"Desde",render:p=>dateBR(p.created_at)},
   {label:"Situação",render:p=>p.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>'},
   {label:"",cls:"act",render:p=>btn("Gerenciar",{variant:"secondary",sm:true,attrs:'data-manage="'+e(p.user_id)+'"'})}
  ],profiles,{rowAttrs:p=>'data-search="'+e(searchKey(p.display_name))+'"'}).replace('class="table"','class="table stack"'):emptyState("users","Nenhum usuário"))+'</section>';
 bindSearch(ctx.el,"q");
 ctx.el.querySelectorAll("[data-manage]").forEach(b=>b.onclick=()=>{
  const uid=b.dataset.manage;
  manage(ctx,profiles.find(p=>p.user_id===uid),of(uid),perms.filter(x=>x.user_id===uid),events.filter(x=>x.entity_id===uid),stores);
 });
}

function levelChips(prefix,tabs,values,disabled){
 return '<div class="perm-grid'+(disabled?" locked":"")+'">'+tabs.map(([t,l])=>{const v=values[t]||"";
  return '<div class="perm"><span class="perm-name">'+e(l)+'</span><span class="perm-opts">'+
   '<label><input type="checkbox" name="'+prefix+'v:'+t+'"'+(v?" checked":"")+(disabled?" disabled":"")+'>Ver</label>'+
   '<label><input type="checkbox" name="'+prefix+'e:'+t+'"'+(v==="e"?" checked":"")+(disabled?" disabled":"")+'>Editar</label></span></div>'}).join("")+'</div>';
}

function manage(ctx,p,mem,perms,history,stores){
 const isSelf=p.user_id===ctx.userId;
 const before=currentAccess(stores,mem,perms);
 const storeName=id=>stores.find(s=>s.id===id)?.name||id;
 const body=
  '<div class="form-section"><h3>Matriz</h3>'+
   (isSelf?'<label class="switch"><input type="checkbox" name="admin"'+(before.admin?" checked":"")+' disabled><span class="switch-track"></span><span>Administrador da Matriz</span></label><p class="field-hint" style="margin:6px 0 0">Você não pode alterar o próprio acesso administrativo.</p>'
    :toggle("admin",before.admin,"Administrador da Matriz (acesso total)")+'<p class="field-hint" style="margin:6px 0 0">Administrador vê e altera tudo, em todas as lojas.</p>')+
   '<h3 style="margin-top:16px">Módulos de administração</h3><p class="field-hint" style="margin:-6px 0 10px" data-matrix-hint>'+(before.admin?'Liberados por completo para administradores. Desmarque "Administrador" para escolher módulo a módulo.':'Painel e Unidades acompanham qualquer módulo liberado.')+'</p>'+
   '<div data-matrix-mods>'+levelChips("m",MATRIX_TABS,before.admin?Object.fromEntries(MATRIX_TABS.map(([t])=>[t,"e"])):before.matrixMods,isSelf||before.admin)+'</div></div>'+
  '<div class="form-section"><h3>Lojas liberadas</h3>'+
   '<div class="store-picks">'+stores.map(s=>'<label class="store-pick"><input type="checkbox" name="store:'+e(s.id)+'"'+(before.selected.includes(s.id)?" checked":"")+'><span>'+e(s.name)+'<small>'+e(s.code||"")+'</small></span></label>').join("")+'</div>'+
   (stores.length>3?'<div class="access-tools"><button type="button" class="btn btn-ghost btn-sm" data-stores="all">Marcar todas</button><button type="button" class="btn btn-ghost btn-sm" data-stores="none">Desmarcar todas</button></div>':'')+
   '</div>'+
  '<div class="form-section" data-store-mods><h3>Módulos das lojas</h3><p class="field-hint" style="margin:-6px 0 10px">Valem para todas as lojas liberadas acima.</p>'+
   (before.differs?alertBox("As lojas desta pessoa tinham liberações diferentes. Ao salvar, todas passam a seguir os módulos abaixo.","warn"):'')+
   levelChips("s",STORE_TABS,before.storeMods,false)+
   '<div class="access-tools"><button type="button" class="btn btn-ghost btn-sm" data-all="e">Liberar tudo</button><button type="button" class="btn btn-ghost btn-sm" data-all="v">Somente consulta</button></div></div>'+
  '<div class="form-section"><h3 class="h3-row">Histórico de alterações <button type="button" class="info-btn'+(history.length?'':' empty')+'" data-history title="'+(history.length?history.length+' alteração(ões) registrada(s)':'Nenhuma alteração registrada')+'" aria-label="Ver histórico de alterações">!</button></h3></div>';

 const dr=openDrawer({title:p.display_name||"Usuário",wide:true,body,onSubmit:async form=>{
  const f=form.elements;
  const after={admin:isSelf?before.admin:f.admin.checked,selected:stores.filter(s=>f["store:"+s.id].checked).map(s=>s.id),storeMods:{},matrixMods:{}};
  const lv=(pfx,t)=>f[pfx+"e:"+t].checked?"e":f[pfx+"v:"+t].checked?"v":"";
  for(const [t] of STORE_TABS)after.storeMods[t]=lv("s",t);
  // Papel derivado dos módulos (não há seletor): com algum "Editar" = operador; só "Ver" = consulta.
  // Gerentes já cadastrados continuam gerentes enquanto puderem editar.
  const canEdit=Object.values(after.storeMods).includes("e");
  const roleFor=cur=>!canEdit?"viewer":cur?.role==="store_manager"?"store_manager":"store_operator";
  for(const [t] of MATRIX_TABS)after.matrixMods[t]=after.admin?"":lv("m",t);
  if(after.selected.length&&!Object.values(after.storeMods).some(Boolean))throw Error("Libere ao menos um módulo para as lojas marcadas, ou desmarque as lojas.");
  const m=sid=>mem.find(x=>x.store_id===sid);
  // Matriz
  if(!isSelf){
   const cur=m("matriz");const matrixAny=Object.values(after.matrixMods).some(Boolean);
   if(after.admin)await upsertMember(p.user_id,"matriz","matrix_admin",true,cur);
   else if(matrixAny)await upsertMember(p.user_id,"matriz","viewer",true,cur);
   else if(cur?.active)await upsertMember(p.user_id,"matriz",cur.role==="matrix_admin"?"viewer":cur.role,false,cur);
   if(!after.admin&&matrixAny)await upsertPerms(p.user_id,"matriz",MATRIX_TABS,after.matrixMods);
  }
  // Lojas: mesma liberação em todas as marcadas.
  for(const s of stores){
   const cur=m(s.id),on=after.selected.includes(s.id);
   if(on){await upsertMember(p.user_id,s.id,roleFor(cur),true,cur);await upsertPerms(p.user_id,s.id,STORE_TABS,after.storeMods)}
   else if(cur?.active)await upsertMember(p.user_id,s.id,cur.role,false,cur);
  }
  const changes=diff(before,after,storeName,isSelf);
  if(changes.length)await logEvent({action:"access",entity_type:"user_access",entity_id:p.user_id,store_id:"matriz",
   details:{usuario:p.display_name,por:ctx.app.profile?.display_name||"",changes,depois:after}});
  toast(changes.length?"Acessos atualizados.":"Nenhuma alteração.");ctx.reload();
 }});
 const form=dr.el;
 const saved=before.matrixMods;
 form.querySelector('[name="admin"]:not([disabled])')?.addEventListener("change",ev=>{
  const on=ev.target.checked;
  form.querySelector("[data-matrix-mods]").innerHTML=levelChips("m",MATRIX_TABS,on?Object.fromEntries(MATRIX_TABS.map(([t])=>[t,"e"])):saved,on);
  form.querySelector("[data-matrix-hint]").textContent=on?'Liberados por completo para administradores. Desmarque "Administrador" para escolher módulo a módulo.':"Painel e Unidades acompanham qualquer módulo liberado.";
 });
 form.querySelector("[data-history]").onclick=()=>openModal({title:"Histórico de alterações · "+(p.display_name||"Usuário"),wide:true,
  body:history.length?'<ul class="hist-list">'+history.map(h=>'<li><div class="hist-meta">'+e(dateTimeBR(h.created_at))+(h.details?.por?' · '+e(h.details.por):'')+'</div><ul class="log-changes">'+describe(h)+'</ul></li>').join("")+'</ul>'
   :'<p class="muted" style="padding:14px 20px;margin:0">Nenhuma alteração registrada para esta pessoa.</p>'});
 form.addEventListener("change",ev=>{
  const n=ev.target.name||"";const mt=n.match(/^([ms])([ve]):(.+)$/);if(!mt)return;
  const other=form.elements[mt[1]+(mt[2]==="v"?"e":"v")+":"+mt[3]];
  if(mt[2]==="e"&&ev.target.checked)other.checked=true;
  if(mt[2]==="v"&&!ev.target.checked)other.checked=false;
 });
 form.querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>STORE_TABS.forEach(([t])=>{form.elements["sv:"+t].checked=true;form.elements["se:"+t].checked=b.dataset.all==="e"}));
 form.querySelectorAll("[data-stores]").forEach(b=>b.onclick=()=>form.querySelectorAll('[name^="store:"]').forEach(i=>i.checked=b.dataset.stores==="all"));
}

function diff(a,b,storeName,isSelf){
 const out=[];
 if(!isSelf&&a.admin!==b.admin)out.push(b.admin?"Tornou-se administrador da Matriz":"Deixou de ser administrador da Matriz");
 const add=b.selected.filter(x=>!a.selected.includes(x)),rem=a.selected.filter(x=>!b.selected.includes(x));
 if(add.length)out.push("Lojas liberadas: "+add.map(storeName).join(", "));
 if(rem.length)out.push("Lojas removidas: "+rem.map(storeName).join(", "));
 if(b.selected.length)for(const [t,l] of STORE_TABS)if((a.storeMods[t]||"")!==(b.storeMods[t]||"")||(a.differs&&add.length===0&&false))out.push("Lojas · "+l+": "+LEVEL[a.storeMods[t]||""]+" → "+LEVEL[b.storeMods[t]||""]);
 if(b.selected.length&&a.differs)out.push("Liberação de módulos unificada para todas as lojas");
 if(!isSelf&&!b.admin)for(const [t,l] of MATRIX_TABS)if((a.matrixMods[t]||"")!==(b.matrixMods[t]||""))out.push("Matriz · "+l+": "+LEVEL[a.matrixMods[t]||""]+" → "+LEVEL[b.matrixMods[t]||""]);
 return out;
}
async function upsertPerms(user_id,store_id,tabs,values){
 const rows=tabs.map(([t])=>({user_id,store_id,tab_code:t,can_view:!!values[t],can_edit:values[t]==="e"}));
 const {error}=await supabase.from("user_tab_permissions").upsert(rows,{onConflict:"user_id,store_id,tab_code"});
 if(error)throw error;
}
async function upsertMember(user_id,store_id,role,active,cur){
 if(cur){
  if(cur.role===role&&cur.active===active)return;
  const {error}=await supabase.from("store_memberships").update({role,active}).eq("user_id",user_id).eq("store_id",store_id);if(error)throw error;return;
 }
 await insert("store_memberships",{user_id,store_id,role,active});
}
