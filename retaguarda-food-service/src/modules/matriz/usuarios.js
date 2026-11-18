// Matriz · Usuários e acessos: papéis por loja e permissões por módulo.
import {list,insert,update,supabase} from "../../core/db.js";
import {e,dateBR,initials} from "../../core/format.js";
import {pageHead,dataTable,openDrawer,field,select,toggle,toast,errorMessage,emptyState,card,kpi,btn,searchBox,bindSearch,searchKey,alertBox} from "../../core/ui.js";

export const ROLES=[["matrix_admin","Administrador da Matriz"],["store_manager","Gerente da loja"],["store_operator","Operador"],["viewer","Consulta"]];
const roleLabel=r=>(ROLES.find(x=>x[0]===r)||[,r])[1];
export const TABS=[["counts","Contagem"],["lists","Listas"],["orders","Pedidos"],["notes","Notas fiscais"],["transfers","Transferências"],["losses","Perdas"],["cmv","CMV"]];

export async function render(ctx){
 const [profiles,members,perms]=await Promise.all([
  list("user_profiles",{order:"display_name",asc:true}),list("store_memberships"),list("user_tab_permissions")
 ]);
 if(!ctx.isCurrent())return;
 const storeName=id=>ctx.app.stores.find(s=>s.id===id)?.name||id;
 const of=uid=>members.filter(m=>m.user_id===uid);
 ctx.el.innerHTML=pageHead("Usuários e acessos","Quem acessa cada loja, com qual papel e em quais módulos.")+
  '<div class="kpis">'+kpi("Usuários ativos",profiles.filter(p=>p.active!==false).length,"",{icon:"users"})+
  kpi("Administradores",new Set(members.filter(m=>m.role==="matrix_admin"&&m.active).map(m=>m.user_id)).size,"",{icon:"shield",tone:"info"})+
  kpi("Acessos a lojas",members.filter(m=>m.store_id!=="matriz"&&m.active).length,"",{icon:"store",tone:"ok"})+
  kpi("Sem acesso",profiles.filter(p=>!of(p.user_id).some(m=>m.active)).length,"",{icon:"alert",tone:"warn"})+'</div>'+
  alertBox("Para criar o login de uma nova pessoa, solicite ao suporte. Depois de criado, defina aqui as lojas e permissões.","info")+
  '<section class="card"><div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar usuário")+'</div>'+(profiles.length?dataTable([
   {label:"Usuário",render:p=>'<span style="display:flex;gap:10px;align-items:center"><span class="avatar">'+e(initials(p.display_name))+'</span><span><span class="strong">'+e(p.display_name||"Sem nome")+'</span>'+(p.user_id===ctx.userId?'<small class="sub">Você</small>':'')+'</span></span>'},
   {label:"Acessos",render:p=>of(p.user_id).filter(m=>m.active).map(m=>'<span class="tag" style="margin:2px">'+e(storeName(m.store_id))+' · '+e(roleLabel(m.role))+'</span>').join("")||'<span class="muted">Nenhum</span>'},
   {label:"Desde",render:p=>dateBR(p.created_at)},
   {label:"Situação",render:p=>p.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>'},
   {label:"",cls:"act",render:p=>btn("Gerenciar",{variant:"secondary",sm:true,attrs:'data-manage="'+e(p.user_id)+'"'})}
  ],profiles,{rowAttrs:p=>'data-search="'+e(searchKey(p.display_name))+'"'}).replace('class="table"','class="table stack"'):emptyState("users","Nenhum usuário"))+'</section>';
 bindSearch(ctx.el,"q");
 ctx.el.querySelectorAll("[data-manage]").forEach(b=>b.onclick=()=>manage(ctx,profiles.find(p=>p.user_id===b.dataset.manage),of(b.dataset.manage),perms.filter(x=>x.user_id===b.dataset.manage)));
}

