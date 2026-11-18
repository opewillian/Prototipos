# Ambientes Matriz e Loja

O usuário clica em **Entrar**, escolhe entre **Matriz** e **Loja** e autentica-se no Supabase para ver dados reais. A escolha de ambiente não concede permissões.

## Matriz

- Painel administrativo e acompanhamento de compras de várias unidades
- Cadastro central de itens e fornecedores
- Usuários e perfis (visualização; gestão de permissões será evoluída)
- Lista das unidades em modo **somente leitura**
- O botão de criar unidade foi removido e o banco revogou privilégios de gravação em `stores` para usuários autenticados.

## Loja

- Seleção de unidade operacional autorizada
- Painel, Contagem, Listas, Notas Fiscais, Pedidos de Compra, Transferências, Perdas, CMV
- Registros isolados por `store_id` e políticas RLS
- `store_feature_flags` define, por unidade, quais funcionalidades podem receber gravações
- Inicialmente, **Teste** é a única unidade operacional provisionada e liberada para homologação

As telas e os módulos ficam em arquivos independentes em `src/areas/matriz/`, `src/areas/loja/` e `src/modules/`. O cliente Supabase fica em `src/core/`.

Não há registros fictícios ou alternância de fonte de dados.
