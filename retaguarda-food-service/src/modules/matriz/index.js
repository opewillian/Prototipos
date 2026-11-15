export default {
  id:"matriz", label:"Matriz · Itens", title:"Cadastro de itens", group:"MATRIZ", initials:"IT",
  description:"Catálogo central de insumos, embalagens e materiais, com unidade, custo e composição do CMV.",
  table:"items", orderBy:"name", ascending:true, requiresStore:false,
  columns:[
    {key:"code",label:"Código"}, {key:"name",label:"Item"}, {key:"category",label:"Categoria"},
    {key:"base_unit",label:"Unid."}, {key:"default_unit_cost",label:"Custo base",kind:"money"},
    {key:"composes_cmv",label:"Compõe CMV",kind:"boolean"}
  ]
};
