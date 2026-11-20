-- Retaguarda MFT · cadastro de itens: adiciona Marca e Tipo.
-- Executar no SQL Editor do Supabase (projeto nngcbrqemhnbyqjjdnlh), com usuário administrador.
-- Só acrescenta colunas; nada é apagado. A coluna "category" continua existindo (sem uso novo).
-- Tipos: Matéria-prima, Revenda, Embalagem, Produto acabado, Uso e consumo, Outras, Ativo imobilizado.
-- Status = coluna "active" que já existe (Ativo/Inativo).
-- Reversão: alter table public.items drop constraint if exists items_item_type_check;
--           alter table public.items drop column if exists brand, drop column if exists item_type;
begin;
alter table public.items add column if not exists brand text;
alter table public.items add column if not exists item_type text;
alter table public.items drop constraint if exists items_item_type_check;
alter table public.items add constraint items_item_type_check check (item_type is null or item_type in
 ('Matéria-prima','Revenda','Embalagem','Produto acabado','Uso e consumo','Outras','Ativo imobilizado'));
create index if not exists items_item_type_idx on public.items (item_type);
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='items' order by ordinal_position;
commit;
