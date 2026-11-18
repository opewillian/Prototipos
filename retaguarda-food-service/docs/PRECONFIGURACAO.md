# Pré-configuração de lojas

## Situação inicial

- Matriz: unidade especial `matriz`, somente administração
- Teste: unidade operacional `teste`, primeira a receber novas funcionalidades
- Cadastro de novas unidades bloqueado dentro do aplicativo e para usuários autenticados na tabela `stores`

## Ordem recomendada

1. Entre com o administrador da Matriz.
2. Confira a unidade Teste em **Unidades** (visualização, não edição).
3. Cadastre itens e fornecedores no catálogo central.
4. Abra o ambiente Loja, selecione **Teste** e crie as listas operacionais.
5. Teste cadastros, alterações de status e efeitos de estoque somente na Teste.
6. Depois de homologar cada módulo, libere-o individualmente para outras lojas pelo Supabase.

Todas as operações usam dados reais de Supabase. Nenhuma loja ou ficha fictícia é cadastrada automaticamente.
