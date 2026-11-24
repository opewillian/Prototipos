-- 53: sales_by_month passa a trazer também os cupons (soma de sales_imports.sales), 24/11/2026.
-- Pedido: no gráfico mês a mês do Painel da Matriz, trocar entre Faturamento e Cupons, com comparativo do ano anterior.
-- Mudou o retorno da função: precisa apagar e criar de novo.
begin;
drop function if exists public.sales_by_month(date, date);
create function public.sales_by_month(p_from date, p_to date)
returns table (month date, net numeric, cupons bigint, days integer, stores integer)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', i.business_date)::date, sum(i.net), sum(i.sales)::bigint,
         count(distinct i.business_date)::int, count(distinct i.store_id)::int
  from public.sales_imports i
  join public.stores s on s.id = i.store_id and s.store_type = 'operational'
  where i.business_date between p_from and p_to
  group by 1 order by 1;
$$;
revoke all on function public.sales_by_month(date, date) from public, anon;
grant execute on function public.sales_by_month(date, date) to authenticated;
select * from public.sales_by_month('2025-09-01', '2026-11-23');
commit;
