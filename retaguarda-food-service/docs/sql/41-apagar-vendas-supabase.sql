-- 41: Vendas ficam SÓ no Cloudflare R2 (decisão e confirmação do usuário em 23/11/2026: "Publicar e apagar").
-- Antes de apagar foi conferido que o R2 tem os mesmos números (out/26, 10/10–05/11, 01/08–22/11).
-- Apaga as tabelas de vendas do Supabase e as funções de resumo antigas. Fica só public.sales_imports (registro dos dias).
begin;
drop function if exists public.sales_by_day(text, date, date);
drop function if exists public.sales_by_product(text, date, date);
drop function if exists public.sales_by_payment(text, date, date);
drop table if exists public.sale_items;
drop table if exists public.sale_payments;
drop table if exists public.sales;
select pg_size_pretty(pg_database_size(current_database())) banco,
       (select count(*) from public.sales_imports) dias_registrados,
       (select count(*) from information_schema.tables where table_schema='public' and table_name in ('sales','sale_items','sale_payments')) tabelas_restantes;
commit;
