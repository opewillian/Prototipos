-- 21: Outros custos da nota fiscal (desconto, frete, seguro, outras despesas, IPI, ICMS ST, outros).
-- amount é sempre positivo; o tipo define o sinal: discount e other_sub abatem, os demais somam.
-- Total da nota = soma dos itens + outros custos (com sinal). Na nota vinda de NF-e, os outros custos são rateados
-- proporcionalmente no valor dos itens (invoice_items.line_total/unit_cost), para o custo do estoque já sair certo.
-- Só cria a tabela; nada é apagado. RLS igual a invoice_items (aba Notas).
-- Reversão: drop table if exists public.invoice_other_costs;
begin;
create table if not exists public.invoice_other_costs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  store_id text not null,
  kind text not null check (kind in ('discount','freight','insurance','expenses','ipi','st','other_add','other_sub')),
  description text,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, store_id) references public.invoices(id, store_id) on delete cascade
);
create index if not exists invoice_other_costs_invoice_idx on public.invoice_other_costs (invoice_id);
alter table public.invoice_other_costs enable row level security;
drop policy if exists invoice_other_costs_read on public.invoice_other_costs;
create policy invoice_other_costs_read on public.invoice_other_costs for select to authenticated
  using (mft_private.has_tab_access(store_id,'notes',false) or mft_private.has_tab_access(store_id,'cmv',false));
drop policy if exists invoice_other_costs_write on public.invoice_other_costs;
create policy invoice_other_costs_write on public.invoice_other_costs for all to authenticated
  using (mft_private.has_tab_access(store_id,'notes',true)) with check (mft_private.has_tab_access(store_id,'notes',true));
grant select, insert, update, delete on public.invoice_other_costs to authenticated;
select (select relrowsecurity from pg_class where oid='public.invoice_other_costs'::regclass) rls,
       (select string_agg(policyname, ',') from pg_policies where schemaname='public' and tablename='invoice_other_costs') politicas;
commit;
