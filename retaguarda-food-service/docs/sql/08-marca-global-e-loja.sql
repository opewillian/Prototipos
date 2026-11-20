-- Retaguarda MFT · marca global e marca da loja.
-- Regra: a loja vê só os itens da marca dela + os da marca global. Item sem marca não aparece em nenhuma loja.
-- Executar no SQL Editor do Supabase (projeto nngcbrqemhnbyqjjdnlh), com usuário administrador.
-- Só acrescenta colunas e cadastra 2 marcas; liga a CGH (id 'teste') à Delta Expresso (aprovado em 20/11/2026).
-- Reversão: update public.stores set brand_id = null where id = 'teste';
--           alter table public.stores drop column if exists brand_id;
--           alter table public.brands drop column if exists is_global;   (e apagar as 2 marcas, se sem itens)
begin;
alter table public.brands add column if not exists is_global boolean not null default false;
-- No máximo uma marca global.
create unique index if not exists brands_one_global on public.brands (is_global) where is_global;

insert into public.brands (name, is_global) values ('Global', true), ('Delta Expresso', false)
on conflict ((lower(btrim(name)))) do nothing;

alter table public.stores add column if not exists brand_id uuid references public.brands(id) on delete restrict;
create index if not exists stores_brand_id_idx on public.stores (brand_id);

update public.stores
   set brand_id = (select id from public.brands where lower(name) = 'delta expresso'), updated_at = now()
 where id = 'teste' and brand_id is null;

select s.id, s.code, s.name, b.name as marca,
       (select string_agg(name||case when is_global then ' (global)' else '' end, ', ' order by name) from public.brands) as marcas
  from public.stores s left join public.brands b on b.id = s.brand_id order by s.store_type, s.name;
commit;
