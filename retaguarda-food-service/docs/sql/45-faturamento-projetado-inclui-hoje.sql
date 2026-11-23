-- 45: A projeção passa a começar HOJE (não amanhã), 23/11/2026.
-- Motivo: as vendas do dia só são importadas na manhã seguinte (06:00). Começando amanhã, o dia de hoje ficava sem venda
-- e sem projeção: buraco no gráfico da tela Início e projeção do mês sem o dia de hoje.
-- Dias passados ficam na tabela (dá para comparar projetado x realizado depois). Mantém a regra do último dia do mês: aí projeta hoje + o mês seguinte inteiro.
begin;
create or replace function public.refresh_sales_forecast_daily()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_end   date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
begin
  if v_today = v_end then
    return public.refresh_sales_forecast(v_today, (date_trunc('month', v_today + 1) + interval '1 month - 1 day')::date);
  end if;
  return public.refresh_sales_forecast(v_today, v_end);
end $$;
revoke all on function public.refresh_sales_forecast_daily() from public, anon, authenticated;
select public.refresh_sales_forecast_daily() linhas, sum(projected_net) filter (where business_date>=(now() at time zone 'America/Sao_Paulo')::date) total, min(business_date) filter (where business_date>=(now() at time zone 'America/Sao_Paulo')::date) de, max(business_date) ate from public.sales_forecast;
commit;
