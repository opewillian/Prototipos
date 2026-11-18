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
 const body=(isSelf?alertBox("Você não pode alterar o próprio acesso administrativo.","info"):'')+
  '<div class="form-section"><h3>Matriz</h3>'+toggle("admin",!!(m("matriz")?.active&&m("matriz")?.role==="matrix_admin"),"Administrador da Matriz (acesso a todas as lojas e cadastros)")+'</div>'+
  stores.map(s=>{const x=m(s.id);
   return '<div class="form-section card" style="padding:16px;margin-top:14px"><h3 style="margin-bottom:10px">'+e(s.name)+'</h3><div class="form-grid">'+
    field("Papel nesta loja",select("role:"+s.id,ROLES.filter(r=>r[0]!=="matrix_admin"),x?.active?x.role:"",{placeholder:"Sem acesso"}))+'<div></div></div>'+
    '<table class="table" style="margin-top:12px"><thead><tr><th>Módulo</th><th>Ver</th><th>Editar</th></tr></thead><tbody>'+TABS.map(([t,l])=>{const pp=perm(s.id,t);
     return '<tr><td>'+e(l)+'</td><td><input type="checkbox" name="v:'+e(s.id)+':'+t+'"'+(pp?pp.can_view?" checked":"":" checked")+'></td><td><input type="checkbox" name="e:'+e(s.id)+':'+t+'"'+(pp?pp.can_edit?" checked":"":" checked")+'></td></tr>'}).join("")+'</tbody></table></div>';
  }).join("");
 openDrawer({title:p.display_name||"Usuário",wide:true,body,onSubmit:async form=>{
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
}
async function upsertMember(user_id,store_id,role,active,cur){
 if(cur){const {error}=await supabase.from("store_memberships").update({role,active}).eq("user_id",user_id).eq("store_id",store_id);if(error)throw error;return}
 await insert("store_memberships",{user_id,store_id,role,active});
}
export {update,card};
