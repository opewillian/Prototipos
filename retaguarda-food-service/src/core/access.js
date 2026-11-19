// Permissões do usuário logado. Uma liberação de módulos vale para todas as lojas liberadas;
// o banco guarda por loja (user_tab_permissions) e continua aplicando RLS.
export const STORE_TABS=[["counts","Contagem"],["lists","Listas"],["orders","Pedidos de compra"],["notes","Notas fiscais"],["transfers","Transferências"],["losses","Perdas"],["cmv","CMV"]];
export const MATRIX_TABS=[["orders","Pedidos das lojas"],["catalog","Itens"],["suppliers","Fornecedores"],["users","Usuários, acessos e log"]];

export function storePerm(app,storeId,tab){
 if(app.isAdmin)return {v:true,e:true};
 const m=app.memberships.find(x=>x.store_id===storeId&&x.active);
 if(!m)return {v:false,e:false};
 const rows=app.perms.filter(p=>p.store_id===storeId);
 if(!rows.length)return {v:true,e:m.role!=="viewer"};
 const r=rows.find(p=>p.tab_code===tab);
 return r?{v:!!r.can_view,e:!!(r.can_edit&&r.can_view)}:{v:false,e:false};
}
export function matrixPerm(app,tab){
 if(app.isAdmin)return {v:true,e:true};
 if(!app.memberships.some(m=>m.store_id==="matriz"&&m.active))return {v:false,e:false};
 const r=app.perms.find(p=>p.store_id==="matriz"&&p.tab_code===tab);
 return r?{v:!!r.can_view,e:!!(r.can_edit&&r.can_view)}:{v:false,e:false};
}
export function hasMatrix(app){return app.isAdmin||MATRIX_TABS.some(([t])=>matrixPerm(app,t).v)}
