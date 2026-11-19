// Ambiente Matriz: registro dos módulos e grupos do menu.
import * as painel from "../../modules/matriz/painel.js";
import * as itens from "../../modules/matriz/itens.js";
import * as fornecedores from "../../modules/matriz/fornecedores.js";
import * as usuarios from "../../modules/matriz/usuarios.js";
import * as pedidos from "../../modules/matriz/pedidos.js";
import * as log from "../../modules/matriz/log.js";
import {matrixPerm,hasMatrix} from "../../core/access.js";

export const matrizModules=[
 {id:"painel",label:"Painel",icon:"home",mod:painel},
 {id:"pedidos",label:"Pedidos das lojas",icon:"cart",tab:"orders",mod:pedidos},
 {id:"itens",label:"Itens",icon:"box",group:"Cadastros",groupIcon:"edit",tab:"catalog",mod:itens},
 {id:"fornecedores",label:"Fornecedores",icon:"truck",group:"Cadastros",tab:"suppliers",mod:fornecedores},
 {id:"usuarios",label:"Usuários e acessos",icon:"users",group:"Cadastros",tab:"users",mod:usuarios},
 {id:"log",label:"Log de alterações",icon:"layers",group:"Cadastros",tab:"users",mod:log}
];
/** Módulos da Matriz que o usuário pode ver (Painel: qualquer acesso à Matriz). */
export function matrizEnabled(app){
 if(!hasMatrix(app))return [];
 return matrizModules.filter(m=>!m.tab||matrixPerm(app,m.tab).v);
}
export function matrizCanEdit(app,id){const m=matrizModules.find(x=>x.id===id);return !m?.tab||matrixPerm(app,m.tab).e}
