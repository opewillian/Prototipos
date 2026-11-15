export default {
  id:"listas",
  label:"Listas",
  title:"Listas de contagem e compra",
  group:"OPERAÇÃO",
  initials:"LS",
  description:"Listas vinculadas à loja, utilizadas para inventários e pedidos de compra.",
  table:"purchase_lists",
  storeColumn:"store_id",
  requiresStore:true,
  orderBy:"created_at",
  columns:[
    {key:"name",label:"Nome"},
    {key:"list_type",label:"Utilização"},
    {key:"active",label:"Ativa",kind:"boolean"}
  ]
};
