// Ambiente Matriz: registro dos módulos e grupos do menu.
import * as painel from "../../modules/matriz/painel.js";
import * as unidades from "../../modules/matriz/unidades.js";
import * as itens from "../../modules/matriz/itens.js";
import * as fornecedores from "../../modules/matriz/fornecedores.js";
import * as usuarios from "../../modules/matriz/usuarios.js";
import * as pedidos from "../../modules/matriz/pedidos.js";

export const matrizModules=[
 {id:"painel",label:"Painel",icon:"home",mod:painel},
 {id:"pedidos",label:"Pedidos das lojas",icon:"cart",mod:pedidos},
 {id:"itens",label:"Itens",icon:"box",group:"Cadastros",groupIcon:"edit",mod:itens},
 {id:"fornecedores",label:"Fornecedores",icon:"truck",group:"Cadastros",mod:fornecedores},
 {id:"unidades",label:"Unidades",icon:"store",group:"Cadastros",mod:unidades},
 {id:"usuarios",label:"Usuários e acessos",icon:"users",group:"Cadastros",mod:usuarios}
];
