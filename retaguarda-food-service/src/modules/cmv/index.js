export default {
  id:"cmv",label:"CMV",title:"CMV realizado",group:"ANÁLISE",initials:"CM",
  description:"Fechamentos por inventário: estoque inicial, compras elegíveis, perdas e estoque final.",
  table:"cmv_closings",storeColumn:"store_id",requiresStore:true,orderBy:"end_date",
  columns:[
    {key:"start_date",label:"Início",kind:"date"}, {key:"end_date",label:"Fim",kind:"date"},
    {key:"opening_stock",label:"Estoque inicial",kind:"money"},
    {key:"eligible_purchases",label:"Compras",kind:"money"},
    {key:"eligible_losses",label:"Perdas",kind:"money"},
    {key:"closing_stock",label:"Estoque final",kind:"money"},
    {key:"cmv_value",label:"CMV",kind:"money"}
  ]
};
