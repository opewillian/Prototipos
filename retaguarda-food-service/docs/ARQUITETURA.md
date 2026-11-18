# Retaguarda Food Service — Arquitetura e homologação por loja

## Fluxo de navegação

1. **Entrar** → tela de escolha entre **Matriz** e **Loja**.
2. A autenticação real no Supabase é exigida antes de carregar dados.
3. **Matriz**: gestão central, itens, fornecedores, usuários, unidades **somente leitura** e acompanhamento de pedidos.
4. **Loja**: escolha de uma unidade operacional autorizada e acesso aos módulos Contagem, Listas, Notas, Pedidos, Transferências, Perdas e CMV.

## Isolamento no Supabase

Um único projeto `Retaguarda MFT`, com dados **separados por loja** no banco:

- Chaves `store_id` em contagens, pedidos, itens de pedidos, notas, anexos, listas, perdas, CMV e movimentações de estoque.
- Transferências usam `from_store_id` e `to_store_id`, com o par vinculado aos itens.
- Chaves estrangeiras compostas (ID do pai + loja) impedem adicionar itens de um documento em outra unidade.
- Supabase Auth e políticas RLS em todas as tabelas operacionais; permissões de usuário/loja/aba persistem no banco.
- `store_stock_balance` e `store_last_purchase_cost` são views `security_invoker=true`, sujeitas a RLS das tabelas de origem.
- `items` e `suppliers` são catálogos corporativos, enquanto `store_item_suppliers` guarda vínculos próprios por loja.

## Unidades

A unidade operacional **Teste** usa `id=teste`. A unidade administrativa especial usa `id=matriz`.

O frontend não contém formulário para criar lojas. O usuário autenticado também não tem privilégios SQL de `INSERT`, `UPDATE` ou `DELETE` na tabela `stores`. Novas unidades só podem ser provisionadas pelo administrador no Supabase (não pelo aplicativo).

## Liberação de funcionalidades

Tabela: `public.store_feature_flags(store_id, feature_code, enabled)`.

Módulos operacionais: `counts`, `lists`, `notes`, `orders`, `transfers`, `losses`, `cmv`.
Suporte interno: `catalog`, `stock`, `api`.

O banco recusa gravações por módulos não liberados. A tela também verifica o status da loja antes de habilitar os formulários. **Todas as liberações estão inicialmente concentradas na loja Teste**.

Após testar e aprovar uma funcionalidade, o administrador da infraestrutura poderá autorizar sua publicação em outra unidade usando o painel/SQL do Supabase. A retaguarda não disponibiliza edição dessas flags.

Exemplo de habilitação **administrativa** após homologação:

```sql
insert into public.store_feature_flags (store_id, feature_code, enabled)
values ('id-da-loja-ja-provisionada', 'counts', true)
on conflict (store_id, feature_code)
do update set enabled = excluded.enabled, updated_at = now();
```

Esta operação deve ser feita em sessão administrativa do banco, e **não** pelo cliente do navegador.

## Observações

- A loja Teste é uma unidade real no banco, mas sem registros transacionais inseridos automaticamente.
- Não foram criados dados fictícios.
- Transferências entre lojas exigem que **ambas** as unidades estejam liberadas para transferências no banco, evitando que uma homologação altere estoque de uma loja em produção.
- Os recursos ainda incompletos (anexos, gestão visual de permissões, cálculo de CMV) não devem ser considerados homologados por terem a flag ativa. As flags habilitam operações disponíveis, não garantem funcionalidade completa.
