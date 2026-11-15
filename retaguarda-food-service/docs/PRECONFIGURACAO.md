# Pré-configuração do ambiente (Retaguarda Food Service)

O primeiro administrador foi cadastrado no Supabase, e a aplicação está publicada no Cloudflare Pages. A tela **Configuração inicial** guia o cadastro de cada etapa.

## Ordem de implantação

1. **Lojas:** cadastre as unidades operacionais pelo módulo Matriz → Lojas. Não use a loja `matriz` para documentos de operação.
2. **Itens:** preencha o catálogo central com códigos, nomes, unidade de medida, custo padrão, estoque mínimo e participação no CMV.
3. **Fornecedores:** cadastre os fornecedores centrais.
4. **Listas de Compras (LCs):** selecione a loja operacional no topo, abra Listas e crie listas de tipo Contagem, Compra ou Ambos. Adicione itens já existentes no catálogo.

## Comportamento implementado

- Navegação com etapa de configuração inicial e contadores de registros visíveis ao usuário.
- Cada módulo permanece isolado na pasta `src/modules/<módulo>/`.
- Listas separadas por loja usando a coluna `store_id`.
- O sistema impede adicionar o mesmo item duas vezes na mesma lista pelo formulário.
- O formulário impede que uma lista de operação seja criada na unidade especial `matriz`.
- O banco continua sendo responsável pela autorização (RLS). A etapa de configuração não cria dados automaticamente.
- Contadores são dos registros visíveis ao usuário autenticado, não totais globais irrestritos.

## Próximas decisões funcionais

- Vínculo `item x loja x fornecedor` em interface própria; o banco já possui `store_item_suppliers`.
- Uso da lista para pré-carregar itens na contagem e no pedido de compra, sem duplicação.
- Fluxo de permissões por aba e loja na Matriz.
- Testes reais com uma loja e usuário autorizados, antes de lançar movimentos fiscais ou finalizar estoque.

Os dados de demonstração são fictícios. O modo Supabase utiliza o projeto existente Retaguarda MFT; nenhum dado foi criado nesta pré-configuração.
