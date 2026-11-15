export const storeModules=[
 {id:"dashboard",label:"Visão da loja",initials:"IN"},
 {id:"contagem",label:"Contagem",initials:"CT"},
 {id:"listas",label:"Listas",initials:"LS"},
 {id:"notas",label:"Notas fiscais",initials:"NF"},
 {id:"compras",label:"Pedidos de compra",initials:"PC"},
 {id:"transferencias",label:"Transferências",initials:"TR"},
 {id:"perdas",label:"Perdas",initials:"PD"},
 {id:"cmv",label:"CMV",initials:"CM"}
];
export const storeIds=new Set(storeModules.map(x=>x.id));
