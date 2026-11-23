-- 35: Importação automática diária das vendas do Degust (pg_cron + pg_net chamando a função "degust", ação "diario").
-- Roda todo dia às 06:00 de Brasília (09:00 UTC) e reimporta, para cada loja com degust_code, os 3 dias anteriores
-- (pega vendas canceladas depois). A chamada se identifica pela chave em integration_tokens (provider 'cron'),
-- que só o banco e a função enxergam. A função "degust" está com "Verify JWT" desligado e faz a própria checagem.
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.integration_tokens (provider, token, expires_at)
values ('cron', encode(extensions.gen_random_bytes(32), 'hex'), '2100-01-01')
on conflict (provider) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'degust-vendas-diario';
select cron.schedule('degust-vendas-diario', '0 9 * * *', $job$
  select net.http_post(
    url := 'https://nngcbrqemhnbyqjjdnlh.supabase.co/functions/v1/degust',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-key', (select token from public.integration_tokens where provider = 'cron')),
    body := '{"acao":"diario"}'::jsonb,
    timeout_milliseconds := 140000
  );
$job$);

select jobid, jobname, schedule, active from cron.job where jobname = 'degust-vendas-diario';
