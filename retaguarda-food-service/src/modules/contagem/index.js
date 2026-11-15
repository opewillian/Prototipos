export default {
  id:"contagem",label:"Contagens",title:"Contagem de estoque",group:"OPERAÇÃO",initials:"CT",
  description:"Inventários por data e unidade. Contagens finalizadas devem ser bloqueadas na futura edição.",
  table:"stock_counts",storeColumn:"store_id",requiresStore:true,orderBy:"count_date",
  columns:[
    {key:"display_id",label:"Contagem"}, {key:"count_date",label:"Data",kind:"date"},
    {key:"status",label:"Status",kind:"status"}, {key:"notes",label:"Observações"}
  ]
};
