export default {
  id:"fornecedores", label:"Fornecedores", title:"Fornecedores", group:"MATRIZ", initials:"FO",
  description:"Fornecedores cadastrados pela matriz. Vínculos item–unidade–fornecedor serão detalhados posteriormente.",
  table:"suppliers", orderBy:"name", ascending:true, requiresStore:false,
  columns:[
    {key:"code",label:"Código"}, {key:"name",label:"Fornecedor"},
    {key:"email",label:"E-mail"}, {key:"active",label:"Ativo",kind:"boolean"}
  ]
};
