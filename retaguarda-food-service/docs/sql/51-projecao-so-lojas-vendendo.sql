-- 51: Projeção só para lojas vendendo (24/11/2026). Pedido: painel da matriz com os dias que faltam projetados.
-- Antes, toda loja que já teve venda entrava (o histórico do ano anterior projetava venda para loja fechada: 11 lojas).
-- Agora: só lojas com venda nos últimos 14 dias. Refaz a projeção de hoje até o fim do mês (base completa após a importação).
begin;
create or replace function public.refresh_sales_forecast(p_from date default (now() at time zone 'America/Sao_Paulo')::date + 1,
                                                         p_to   date default (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month - 1 day')::date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rows integer;
begin
  delete from public.sales_forecast where business_date between p_from and p_to;
  with lojas as (
    select distinct store_id from public.sales_imports      -- só lojas que venderam nos últimos 14 dias (loja fechada não projeta)
     where net > 0 and business_date between v_today - 14 and v_today - 1
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
-- tira as projeções futuras das lojas paradas e refaz
delete from public.sales_forecast where business_date >= (now() at time zone 'America/Sao_Paulo')::date;
select public.refresh_sales_forecast_daily() linhas,
  (select count(distinct store_id) from public.sales_forecast where business_date >= (now() at time zone 'America/Sao_Paulo')::date) lojas,
  (select round(sum(projected_net)) from public.sales_forecast where business_date >= (now() at time zone 'America/Sao_Paulo')::date) total;
commit;
