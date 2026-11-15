export default {
  id:"transferencias",label:"Transferências",title:"Transferências entre lojas",group:"OPERAÇÃO",initials:"TR",
  description:"Movimentações de saída e entrada entre unidades, com rastreabilidade da origem ao destino.",
  table:"transfers",requiresStore:true,orderBy:"created_at",
  columns:[
    {key:"number",label:"Transferência"}, {key:"from_store_id",label:"Origem"},
    {key:"to_store_id",label:"Destino"}, {key:"status",label:"Status",kind:"status"}
  ]
};
