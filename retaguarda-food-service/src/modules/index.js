import matriz from "./matriz/index.js";
import fornecedores from "./fornecedores/index.js";
import contagem from "./contagem/index.js";
import notas from "./notas-fiscais/index.js";
import compras from "./pedidos-compra/index.js";
import transferencias from "./transferencias/index.js";
import cmv from "./cmv/index.js";
import usuarios from "./usuarios/index.js";
const listas={id:"listas",label:"Listas",title:"Listas de contagem e compra",group:"OPERAÇÃO",initials:"LS",
 description:"Listas de itens para inventário e pedidos.",table:"purchase_lists",storeColumn:"store_id",
 requiresStore:true,orderBy:"created_at",columns:[{key:"name",label:"Nome"},{key:"list_type",label:"Uso"},{key:"active",label:"Ativa",kind:"boolean"}]};
const perdas={id:"perdas",label:"Perdas",title:"Registro de perdas",group:"OPERAÇÃO",initials:"PD",
 description:"Quebras, vencimentos e descarte de insumos.",table:"losses",storeColumn:"store_id",
 requiresStore:true,orderBy:"loss_date",columns:[{key:"loss_date",label:"Data",kind:"date"},{key:"reason",label:"Motivo"},{key:"status",label:"Status",kind:"status"}]};
const lojas={id:"lojas",label:"Lojas",title:"Cadastro de lojas",group:"MATRIZ",initials:"LJ",
 description:"Cadastro central de unidades de operação.",table:"stores",orderBy:"name",
 columns:[{key:"code",label:"Código"},{key:"name",label:"Loja"},{key:"store_type",label:"Tipo"},{key:"active",label:"Ativa",kind:"boolean"}]};
export const modules=[
 {id:"dashboard",label:"Visão geral",title:"Dashboard",group:"VISÃO GERAL",initials:"DB"},
 matriz,fornecedores,lojas,usuarios,contagem,listas,notas,compras,transferencias,perdas,cmv
];
export const moduleById=Object.fromEntries(modules.map(m=>[m.id,m]));
