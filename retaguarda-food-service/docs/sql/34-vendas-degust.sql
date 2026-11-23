-- 34: Faturamento — vendas importadas da Linx Degust One (função "degust", ação "importar").
-- Gravação só pela função do servidor (service role). Leitura no app: quem vê o CMV da loja (aba 'cmv') ou admin da Matriz.
-- Não guardamos CPF/CNPJ do consumidor: só se a venda teve documento (has_customer_doc).
begin;

-- Vínculo loja da Retaguarda ↔ código da loja no Degust.
alter table public.stores add column if not exists degust_code integer;
create unique index if not exists stores_degust_code_key on public.stores (degust_code) where degust_code is not null;
update public.stores set degust_code = 12 where id = 'teste';   -- DEL-CGH-PUB = Degust 12 "DELTA AERO CONGONHAS 09-03 - PUBLICA"

-- Venda (cupom). business_date = dia do caixa consultado na Linx.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores(id) on delete cascade,
  business_date date not null,
  control bigint not null,
  sale_date text,                 -- dataVenda como veio (DD/MM/AAAA)
  created_raw text,               -- dataHoraInclusao como veio
  pdv text, opening text, sale_type text,
  cancelled boolean not null default false,
  gross numeric(14,2) not null default 0,       -- valProduto
  discount numeric(14,2) not null default 0,    -- valDesconto (venda)
  item_discount numeric(14,2) not null default 0, -- valDescontoItem
  surcharge numeric(14,2) not null default 0,   -- valAcrescimo
  net numeric(14,2) not null default 0,         -- valLiquido
  change_amount numeric(14,2) not null default 0, -- valTroco
  has_customer_doc boolean,
  doc_model text, doc_number bigint, doc_key text, doc_status text,
  imported_at timestamptz not null default now(),
  unique (store_id, business_date, control)
);
create index if not exists sales_store_date_idx on public.sales (store_id, business_date);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  store_id text not null,
  business_date date not null,
  line integer,                   -- numLancto
  main_line integer,              -- numLanctoItemPrincipal (adicional de combo)
  product_code integer,
  product_name text,
  unit text,
  quantity numeric(14,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  total numeric(14,2) not null default 0,       -- valTotal
  discount numeric(14,2) not null default 0,    -- valDesconto do item
  cancelled boolean not null default false,
  stock_item_code integer         -- fiscal.codItemEstoque
);
create index if not exists sale_items_store_date_idx on public.sale_items (store_id, business_date);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  store_id text not null,
  business_date date not null,
  seq text,
  method text,                    -- formaPgto
  method_code text,               -- codFormaPagamento
  brand text,                     -- bandeira
  amount numeric(14,2) not null default 0,
  installments integer
);
create index if not exists sale_payments_store_date_idx on public.sale_payments (store_id, business_date);

-- Controle do que já foi importado (um registro por loja e dia).
create table if not exists public.sales_imports (
  store_id text not null references public.stores(id) on delete cascade,
  business_date date not null,
  sales integer not null default 0,
  cancelled integer not null default 0,
  net numeric(14,2) not null default 0,
  imported_at timestamptz not null default now(),
  imported_by uuid,
  primary key (store_id, business_date)
);

-- RLS: leitura para quem vê o CMV da loja; nenhuma escrita pelo app.
do $$ declare t text; begin
  foreach t in array array['sales','sale_items','sale_payments','sales_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (mft_private.has_tab_access(store_id,''cmv'',false))', t||'_read', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Resumos para a tela de Faturamento (respeitam o RLS de quem consulta). Vendas canceladas ficam fora dos valores.
create or replace function public.sales_by_day(p_store text, p_from date, p_to date)
returns table (business_date date, sales bigint, cancelled bigint, gross numeric, discount numeric, net numeric)
language sql stable security invoker set search_path = '' as $$
  select s.business_date,
         count(*) filter (where not s.cancelled),
         count(*) filter (where s.cancelled),
         coalesce(sum(s.gross) filter (where not s.cancelled),0),
         coalesce(sum(s.discount + s.item_discount) filter (where not s.cancelled),0),
         coalesce(sum(s.net) filter (where not s.cancelled),0)
  from public.sales s
  where s.store_id = p_store and s.business_date between p_from and p_to
  group by s.business_date order by s.business_date;
$$;

create or replace function public.sales_by_product(p_store text, p_from date, p_to date)
returns table (product_code integer, product_name text, quantity numeric, total numeric, discount numeric, net numeric)
language sql stable security invoker set search_path = '' as $$
  select i.product_code, max(i.product_name), sum(i.quantity), sum(i.total), sum(i.discount), sum(i.total - i.discount)
  from public.sale_items i join public.sales s on s.id = i.sale_id
  where i.store_id = p_store and i.business_date between p_from and p_to and not i.cancelled and not s.cancelled
  group by i.product_code order by 6 desc;
$$;

create or replace function public.sales_by_payment(p_store text, p_from date, p_to date)
returns table (method text, brand text, payments bigint, amount numeric)
language sql stable security invoker set search_path = '' as $$
  select coalesce(nullif(btrim(p.method),''),'Não informado'), coalesce(nullif(btrim(p.brand),''),''), count(*), sum(p.amount)
  from public.sale_payments p join public.sales s on s.id = p.sale_id
  where p.store_id = p_store and p.business_date between p_from and p_to and not s.cancelled
  group by 1, 2 order by 4 desc;
$$;
grant execute on function public.sales_by_day(text,date,date), public.sales_by_product(text,date,date), public.sales_by_payment(text,date,date) to authenticated;

select id, name, degust_code from public.stores where degust_code is not null;
commit;
