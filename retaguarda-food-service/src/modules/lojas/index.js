export default {
  id:"lojas",
  label:"Lojas",
  title:"Cadastro de lojas",
  group:"MATRIZ",
  initials:"LJ",
  description:"Cadastro das unidades operacionais, administrado pela Matriz.",
  table:"stores",
  orderBy:"name",
  columns:[
    {key:"code",label:"Código"},
    {key:"name",label:"Loja"},
    {key:"store_type",label:"Tipo"},
    {key:"active",label:"Ativa",kind:"boolean"}
  ]
};
