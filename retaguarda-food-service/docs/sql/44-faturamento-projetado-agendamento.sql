-- 44: Recalcula o faturamento projetado todo dia às 06:30 (Brasília) = 09:30 UTC,
-- meia hora depois da importação diária das vendas ('degust-vendas-diario', 06:00). Pedido do usuário em 23/11/2026.
-- Refaz de amanhã até o fim do mês. No último dia do mês, "amanhã" já é o mês seguinte e o período fica vazio:
-- nesse caso projeta o mês seguinte inteiro.
begin;
create or replace function public.refresh_sales_forecast_daily()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_end   date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
begin
  if v_today = v_end then
    return public.refresh_sales_forecast(v_today + 1, (date_trunc('month', v_today + 1) + interval '1 month - 1 day')::date);
  end if;
  return public.refresh_sales_forecast(v_today + 1, v_end);
end $$;
revoke all on function public.refresh_sales_forecast_daily() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'faturamento-projetado-diario';
select cron.schedule('faturamento-projetado-diario', '30 9 * * *', $$select public.refresh_sales_forecast_daily()$$);

select jobname, schedule, command, active from cron.job order by jobname;
commit;
