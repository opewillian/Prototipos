-- 49: Importação das vendas das lojas SAL (franquia 2168), ACB (2642) e BIT (2202) — pedido do usuário em 24/11/2026
--     ("vamos configurar as outras franquias ... sal 2168, acb 2642, bit 2202 — vamos fazer estes por enquanto"),
--     com a mesma regra das DEL: venda detalhada de 01/10/2026 em diante, resumo antes (DETALHE_DESDE na função).
-- Ligação: CNPJ e valor de 20/11/2026 igual ao Everest (Resumo Financeiro PDV). Duplicadas do cadastro: a que bate o Everest
--   (BIT-CWB-DOM-82, BIT-NAT-CHE-83, ACB-PMW-CHE-1145; BIT-BSB-NOR-101 pelo CNPJ). ACB-REC-DOM soma os pontos 12 e 14 (mesmo CNPJ).
-- Ficaram fora (sem nenhuma venda no Degust): nenhuma.
begin;
-- Códigos de loja repetem entre franquias: a unicidade passa a ser franquia + código (vazio = franquia padrão DEL).
alter table public.stores drop constraint if exists stores_degust_code_key;
drop index if exists public.stores_degust_code_key;
create unique index if not exists stores_degust_franq_code_key on public.stores (coalesce(degust_franqueador, 0), degust_code) where degust_code is not null;
create temp table _fr (id text, franq int, code int, codes int[], de date, ate date) on commit drop;
insert into _fr values
  ('sal-gig-pia', 2168, 5, array[5]::int[], date '2022-09-01', date '2026-11-23'),
  ('sal-gru-des', 2168, 8, array[8]::int[], date '2023-01-19', date '2026-11-23'),
  ('sal-gig-pib', 2168, 9, array[9]::int[], date '2023-09-12', date '2026-11-23'),
  ('sal-gig-pra', 2168, 10, array[10]::int[], date '2023-05-08', date '2026-11-23'),
  ('sal-mcz-pra', 2168, 11, array[11]::int[], date '2023-08-01', date '2026-11-23'),
  ('sal-mcz-des', 2168, 12, array[12]::int[], date '2023-08-01', date '2026-11-23'),
  ('sal-jdo-che', 2168, 13, array[13]::int[], date '2023-09-11', date '2026-11-23'),
  ('sal-aju-dom', 2168, 14, array[14]::int[], date '2023-09-01', date '2026-11-23'),
  ('sal-aju-che', 2168, 15, array[15]::int[], date '2024-03-01', date '2026-11-23'),
  ('sal-jpa-dom', 2168, 16, array[16]::int[], date '2024-01-16', date '2026-11-23'),
  ('sal-jpa-pra', 2168, 17, array[17]::int[], date '2024-01-29', date '2026-11-23'),
  ('sal-pnz-che-1018', 2168, 18, array[18]::int[], date '2024-05-30', date '2026-11-23'),
  ('sal-jpa-ext', 2168, 19, array[19]::int[], date '2025-05-23', date '2026-11-23'),
  ('bit-vcp-p05', 2202, 1, array[1]::int[], date '2021-11-14', date '2026-11-23'),
  ('bit-bsb-nor-101', 2202, 3, array[3]::int[], date '2023-01-15', date '2026-11-23'),
  ('bit-cwb-dom-82', 2202, 4, array[4]::int[], date '2023-04-07', date '2026-11-23'),
  ('bit-nat-che-83', 2202, 5, array[5]::int[], date '2023-05-21', date '2026-11-23'),
  ('bit-jpa-pra', 2202, 7, array[7]::int[], date '2023-11-20', date '2026-11-23'),
  ('bit-rec-pra', 2202, 10, array[10]::int[], date '2023-11-28', date '2026-11-23'),
  ('bit-aju-dom', 2202, 11, array[11]::int[], date '2024-03-22', date '2026-11-23'),
  ('acb-nat-che-62', 2642, 1, array[1]::int[], date '2022-09-07', date '2026-11-23'),
  ('acb-pmw-che-1145', 2642, 2, array[2]::int[], date '2023-06-16', date '2026-11-23'),
  ('acb-slz-des-122', 2642, 3, array[3]::int[], date '2023-06-30', date '2026-11-23'),
  ('acb-fln-pra', 2642, 6, array[6]::int[], date '2023-09-28', date '2026-11-23'),
  ('acb-jdo-che', 2642, 7, array[7]::int[], date '2023-12-18', date '2026-11-23'),
  ('acb-jpa-pra', 2642, 8, array[8]::int[], date '2023-11-20', date '2026-11-23'),
  ('acb-mcz-pra', 2642, 9, array[9]::int[], date '2023-11-10', date '2026-11-23'),
  ('acb-aju-des', 2642, 10, array[10]::int[], date '2023-12-12', date '2026-11-23'),
  ('acb-rec-pra', 2642, 11, array[11]::int[], date '2023-11-24', date '2026-11-23'),
  ('acb-rec-dom', 2642, null, array[12,14]::int[], date '2021-11-01', date '2026-11-23'),
  ('acb-pnz-che-120', 2642, 13, array[13]::int[], date '2024-05-31', date '2026-11-23'),
  ('acb-for-pra', 2642, 15, array[15]::int[], date '2024-06-23', date '2026-11-23'),
  ('acb-bsb-pra', 2642, 19, array[19]::int[], date '2025-12-17', date '2026-11-23');
update public.stores s set degust_franqueador = d.franq, degust_code = coalesce(d.code, d.codes[1]),
       degust_codes = case when cardinality(d.codes) > 1 then d.codes else null end
  from _fr d where s.id = d.id;
insert into public.sales_import_jobs (store_id, kind, de, ate, priority)
select d.id, 'dias', greatest(q.ini, d.de), least(q.fim, d.ate), 1
  from _fr d
  cross join lateral (
    select m::date + h.o as ini,
           case when h.o = 0 then m::date + 14 else (m + interval '1 month - 1 day')::date end as fim
      from generate_series(date_trunc('month', d.de), date_trunc('month', d.ate), interval '1 month') m
      cross join (values (0), (15)) h(o)
  ) q
 where q.fim >= d.de and q.ini <= d.ate;
insert into public.sales_import_jobs (store_id, kind, de, ate, priority)
select d.id, 'mes', m::date, m::date, 2
  from _fr d cross join generate_series(date_trunc('month', d.de), date_trunc('month', d.ate), interval '1 month') m;
select (select count(*) from public.stores where degust_franqueador is not null) lojas_outras_franquias,
       (select count(*) from public.sales_import_jobs j join _fr d on d.id = j.store_id where j.kind = 'dias') quinzenas_novas,
       (select count(*) from public.sales_import_jobs where status = 'pending') pendentes_total;
commit;
