-- 20: De-para automático na nota.
-- invoice_nfe_items.invoice_item_id = linha de invoice_items (entrada no estoque) gerada a partir da linha da NF-e pelo de-para.
-- supplier_item_map.item_unit = unidade do nosso item escolhida no de-para (un, kg ou l; tem que ser a unidade do cadastro do item).
-- Só acrescenta colunas; nada é apagado.
-- Reversão: alter table public.invoice_nfe_items drop column if exists invoice_item_id; alter table public.supplier_item_map drop column if exists item_unit;
begin;
alter table public.invoice_nfe_items add column if not exists invoice_item_id uuid references public.invoice_items(id) on delete set null;
alter table public.supplier_item_map add column if not exists item_unit text;
alter table public.supplier_item_map drop constraint if exists supplier_item_map_item_unit_check;
alter table public.supplier_item_map add constraint supplier_item_map_item_unit_check check (item_unit is null or item_unit in ('un','kg','l'));
select (select count(*) from information_schema.columns where table_schema='public' and table_name='invoice_nfe_items' and column_name='invoice_item_id') nfe_link,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='supplier_item_map' and column_name='item_unit') map_unit;
commit;
