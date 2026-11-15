export default {
  id:"compras",label:"Pedidos de compra",title:"Pedidos de compra",group:"OPERAÇÃO",initials:"PC",
  description:"Pedidos por unidade, com data de entrega e situação. Sugestões e agrupamento por fornecedor serão acrescentados depois.",
  table:"purchase_orders",storeColumn:"store_id",requiresStore:true,orderBy:"created_at",
  columns:[
    {key:"number",label:"Pedido"}, {key:"delivery_date",label:"Entrega",kind:"date"},
    {key:"status",label:"Status",kind:"status"}, {key:"observation",label:"Observação"}
  ]
};
