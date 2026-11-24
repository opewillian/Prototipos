-- 50: Taxa de oportunidade (pedido do usuário em 24/11/2026, começando por Congonhas).
-- Taxa = faturamento (R$) ÷ passageiros da área da loja no mês; na dica: passageiros, cupons e cupons por mil passageiros.
-- Passageiros: ANAC, "Dados Estatísticos do Transporte Aéreo" (Dados_Estatisticos.csv, atualizado em 23/11/2026),
--   PASSAGEIROS_PAGOS por mês: origem = aeroporto → embarcados; destino = aeroporto → desembarcados; NATUREZA doméstica/internacional.
--   https://sistemas.anac.gov.br/dadosabertos/Voos e operações aéreas/Dados Estatísticos do Transporte Aéreo/
-- Área da loja define quem conta (regra combinada com o usuário):
--   checkin, praca_land, praca_air → embarcados (dom+int) | publica → embarcados + desembarcados | emb_dom → embarcados domésticos
--   emb_int → embarcados internacionais | desembarque → desembarcados (dom+int) | des_int → desembarcados internacionais | fora → não calcula
begin;
alter table public.stores add column if not exists airport_iata text;
alter table public.stores add column if not exists airport_area text;
alter table public.stores drop constraint if exists stores_airport_area_check;
alter table public.stores add constraint stores_airport_area_check check (airport_area is null or airport_area in
  ('checkin','publica','emb_dom','emb_int','desembarque','des_int','praca_land','praca_air','fora'));
comment on column public.stores.airport_iata is 'Sigla IATA do aeroporto da loja (ex.: CGH).';
comment on column public.stores.airport_area is 'Área da loja no aeroporto: define os passageiros da taxa de oportunidade.';

create table if not exists public.airport_passengers (
  iata text not null,
  month date not null,               -- 1º dia do mês
  emb_dom integer not null default 0,
  emb_int integer not null default 0,
  des_dom integer not null default 0,
  des_int integer not null default 0,
  source text not null default 'ANAC - Dados Estatísticos do Transporte Aéreo',
  updated_at timestamptz not null default now(),
  primary key (iata, month)
);
alter table public.airport_passengers enable row level security;
drop policy if exists airport_passengers_read on public.airport_passengers;
create policy airport_passengers_read on public.airport_passengers for select to authenticated using (true);   -- dado público
grant select on public.airport_passengers to authenticated;

-- Congonhas (ANAC usa SBSP): só voos domésticos.
insert into public.airport_passengers (iata, month, emb_dom, des_dom) values
  ('CGH','2025-01-01',959518,1052645),('CGH','2025-02-01',890077,885251),('CGH','2025-03-01',934731,992716),
  ('CGH','2025-04-01',945340,953153),('CGH','2025-05-01',960173,981108),('CGH','2025-06-01',993053,966113),
  ('CGH','2025-07-01',1032455,1058603),('CGH','2025-08-01',1014103,1028960),('CGH','2025-09-01',982342,1001708),
  ('CGH','2025-10-01',1069284,1068903),('CGH','2025-11-01',1061251,1060940),('CGH','2025-12-01',1123108,1032242),
  ('CGH','2026-01-01',1035831,1119846),('CGH','2026-02-01',920281,952218),('CGH','2026-03-01',1014417,1021181),
  ('CGH','2026-04-01',975116,995688),('CGH','2026-05-01',1002530,1009529),('CGH','2026-06-01',973945,945903),
  ('CGH','2026-07-01',1058153,1079195),('CGH','2026-08-01',1048759,1065923),('CGH','2026-09-01',988900,999657),
  ('CGH','2026-10-01',1010969,1034836)
on conflict (iata, month) do update set emb_dom = excluded.emb_dom, emb_int = excluded.emb_int, des_dom = excluded.des_dom,
  des_int = excluded.des_int, updated_at = now();

update public.stores set airport_iata = 'CGH', airport_area = 'publica' where id = 'teste';   -- DEL-CGH-PUB, área pública

select (select count(*) from public.airport_passengers) meses, (select airport_iata || ' / ' || airport_area from public.stores where id = 'teste') cgh;
commit;
