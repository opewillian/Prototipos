import matriz from "./matriz/index.js";
import fornecedores from "./fornecedores/index.js";
import contagem from "./contagem/index.js";
import notas from "./notas-fiscais/index.js";
import compras from "./pedidos-compra/index.js";
import transferencias from "./transferencias/index.js";
import cmv from "./cmv/index.js";
import usuarios from "./usuarios/index.js";

export const modules = [
  {id:"dashboard",label:"Visão geral",title:"Dashboard",group:"VISÃO GERAL",initials:"DB"},
  matriz, fornecedores, usuarios, contagem, notas, compras, transferencias, cmv
];
export const moduleById = Object.fromEntries(modules.map((item) => [item.id,item]));
