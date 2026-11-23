-- 43: Faturamento projetado (23/11/2026). Projeção dia a dia, loja por loja, de amanhã até o fim do mês.
-- Base: public.sales_imports (líquido por dia e loja, gravado a cada importação do Degust). Dias com líquido 0 (loja fechada
-- ou sem venda) ficam fora das médias.
-- Critérios (pedido do usuário: "a média de vendas e a média histórica daquele dia"):
--   1) media_recente  = média do MESMO DIA DA SEMANA nas últimas 8 semanas (até ontem).
--   2) media_historica = média do mesmo dia da semana no ano anterior (D-364, mais a semana antes e a depois: D-371 e D-357),
--                        corrigida pelo crescimento: soma das últimas 8 semanas ÷ soma das mesmas 8 semanas do ano anterior
--                        (só dias com venda nos dois anos).
--   projetado = média simples dos dois critérios; se faltar um, vale o outro.
-- Recalcular: select public.refresh_sales_forecast();  (refaz de amanhã até o fim do mês; dias passados não são mexidos)
begin;

create table if not exists public.sales_forecast (
  store_id        text not null references public.stores(id) on delete cascade,
  business_date   date not null,
  projected_net   numeric(14,2) not null,
  recent_avg      numeric(14,2),
  recent_days     integer not null default 0,
  history_avg     numeric(14,2),
  history_days    integer not null default 0,
  growth_factor   numeric(8,4),
  method          text not null default 'media_dia_semana_8s + historico_ano_anterior_ajustado',
  generated_at    timestamptz not null default now(),
  primary key (store_id, business_date)
);
comment on table public.sales_forecast is 'Faturamento projetado (líquido) por loja e dia. Gerado por public.refresh_sales_forecast().';

alter table public.sales_forecast enable row level security;
drop policy if exists sales_forecast_select on public.sales_forecast;
create policy sales_forecast_select on public.sales_forecast for select to authenticated
  using (public.can_view_sales(store_id));
revoke all on public.sales_forecast from anon;
grant select on public.sales_forecast to authenticated;

create or replace function public.refresh_sales_forecast(p_from date default (now() at time zone 'America/Sao_Paulo')::date + 1,
                                                         p_to   date default (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month - 1 day')::date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rows integer;
begin
  delete from public.sales_forecast where business_date between p_from and p_to;
  with lojas as (
    select distinct store_id from public.sales_imports
  ), base as (                         -- dias com venda
    select store_id, business_date d, net from public.sales_imports where net > 0
  ), cresc as (                        -- crescimento: últimas 8 semanas x mesmas semanas do ano anterior (dias com venda nos dois)
    select a.store_id, sum(a.net) / nullif(sum(b.net), 0) f
    from base a join base b on b.store_id = a.store_id and b.d = a.d - 364
    where a.d between v_today - 56 and v_today - 1
    group by a.store_id
  ), dias as (
    select l.store_id, g::date d from lojas l cross join generate_series(p_from, p_to, interval '1 day') g
  ), calc as (
    select x.store_id, x.d,
      (select avg(net) from base b where b.store_id = x.store_id and b.d between v_today - 56 and v_today - 1
         and extract(isodow from b.d) = extract(isodow from x.d)) rec,
      (select count(*) from base b where b.store_id = x.store_id and b.d between v_today - 56 and v_today - 1
         and extract(isodow from b.d) = extract(isodow from x.d)) rec_n,
      (select avg(net) from base b where b.store_id = x.store_id and b.d in (x.d - 371, x.d - 364, x.d - 357)) hist,
      (select count(*) from base b where b.store_id = x.store_id and b.d in (x.d - 371, x.d - 364, x.d - 357)) hist_n,
      c.f
    from dias x left join cresc c on c.store_id = x.store_id
  )
  insert into public.sales_forecast (store_id, business_date, projected_net, recent_avg, recent_days, history_avg, history_days, growth_factor, generated_at)
  select store_id, d,
         round(case when rec is not null and hist is not null and f is not null then (rec + hist * f) / 2
                    when rec is not null then rec
                    else hist * coalesce(f, 1) end, 2),
         round(rec, 2), rec_n, round(hist * coalesce(f, 1), 2), hist_n, round(f, 4), now()
  from calc
  where rec is not null or hist is not null;
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke all on function public.refresh_sales_forecast(date, date) from public, anon, authenticated;

select public.refresh_sales_forecast() linhas_geradas;
select f.store_id, s.name, to_char(f.business_date, 'DD/MM Dy') dia, f.projected_net projetado, f.recent_avg media_recente, f.recent_days,
       f.history_avg historico_ajustado, f.history_days, f.growth_factor crescimento
from public.sales_forecast f join public.stores s on s.id = f.store_id order by 1, f.business_date;
commit;
