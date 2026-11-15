export default {
  id:"usuarios",label:"Usuários",title:"Perfis de usuários",group:"MATRIZ",initials:"US",
  description:"Visão de perfis autorizados. A gestão de permissões por aba e por loja será implementada em etapa própria.",
  table:"user_profiles",requiresStore:false,orderBy:"created_at",
  columns:[
    {key:"display_name",label:"Nome"}, {key:"active",label:"Ativo",kind:"boolean"},
    {key:"created_at",label:"Cadastrado em",kind:"date"}
  ]
};
