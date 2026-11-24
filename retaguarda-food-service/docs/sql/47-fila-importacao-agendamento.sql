-- 47: Liga o processamento da fila de importação de vendas (public.sales_import_jobs, script 46).
-- 3 agendamentos a cada minuto, cada um chama a função "degust" com a ação "fila" (≈110 s de trabalho):
-- até ~6 execuções ao mesmo tempo; o claim_sales_import_job() garante que nenhum trabalho é pego duas vezes.
-- Usa o mesmo comando do agendamento diário (apikey publicável + x-cron-key), trocando a ação "diario" por "fila".
-- Quando a fila esvaziar, desligar:  select cron.unschedule(jobname) from cron.job where jobname like 'degust-fila%';
begin;
select cron.unschedule(jobname) from cron.job where jobname like 'degust-fila%';
select cron.schedule('degust-fila-' || i, '* * * * *', replace(c.command, '"diario"', '"fila"'))
  from (select command from cron.job where jobname = 'degust-vendas-diario') c, generate_series(1, 3) i;
select jobname, schedule, active, position('"fila"' in command) > 0 usa_fila from cron.job order by jobname;
commit;
