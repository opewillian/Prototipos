// Ambiente Loja: registro dos módulos, grupos do menu e liberação por loja.
import * as inicio from "../../modules/loja/inicio.js";
import * as contagem from "../../modules/loja/contagem.js";
import * as listas from "../../modules/loja/listas.js";
import * as notas from "../../modules/loja/notas.js";
import * as pedidos from "../../modules/loja/pedidos.js";
import * as transferencias from "../../modules/loja/transferencias.js";
import * as perdas from "../../modules/loja/perdas.js";
import * as cmv from "../../modules/loja/cmv.js";
import * as faturamento from "../../modules/loja/faturamento.js";
import {storePerm} from "../../core/access.js";

// feature = código em store_feature_flags; módulos sem liberação não aparecem.
export const lojaModules=[
 {id:"inicio",label:"Início",icon:"home",mod:inicio},
 {id:"faturamento",label:"Faturamento",icon:"receipt",group:"Financeiro",groupIcon:"cash",feature:"cmv",mod:faturamento},
 {id:"contagem",label:"Contagem",icon:"clipboard",group:"Estoque",groupIcon:"box",feature:"counts",mod:contagem},
 {id:"listas",label:"Listas",icon:"list",group:"Estoque",feature:"lists",mod:listas},
 {id:"transferencias",label:"Transferências",icon:"swap",group:"Estoque",feature:"transfers",mod:transferencias},
 {id:"perdas",label:"Perdas",icon:"trash",group:"Estoque",feature:"losses",mod:perdas},
 {id:"pedidos",label:"Pedidos de compra",icon:"cart",group:"Compras",groupIcon:"cart",feature:"orders",mod:pedidos},
 {id:"notas",label:"Notas fiscais",icon:"receipt",group:"Compras",feature:"notes",mod:notas},
 {id:"cmv",label:"CMV",icon:"chart",group:"Análise",groupIcon:"chart",feature:"cmv",mod:cmv}
];
export function enabledModules(app,storeId){
 const flags=app.flags[storeId]||{};
 return lojaModules.filter(m=>!m.feature||(flags[m.feature]===true&&storePerm(app,storeId,m.feature).v));
}
export function lojaCanEdit(app,storeId,id){const m=lojaModules.find(x=>x.id===id);return !m?.feature||storePerm(app,storeId,m.feature).e}
