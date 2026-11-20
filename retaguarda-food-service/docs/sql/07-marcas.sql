-- Retaguarda MFT · tabela de Marcas (cadastro central da Matriz, como items e suppliers).
-- Executar no SQL Editor do Supabase (projeto nngcbrqemhnbyqjjdnlh), com usuário administrador.
-- Só cria a tabela e acrescenta items.brand_id; nada é apagado. items.brand (texto) fica como legado.
-- Acesso igual ao de items: qualquer membro MFT lê; só administrador da Matriz grava.
-- Reversão: alter table public.items drop column if exists brand_id; drop table if exists public.brands;
begin;
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Nome único sem diferenciar maiúsculas/minúsculas e espaços nas pontas.
create unique index if not exists brands_name_key on public.brands (lower(btrim(name)));
alter table public.brands enable row level security;
drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands for select to authenticated using (mft_private.is_mft_member());
drop policy if exists brands_matrix_manage on public.brands;
create policy brands_matrix_manage on public.brands for all to authenticated
  using (mft_private.is_matrix_admin()) with check (mft_private.is_matrix_admin());
grant select, insert, update, delete on public.brands to authenticated;

alter table public.items add column if not exists brand_id uuid references public.brands(id) on delete restrict;
create index if not exists items_brand_id_idx on public.items (brand_id);

select (select count(*) from public.brands) marcas,
       (select relrowsecurity from pg_class where oid='public.brands'::regclass) rls,
       (select string_agg(policyname, ',') from pg_policies where schemaname='public' and tablename='brands') politicas,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='items' and column_name='brand_id') items_brand_id;
commit;
