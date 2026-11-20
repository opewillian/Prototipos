-- Retaguarda MFT · contagem com colunas por lista ("Adicionar via lista"). Pedido do Willian em 20/11/2026.
-- Só acrescenta colunas; nada é apagado e o cálculo de estoque/CMV continua usando counted_quantity (= total).
--   stock_counts.list_columns : listas adicionadas à contagem, na ordem, com o nome da época  [{"id":"<uuid>","name":"Câmara fria"}]
--   stock_count_items.parts   : quantidade por coluna  {"manual": 2, "<id da lista>": 3}   (total = soma)
-- As proteções já existentes (contagem finalizada não muda) continuam valendo nas duas tabelas.
-- Reversão: alter table public.stock_count_items drop column if exists parts;
--           alter table public.stock_counts drop column if exists list_columns;
begin;
alter table public.stock_counts add column if not exists list_columns jsonb not null default '[]'::jsonb;
alter table public.stock_count_items add column if not exists parts jsonb not null default '{}'::jsonb;
select (select count(*) from information_schema.columns where table_schema='public' and table_name='stock_counts' and column_name='list_columns') list_columns,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='stock_count_items' and column_name='parts') parts,
       (select count(*) from public.stock_count_items) linhas_existentes;
commit;
