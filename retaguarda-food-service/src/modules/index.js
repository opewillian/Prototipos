import {descriptor as configuracao} from "./configuracao/index.js";
import matriz from "./matriz/index.js";
import fornecedores from "./fornecedores/index.js";
import lojas from "./lojas/index.js";
import usuarios from "./usuarios/index.js";
import contagem from "./contagem/index.js";
import listas from "./listas/index.js";
import notas from "./notas-fiscais/index.js";
import compras from "./pedidos-compra/index.js";
import transferencias from "./transferencias/index.js";
import perdas from "./perdas/index.js";
import cmv from "./cmv/index.js";

export const modules=[
  {id:"dashboard",label:"Visão geral",title:"Dashboard",group:"VISÃO GERAL",initials:"DB"},
  configuracao,matriz,fornecedores,lojas,usuarios,
  contagem,listas,notas,compras,transferencias,perdas,cmv
];
export const moduleById=Object.fromEntries(modules.map(m=>[m.id,m]));
