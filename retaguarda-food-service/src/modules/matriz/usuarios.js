// Matriz · Usuários e acessos.
// A pessoa recebe acesso a ambientes (Matriz e/ou lojas) e a módulos. Módulo liberado = pode usar e editar.
// Os módulos das lojas valem para todas as lojas liberadas. O banco guarda por loja
// (store_memberships + user_tab_permissions) e aplica RLS.
import {list,insert,supabase} from "../../core/db.js";
import {e,dateBR,dateTimeBR,initials} from "../../core/format.js";
import {pageHead,dataTable,openDrawer,openModal,toast,emptyState,kpi,btn,searchBox,bindSearch,searchKey,alertBox} from "../../core/ui.js";
import {STORE_TABS,MATRIX_TABS} from "../../core/access.js";
import {logEvent} from "../../core/audit.js";
import {describe} from "./log.js";

/** Estado atual de acesso de um usuário, no formato da tela. */
function currentAccess(stores,mem,perms){
 const m=sid=>mem.find(x=>x.store_id===sid&&x.active);
 const matriz=!!m("matriz");
 const matrixRows=perms.filter(p=>p.store_id==="matriz");
 const matrixMods={};
 // Cadastro antigo (matrix_admin sem módulos gravados) = todos os módulos da Matriz.
 for(const [t] of MATRIX_TABS)matrixMods[t]=matriz&&(matrixRows.length?!!matrixRows.find(p=>p.tab_code===t)?.can_view:m("matriz").role==="matrix_admin");
 const selected=stores.filter(s=>m(s.id)).map(s=>s.id);
 const on=(sid,t)=>{const rows=perms.filter(p=>p.store_id===sid);return rows.length?!!rows.find(p=>p.tab_code===t)?.can_view:true};
 const storeMods={};for(const [t] of STORE_TABS)storeMods[t]=selected.length?on(selected[0],t):true;
 const differs=selected.some(sid=>STORE_TABS.some(([t])=>on(sid,t)!==storeMods[t]));
 return {matriz,matrixMods,selected,storeMods,differs};
}

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
  if(a.matriz)tags.push('<span class="tag">Matriz</span>');
  for(const sid of a.selected)tags.push('<span class="tag">'+e(storeName(sid))+'</span>');
  return tags.join(" ")||'<span class="muted">Sem acesso</span>';
 };
 ctx.el.innerHTML=pageHead("Usuários e acessos","Libere a Matriz, as lojas e os módulos de cada pessoa.")+
  '<div class="kpis">'+kpi("Usuários ativos",profiles.filter(p=>p.active!==false).length,"",{icon:"users"})+
  kpi("Com acesso à Matriz",new Set(members.filter(m=>m.store_id==="matriz"&&m.active).map(m=>m.user_id)).size,"",{icon:"grid",tone:"info"})+
  kpi("Com acesso a lojas",new Set(members.filter(m=>m.store_id!=="matriz"&&m.active).map(m=>m.user_id)).size,"",{icon:"store",tone:"ok"})+
  kpi("Sem acesso",profiles.filter(p=>!of(p.user_id).some(m=>m.active)).length,"",{icon:"alert",tone:"warn"})+'</div>'+
  alertBox("Para criar o login de uma nova pessoa, solicite ao suporte. Depois de criado, libere aqui os acessos.","info")+
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

function moduleChips(prefix,tabs,values,locked=[]){
 return '<div class="mod-grid">'+tabs.map(([t,l])=>'<label class="mod-pick"><input type="checkbox" name="'+prefix+':'+t+'"'+(values[t]?" checked":"")+(locked.includes(t)?" disabled":"")+'><span>'+e(l)+'</span></label>').join("")+'</div>';
}

