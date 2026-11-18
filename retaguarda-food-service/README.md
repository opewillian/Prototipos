# Retaguarda Food Service

Aplicação modular para gestão de lojas food service, com dois ambientes independentes: **Matriz** e **Loja**.

## Acesso

A URL publicada é https://retaguarda-food-service.pages.dev

O botão **Entrar** abre a escolha de ambiente. O acesso a qualquer informação operacional exige **login real no Supabase Auth**. Não existe modo de demonstração ou dados fictícios na aplicação.

## Organização

- `src/areas/matriz/`: painel e menu administrativos, consultas, cadastros centrais
- `src/areas/loja/`: painel e menu operacionais, seleção da unidade
- `src/areas/selection.js`: escolha de Matriz ou Loja e seleção de unidade
- `src/modules/`: módulos de itens, fornecedores, unidades, usuários, contagem, listas, notas, compras, transferências, perdas e CMV
- `src/core/`: cliente Supabase, validações, consultas e permissões de funcionalidades
- `src/components/`: formulários e tabelas compartilhadas
- `assets/`: estilos por ambiente
- `docs/ARQUITETURA.md`: isolamento por unidade e fluxo de liberação

## Banco de dados

Banco existente: **Retaguarda MFT** (`nngcbrqemhnbyqjjdnlh`).

- `matriz`: unidade administrativa especial
- `teste`: unidade operacional de homologação
- No banco, `stores` é **somente leitura** para usuários da retaguarda. Criar, editar ou excluir lojas requer administração fora do aplicativo.
- Registros transacionais usam `store_id` (ou `from_store_id`/`to_store_id` nas transferências), com RLS e chaves estrangeiras compostas que preservam isolamento.
- `store_feature_flags` controla liberações **por unidade**. Inicialmente somente a loja `teste` recebeu liberação de funcionalidades.
- Catálogo `items` e cadastro `suppliers` são centrais e compartilhados pela Matriz; os vínculos item–loja–fornecedor são específicos da unidade.

A chave do frontend é **publicável**. Nunca inclua chave secreta ou `service_role` no repositório.

## Publicação

Cloudflare Pages ligado ao repositório privado `opewillian/Prototipos`, branch `main`, raiz `retaguarda-food-service`, build `npm run build`, saída `dist`.

Comandos de validação:

```bash
npm run test
npm run build
```

O build inclui testes de separação entre Matriz e Loja, checagens estáticas e cópia do site. Testes reais de autenticação e escrita devem ser realizados no navegador com a conta autorizada, iniciando pela unidade Teste.