function manage(ctx,p,mem,perms){
 const stores=ctx.app.stores.filter(s=>s.store_type==="operational");
 const isSelf=p.user_id===ctx.userId;
 const m=sid=>mem.find(x=>x.store_id===sid);
 const perm=(sid,tab)=>perms.find(x=>x.store_id===sid&&x.tab_code===tab);
 const isAdmin=!!(m("matriz")?.active&&m("matriz")?.role==="matrix_admin");
 // Sem permissão gravada: gerente/operador veem e editam; consulta só vê.
 const def=(role,kind)=>kind==="v"?true:role!=="viewer";
 const body='<div class="form-section"><h3>Matriz</h3>'+
  (isSelf?'<label class="switch"><input type="checkbox" name="admin"'+(isAdmin?" checked":"")+' disabled><span class="switch-track"></span><span>Administrador da Matriz</span></label><p class="field-hint" style="margin:6px 0 0">Você não pode alterar o próprio acesso administrativo.</p>'
   :toggle("admin",isAdmin,"Administrador da Matriz")+'<p class="field-hint" style="margin:6px 0 0">Acesso a todas as lojas, cadastros e acompanhamento.</p>')+'</div>'+
  '<div class="form-section"><h3>Lojas</h3>'+
  stores.map(s=>{const x=m(s.id);const role=x?.active?x.role:"";
   return '<div class="access-store'+(role?"":" off")+'" data-store="'+e(s.id)+'"><div class="access-head"><strong>'+e(s.name)+'</strong>'+
    select("role:"+s.id,ROLES.filter(r=>r[0]!=="matrix_admin"),role,{placeholder:"Sem acesso",attrs:'data-role aria-label="Papel em '+e(s.name)+'"'})+'</div>'+
    '<div class="access-body"><div class="perm-grid">'+TABS.map(([t,l])=>{const pp=perm(s.id,t);
     const v=pp?pp.can_view:def(role,"v"),ed=pp?pp.can_edit:def(role,"e");
     return '<div class="perm"><span class="perm-name">'+e(l)+'</span><span class="perm-opts">'+
      '<label><input type="checkbox" name="v:'+e(s.id)+':'+t+'"'+(v?" checked":"")+'>Ver</label>'+
      '<label><input type="checkbox" name="e:'+e(s.id)+':'+t+'"'+(ed?" checked":"")+'>Editar</label></span></div>'}).join("")+'</div>'+
    '<div class="access-tools"><button type="button" class="btn btn-ghost btn-sm" data-all="edit">Liberar tudo</button><button type="button" class="btn btn-ghost btn-sm" data-all="view">Somente consulta</button></div></div></div>';
  }).join("")+'</div>';
 const dr=openDrawer({title:p.display_name||"Usuário",wide:true,body,onSubmit:async form=>{
  const f=form.elements;
  if(!isSelf){
   const wantAdmin=f.admin.checked,cur=m("matriz");
   if(wantAdmin&&!(cur?.active&&cur.role==="matrix_admin"))await upsertMember(p.user_id,"matriz","matrix_admin",true,cur);
   if(!wantAdmin&&cur?.active)await upsertMember(p.user_id,"matriz",cur.role,false,cur);
  }
  for(const s of stores){
   const role=f["role:"+s.id].value,cur=m(s.id);
   if(role)await upsertMember(p.user_id,s.id,role,true,cur);else if(cur?.active)await upsertMember(p.user_id,s.id,cur.role,false,cur);
   if(!role)continue;
   for(const [t] of TABS){
    const cv=f["v:"+s.id+":"+t].checked,ce=f["e:"+s.id+":"+t].checked&&cv,pp=perm(s.id,t);
    if(pp&&pp.can_view===cv&&pp.can_edit===ce)continue;
    const {error}=await supabase.from("user_tab_permissions").upsert({user_id:p.user_id,store_id:s.id,tab_code:t,can_view:cv,can_edit:ce},{onConflict:"user_id,store_id,tab_code"});
    if(error)throw error;
   }
  }
  toast("Acessos atualizados.");ctx.reload();
 }});
 const form=dr.el;
 form.querySelectorAll("[data-role]").forEach(sel=>sel.addEventListener("change",()=>{
  const box=sel.closest(".access-store");box.classList.toggle("off",!sel.value);
  if(sel.value==="viewer")box.querySelectorAll('input[name^="e:"]').forEach(i=>i.checked=false);
 }));
 // Editar implica Ver; tirar Ver tira Editar.
 form.addEventListener("change",ev=>{
  const n=ev.target.name||"";if(!/^[ve]:/.test(n))return;
  const [k,sid,t]=n.split(":");const other=form.elements[(k==="v"?"e":"v")+":"+sid+":"+t];
  if(k==="e"&&ev.target.checked)other.checked=true;
  if(k==="v"&&!ev.target.checked)other.checked=false;
 });
 form.querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>{
  b.closest(".access-store").querySelectorAll(".perm").forEach(pr=>{const [v,ed]=pr.querySelectorAll("input");v.checked=true;ed.checked=b.dataset.all==="edit"});
 });
}
async function upsertMember(user_id,store_id,role,active,cur){
 if(cur){const {error}=await supabase.from("store_memberships").update({role,active}).eq("user_id",user_id).eq("store_id",store_id);if(error)throw error;return}
 await insert("store_memberships",{user_id,store_id,role,active});
}
export {update,card};
