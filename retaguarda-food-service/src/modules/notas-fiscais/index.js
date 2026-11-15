export default {
  id:"notas",label:"Notas fiscais",title:"Notas fiscais",group:"OPERAÇÃO",initials:"NF",
  description:"Entradas fiscais por loja. O módulo futuro incluirá itens, parcelas, vencimentos e anexos.",
  table:"invoices",storeColumn:"store_id",requiresStore:true,orderBy:"entry_date",
  columns:[
    {key:"invoice_number",label:"Número"}, {key:"issue_date",label:"Emissão",kind:"date"},
    {key:"entry_date",label:"Entrada",kind:"date"}, {key:"status",label:"Status",kind:"status"}
  ]
};
