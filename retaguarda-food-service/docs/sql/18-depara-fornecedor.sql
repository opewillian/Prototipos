-- Retaguarda MFT · De-para de itens do fornecedor (cadastro central da Matriz).
-- Para cada fornecedor: código do produto na nota (cProd do XML) -> nosso item interno + conversão.
-- factor = quantas unidades do NOSSO item (na unidade base dele: un, kg ou l) vêm em 1 unidade do fornecedor.
--   Ex.: fornecedor X, código 110, vende "CX" com 12 garrafas -> item interno Água 500ml (un), factor 12.
--   Na entrada da nota: quantidade interna = quantidade da nota × factor; custo unitário interno = valor unitário da nota ÷ factor.
-- Só cria a tabela; nada é apagado. Acesso igual a suppliers/items: membro MFT lê, administrador da Matriz grava.
-- Reversão: drop table if exists public.supplier_item_map;
begin;
create table if not exists public.supplier_item_map (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_item_code text not null check (btrim(supplier_item_code) <> ''),
  supplier_description text,
  supplier_unit text,
  item_id uuid not null references public.items(id) on delete restrict,
  factor numeric(14,6) not null check (factor > 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Um código de produto por fornecedor (sem diferenciar maiúsculas e espaços nas pontas).
create unique index if not exists supplier_item_map_code_key on public.supplier_item_map (supplier_id, lower(btrim(supplier_item_code)));
create index if not exists supplier_item_map_item_idx on public.supplier_item_map (item_id);
alter table public.supplier_item_map enable row level security;
drop policy if exists supplier_item_map_read on public.supplier_item_map;
create policy supplier_item_map_read on public.supplier_item_map for select to authenticated using (mft_private.is_mft_member());
drop policy if exists supplier_item_map_matrix_manage on public.supplier_item_map;
create policy supplier_item_map_matrix_manage on public.supplier_item_map for all to authenticated
  using (mft_private.is_matrix_admin()) with check (mft_private.is_matrix_admin());
grant select, insert, update, delete on public.supplier_item_map to authenticated;

select (select count(*) from public.supplier_item_map) linhas,
       (select relrowsecurity from pg_class where oid='public.supplier_item_map'::regclass) rls,
       (select string_agg(policyname, ',') from pg_policies where schemaname='public' and tablename='supplier_item_map') politicas;
commit;
