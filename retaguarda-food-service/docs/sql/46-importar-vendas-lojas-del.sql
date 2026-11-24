-- 46: Importação das vendas de TODAS as lojas DEL (pedido do usuário em 23/11/2026: "pode importar as vendas das lojas DEL;
--     vendas detalhadas do dia 01/10 para frente e resumida para trás").
-- Ligação loja x Degust: planilha Documents/MFT/LIGACAO_LOJAS_DEGUST.xlsx (CNPJ + valor vendido em 20/11 igual ao Everest).
-- Lojas com vários pontos do mesmo CNPJ (REC-PRA, MCZ-DES, CWB-DOM): como no Everest (uma empresa por CNPJ), os pontos são SOMADOS na loja
--   → stores.degust_codes. Duplicadas do cadastro: gravado na que bate o valor do Everest (SLZ-DES-75, PMW-CHE-1021, CWB-DES-74, BSB-NOR-3278).
-- Fila public.sales_import_jobs processada pela função "degust" (ação "fila", cron "degust-fila" a cada minuto):
--   kind "dias" = quinzena (1–15 e 16–fim) desde a 1ª venda da loja; kind "mes" = refaz o resumo do mês depois das quinzenas dele.
--   A função grava o arquivo completo só a partir de 01/10/2026 (DETALHE_DESDE); antes disso, só resumos.
--   CGH (teste) já tinha 2025 em diante: só entra 23/11/2021 a 31/12/2024.
begin;
alter table public.stores add column if not exists degust_codes integer[];
comment on column public.stores.degust_codes is 'Pontos de venda do Degust somados nesta loja (mesmo CNPJ). Vazio = usa degust_code.';

create table if not exists public.sales_import_jobs (
  id bigserial primary key,
  store_id text not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('dias','mes')),
  de date not null,
  ate date not null,
  priority integer not null default 1,
  status text not null default 'pending' check (status in ('pending','running','ok','erro')),
  tries integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_import_jobs_pend on public.sales_import_jobs (status, priority, de desc);
alter table public.sales_import_jobs enable row level security;   -- sem políticas: só a função (service role) usa

-- Pega o próximo trabalho (um por vez, sem duas execuções pegarem o mesmo). "running" parado há 15 min volta para a fila.
create or replace function public.claim_sales_import_job()
returns setof public.sales_import_jobs language plpgsql security definer set search_path = public as $$
declare j public.sales_import_jobs;
begin
  update public.sales_import_jobs set status = 'pending' where status = 'running' and updated_at < now() - interval '15 minutes';
  select * into j from public.sales_import_jobs x
   where x.status = 'pending'
     and (x.kind = 'dias' or not exists (select 1 from public.sales_import_jobs y
           where y.store_id = x.store_id and y.kind = 'dias' and y.status in ('pending','running')
             and y.de <= (date_trunc('month', x.de) + interval '1 month - 1 day')::date and y.ate >= date_trunc('month', x.de)::date))
   order by x.priority, x.de desc, x.id
   limit 1 for update skip locked;
  if not found then return; end if;
  update public.sales_import_jobs set status = 'running', tries = tries + 1, updated_at = now() where id = j.id returning * into j;
  return next j;
end $$;
revoke all on function public.claim_sales_import_job() from public, anon, authenticated;

-- Ligação das 45 lojas DEL (49 pontos) e período a importar de cada uma.
create temp table _del (id text, code int, codes int[], de date, ate date) on commit drop;
insert into _del values
  ('del-aju-che', 37, array[37]::int[], date '2021-12-13', date '2026-11-23'),
  ('del-aju-dom', 10028, array[10028]::int[], date '2021-12-13', date '2026-11-23'),
  ('del-bsb-cen-99', 13, array[13]::int[], date '2021-11-24', date '2026-11-23'),
  ('del-bsb-che-98', 10034, array[10034]::int[], date '2022-04-11', date '2026-11-23'),
  ('del-bsb-des-3279', 14, array[14]::int[], date '2021-11-24', date '2026-11-23'),
  ('del-bsb-nor-3278', 11, array[11]::int[], date '2021-11-24', date '2026-11-23'),
  ('del-bsb-sul-100', 10, array[10]::int[], date '2021-11-24', date '2026-11-23'),
  ('teste', 12, array[12]::int[], date '2021-11-23', date '2024-12-31'),
  ('del-cpv-che', 10054, array[10054]::int[], date '2023-10-05', date '2026-11-23'),
  ('del-cpv-dom', 10055, array[10055]::int[], date '2023-09-29', date '2026-11-23'),
  ('del-cwb-des-74', 10050, array[10050]::int[], date '2023-07-07', date '2026-11-23'),
  ('del-cwb-dom', null, array[21,10036]::int[], date '2021-12-02', date '2026-11-23'),
  ('del-for-p08', 39, array[39]::int[], date '2021-12-16', date '2026-11-23'),
  ('del-for-p20', 38, array[38]::int[], date '2021-12-15', date '2026-11-23'),
  ('del-for-pra', 52, array[52]::int[], date '2023-04-21', date '2026-11-23'),
  ('del-gig-des', 44, array[44]::int[], date '2022-01-15', date '2026-11-23'),
  ('del-gig-dom', 15, array[15]::int[], date '2021-12-03', date '2026-11-23'),
  ('del-gig-pia', 46, array[46]::int[], date '2021-12-09', date '2026-11-23'),
  ('del-gig-pib', 45, array[45]::int[], date '2022-11-04', date '2026-11-23'),
  ('del-jdo-che', 10053, array[10053]::int[], date '2023-09-11', date '2026-11-23'),
  ('del-jdo-dom', 10059, array[10059]::int[], date '2024-03-23', date '2026-11-23'),
  ('del-jpa-che', 56, array[56]::int[], date '2023-08-28', date '2026-11-23'),
  ('del-jpa-dom', 10037, array[10037]::int[], date '2022-05-04', date '2026-11-23'),
  ('del-jpa-pra', 10056, array[10056]::int[], date '2023-11-14', date '2026-11-23'),
  ('del-mcz-des', null, array[47,10047]::int[], date '2021-12-09', date '2026-11-23'),
  ('del-mcz-dom', 34, array[34]::int[], date '2021-12-09', date '2026-11-23'),
  ('del-nat-che-58', 30, array[30]::int[], date '2021-12-07', date '2026-11-23'),
  ('del-nat-des-60', 31, array[31]::int[], date '2021-12-07', date '2026-11-23'),
  ('del-nat-dom-59', 29, array[29]::int[], date '2021-12-07', date '2026-11-23'),
  ('del-nat-int-63', 55, array[55]::int[], date '2022-09-02', date '2026-11-23'),
  ('del-pmw-che-1021', 10049, array[10049]::int[], date '2023-05-13', date '2026-11-23'),
  ('del-poa-che', 10052, array[10052]::int[], date '2023-08-18', date '2026-11-23'),
  ('del-poa-des', 26, array[26]::int[], date '2021-12-02', date '2026-11-23'),
  ('del-rec-che', 42, array[42]::int[], date '2022-03-07', date '2026-11-23'),
  ('del-rec-dom', 40, array[40]::int[], date '2022-03-09', date '2026-11-23'),
  ('del-rec-pra', null, array[41,53,10057]::int[], date '2022-03-14', date '2026-11-23'),
  ('del-slz-des-75', 10048, array[10048]::int[], date '2023-05-08', date '2026-11-23'),
  ('del-ssa-dom', 27, array[27]::int[], date '2021-12-06', date '2026-11-23'),
  ('del-ssa-int', 10001, array[10001]::int[], date '2021-12-06', date '2026-11-23'),
  ('del-ssa-pub', 28, array[28]::int[], date '2021-12-06', date '2026-11-23'),
  ('del-the-che-121', 16, array[16]::int[], date '2021-12-08', date '2026-11-23'),
  ('del-vcp-b26', 20, array[20]::int[], date '2021-12-02', date '2026-11-23'),
  ('del-vcp-c15', 18, array[18]::int[], date '2021-12-01', date '2026-11-23'),
  ('del-vcp-mal', 19, array[19]::int[], date '2021-12-01', date '2026-11-23'),
  ('del-vix-dom', 4, array[4]::int[], date '2021-10-31', date '2026-11-23');

update public.stores s set degust_code = coalesce(d.code, d.codes[1]), degust_codes = case when cardinality(d.codes) > 1 then d.codes else null end
  from _del d where s.id = d.id;

-- Quinzenas (1–15, 16–fim do mês) dentro do período de cada loja.
insert into public.sales_import_jobs (store_id, kind, de, ate, priority)
select d.id, 'dias', greatest(q.ini, d.de), least(q.fim, d.ate), 1
  from _del d
  cross join lateral (
    select m::date + h.o as ini,
           case when h.o = 0 then m::date + 14 else (m + interval '1 month - 1 day')::date end as fim
      from generate_series(date_trunc('month', d.de), date_trunc('month', d.ate), interval '1 month') m
      cross join (values (0), (15)) h(o)
  ) q
 where q.fim >= d.de and q.ini <= d.ate;
-- Resumo de cada mês (roda quando as quinzenas do mês daquela loja terminam).
insert into public.sales_import_jobs (store_id, kind, de, ate, priority)
select d.id, 'mes', m::date, m::date, 2
  from _del d cross join generate_series(date_trunc('month', d.de), date_trunc('month', d.ate), interval '1 month') m;

select (select count(*) from public.stores where degust_code is not null) lojas_com_degust,
       count(*) filter (where kind = 'dias') quinzenas, count(*) filter (where kind = 'mes') meses
  from public.sales_import_jobs;
commit;