function manage(ctx,p,mem,perms,history,stores){
 const isSelf=p.user_id===ctx.userId;
 const before=currentAccess(stores,mem,perms);
 const storeName=id=>stores.find(s=>s.id===id)?.name||id;
 // Você não pode tirar o próprio acesso à Matriz nem à gestão de usuários.
 const lockedMatrix=isSelf?["users"]:[];
 const body=
  '<div class="form-section"><h3>Acessos</h3><div class="store-picks">'+
   '<label class="store-pick env-matriz"><input type="checkbox" name="env:matriz"'+(before.matriz?" checked":"")+(isSelf&&before.matriz?" disabled":"")+'><span>Matriz<small>Administração</small></span></label>'+
   stores.map(s=>'<label class="store-pick"><input type="checkbox" name="store:'+e(s.id)+'"'+(before.selected.includes(s.id)?" checked":"")+'><span>'+e(s.name)+'<small>'+e(s.code||"")+'</small></span></label>').join("")+'</div>'+
   (stores.length>3?'<div class="access-tools"><button type="button" class="btn btn-ghost btn-sm" data-stores="all">Marcar todas as lojas</button><button type="button" class="btn btn-ghost btn-sm" data-stores="none">Desmarcar lojas</button></div>':'')+'</div>'+
  '<div class="form-section" data-matrix-mods'+(before.matriz?'':' hidden')+'><h3>Módulos da Matriz</h3>'+moduleChips("m",MATRIX_TABS,before.matrixMods,lockedMatrix)+'</div>'+
  '<div class="form-section" data-store-mods'+(before.selected.length?'':' hidden')+'><h3>Módulos das lojas</h3>'+
   (before.differs?alertBox("As lojas desta pessoa tinham liberações diferentes. Ao salvar, todas passam a seguir os módulos abaixo.","warn"):'')+
   moduleChips("s",STORE_TABS,before.storeMods)+'</div>'+
  '<div class="form-section"><h3 class="h3-row">Histórico de alterações <button type="button" class="info-btn'+(history.length?'':' empty')+'" data-history title="'+(history.length?history.length+' alteração(ões) registrada(s)':'Nenhuma alteração registrada')+'" aria-label="Ver histórico de alterações">!</button></h3></div>';

 const dr=openDrawer({title:p.display_name||"Usuário",wide:true,body,onSubmit:async form=>{
  const f=form.elements;
  const after={matriz:isSelf&&before.matriz?true:f["env:matriz"].checked,selected:stores.filter(s=>f["store:"+s.id].checked).map(s=>s.id),matrixMods:{},storeMods:{}};
  for(const [t] of MATRIX_TABS)after.matrixMods[t]=after.matriz&&(lockedMatrix.includes(t)?true:f["m:"+t].checked);
  for(const [t] of STORE_TABS)after.storeMods[t]=f["s:"+t].checked;
  if(after.matriz&&!Object.values(after.matrixMods).some(Boolean))throw Error("Libere ao menos um módulo da Matriz, ou desmarque a Matriz.");
  if(after.selected.length&&!Object.values(after.storeMods).some(Boolean))throw Error("Libere ao menos um módulo das lojas, ou desmarque as lojas.");
  const m=sid=>mem.find(x=>x.store_id===sid);
  // Matriz: o banco libera as telas da Matriz pelo papel matrix_admin; os módulos limitam o que aparece.
  const cm=m("matriz");
  if(after.matriz){await upsertMember(p.user_id,"matriz","matrix_admin",true,cm);await upsertPerms(p.user_id,"matriz",MATRIX_TABS,after.matrixMods)}
  else if(cm?.active)await upsertMember(p.user_id,"matriz",cm.role,false,cm);
  // Lojas: mesma liberação em todas as marcadas. Papel interno: operador (gerentes antigos mantidos).
  for(const s of stores){
   const cur=m(s.id),on=after.selected.includes(s.id);
   if(on){await upsertMember(p.user_id,s.id,cur?.role==="store_manager"?"store_manager":"store_operator",true,cur);await upsertPerms(p.user_id,s.id,STORE_TABS,after.storeMods)}
   else if(cur?.active)await upsertMember(p.user_id,s.id,cur.role,false,cur);
  }
  const changes=diff(before,after,storeName);
  if(changes.length)await logEvent({action:"access",entity_type:"user_access",entity_id:p.user_id,store_id:"matriz",
   details:{usuario:p.display_name,por:ctx.app.profile?.display_name||"",changes,depois:after}});
  toast(changes.length?"Acessos atualizados.":"Nenhuma alteração.");
  if(isSelf&&changes.length){location.reload();return}
  ctx.reload();
 }});
 const form=dr.el;
 const sync=()=>{
  form.querySelector("[data-matrix-mods]").hidden=!form.elements["env:matriz"].checked;
  form.querySelector("[data-store-mods]").hidden=!stores.some(s=>form.elements["store:"+s.id].checked);
 };
 form.addEventListener("change",ev=>{if(/^(env|store):/.test(ev.target.name||""))sync()});
 form.querySelectorAll("[data-stores]").forEach(b=>b.onclick=()=>{form.querySelectorAll('[name^="store:"]').forEach(i=>i.checked=b.dataset.stores==="all");sync()});
 form.querySelector("[data-history]").onclick=()=>openModal({title:"Histórico de alterações · "+(p.display_name||"Usuário"),wide:true,
  body:history.length?'<ul class="hist-list">'+history.map(h=>'<li><div class="hist-meta">'+e(dateTimeBR(h.created_at))+(h.details?.por?' · '+e(h.details.por):'')+'</div><ul class="log-changes">'+describe(h)+'</ul></li>').join("")+'</ul>'
   :'<p class="muted" style="padding:14px 20px;margin:0">Nenhuma alteração registrada para esta pessoa.</p>'});
}

function diff(a,b,storeName){
 const out=[];
 if(a.matriz!==b.matriz)out.push(b.matriz?"Acesso à Matriz liberado":"Acesso à Matriz removido");
 const add=b.selected.filter(x=>!a.selected.includes(x)),rem=a.selected.filter(x=>!b.selected.includes(x));
 if(add.length)out.push("Lojas liberadas: "+add.map(storeName).join(", "));
 if(rem.length)out.push("Lojas removidas: "+rem.map(storeName).join(", "));
 if(b.matriz){
  const on=MATRIX_TABS.filter(([t])=>b.matrixMods[t]&&!a.matrixMods[t]).map(([,l])=>l),off=MATRIX_TABS.filter(([t])=>!b.matrixMods[t]&&a.matrixMods[t]).map(([,l])=>l);
  if(on.length)out.push("Matriz · módulos liberados: "+on.join(", "));
  if(off.length)out.push("Matriz · módulos removidos: "+off.join(", "));
 }
 if(b.selected.length){
  const on=STORE_TABS.filter(([t])=>b.storeMods[t]&&!a.storeMods[t]).map(([,l])=>l),off=STORE_TABS.filter(([t])=>!b.storeMods[t]&&a.storeMods[t]).map(([,l])=>l);
  if(on.length)out.push("Lojas · módulos liberados: "+on.join(", "));
  if(off.length)out.push("Lojas · módulos removidos: "+off.join(", "));
  if(a.differs)out.push("Liberação de módulos unificada para todas as lojas");
 }
 return out;
}
async function upsertPerms(user_id,store_id,tabs,values){
 const rows=tabs.map(([t])=>({user_id,store_id,tab_code:t,can_view:!!values[t],can_edit:!!values[t]}));
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
