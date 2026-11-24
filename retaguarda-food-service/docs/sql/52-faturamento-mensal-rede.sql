-- 52: Faturamento mês a mês (24/11/2026), para o gráfico da rede no Painel da Matriz.
-- Soma public.sales_imports por mês, só lojas operacionais. SECURITY INVOKER: o RLS de sales_imports vale
-- (cada pessoa soma só as lojas cujo faturamento pode ver).
begin;
create or replace function public.sales_by_month(p_from date, p_to date)
returns table (month date, net numeric, days integer, stores integer)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', i.business_date)::date, sum(i.net), count(distinct i.business_date)::int, count(distinct i.store_id)::int
  from public.sales_imports i
  join public.stores s on s.id = i.store_id and s.store_type = 'operational'
  where i.business_date between p_from and p_to
  group by 1 order by 1;
$$;
revoke all on function public.sales_by_month(date, date) from public, anon;
grant execute on function public.sales_by_month(date, date) to authenticated;
select * from public.sales_by_month('2025-01-01', '2026-11-23');
commit;
