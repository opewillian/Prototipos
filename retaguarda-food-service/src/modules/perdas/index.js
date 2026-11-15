export default {
  id:"perdas",
  label:"Perdas",
  title:"Registro de perdas",
  group:"OPERAÇÃO",
  initials:"PD",
  description:"Controle de vencimentos, avarias e descartes por loja.",
  table:"losses",
  storeColumn:"store_id",
  requiresStore:true,
  orderBy:"loss_date",
  columns:[
    {key:"loss_date",label:"Data",kind:"date"},
    {key:"reason",label:"Motivo"},
    {key:"status",label:"Status",kind:"status"}
  ]
};
