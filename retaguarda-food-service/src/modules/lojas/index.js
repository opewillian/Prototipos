export default {
  id:"lojas",
  label:"Lojas",
  title:"Cadastro de lojas",
  group:"MATRIZ",
  initials:"LJ",
  description:"Unidades existentes no Supabase. Não é possível cadastrar, editar ou excluir lojas pela retaguarda.",
  readOnly:true,table:"stores",
  orderBy:"name",
  columns:[
    {key:"code",label:"Código"},
    {key:"name",label:"Loja"},
    {key:"store_type",label:"Tipo"},
    {key:"active",label:"Ativa",kind:"boolean"}
  ]
};
