// Permissões do usuário logado.
// Modelo: a pessoa recebe acesso a ambientes (Matriz e/ou lojas) e a módulos. Módulo liberado = pode usar e
// editar. Os módulos das lojas valem para todas as lojas liberadas. O banco guarda por loja
// (store_memberships + user_tab_permissions) e continua aplicando RLS.
export const STORE_TABS=[["counts","Contagem"],["lists","Listas"],["orders","Pedidos de compra"],["notes","Notas fiscais"],["transfers","Transferências"],["losses","Perdas"],["cmv","CMV"]];
export const MATRIX_TABS=[["orders","Pedidos das lojas"],["catalog","Itens"],["suppliers","Fornecedores"],["users","Usuários, acessos e log"]];

const member=(app,sid)=>app.memberships.find(x=>x.store_id===sid&&x.active);
// Cadastro antigo: vínculo matrix_admin sem módulos gravados = acesso completo.
const legacyFull=app=>member(app,"matriz")?.role==="matrix_admin"&&!app.perms.some(p=>p.store_id==="matriz");

export function storeAllowed(app,storeId){
 if(member(app,storeId))return true;
 // Administrador antigo sem nenhum vínculo de loja: mantém acesso a todas.
 return legacyFull(app)&&!app.memberships.some(m=>m.store_id!=="matriz"&&m.active);
}
export function storePerm(app,storeId,tab){
 if(!storeAllowed(app,storeId))return {v:false,e:false};
 const rows=app.perms.filter(p=>p.store_id===storeId);
 if(!rows.length)return {v:true,e:member(app,storeId)?.role!=="viewer"};
 const r=rows.find(p=>p.tab_code===tab);
 return r?.can_view?{v:true,e:true}:{v:false,e:false};
}
export function matrixPerm(app,tab){
 if(!member(app,"matriz"))return {v:false,e:false};
 if(legacyFull(app))return {v:true,e:true};
 const r=app.perms.find(p=>p.store_id==="matriz"&&p.tab_code===tab);
 return r?.can_view?{v:true,e:true}:{v:false,e:false};
}
export function hasMatrix(app){return MATRIX_TABS.some(([t])=>matrixPerm(app,t).v)}
