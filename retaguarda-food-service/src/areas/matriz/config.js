export const matrixModules=[
 {id:"inicio-matriz",label:"Painel da Matriz",initials:"PM",group:"GESTÃO"},
 {id:"configuracao",label:"Configuração inicial",initials:"CF",group:"GESTÃO"},
 {id:"lojas",label:"Unidades",initials:"LJ",group:"CADASTROS"},
 {id:"matriz",label:"Itens",initials:"IT",group:"CADASTROS"},
 {id:"fornecedores",label:"Fornecedores",initials:"FO",group:"CADASTROS"},
 {id:"usuarios",label:"Usuários e perfis",initials:"US",group:"CADASTROS"},
 {id:"pedidos-matriz",label:"Pedidos das lojas",initials:"PC",group:"ACOMPANHAMENTO"}
];
export const matrixIds=new Set(matrixModules.map(x=>x.id));
