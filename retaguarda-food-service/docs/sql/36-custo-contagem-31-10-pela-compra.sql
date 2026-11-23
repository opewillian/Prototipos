-- 36: Regra do usuário (23/11/2026) para o custo das contagens: usar o custo da planilha de inventário SOMENTE quando o item
-- não tem compra lançada; havendo compra recebida na loja até a data da contagem, o custo é o da ÚLTIMA compra
-- (custo da linha da nota, já com rateio; várias linhas do mesmo item na mesma nota = média ponderada).
-- Aplicado à CT-0002 (31/10/2026, rascunho). A CT-0001 (30/09) está finalizada e set/26 é mês fechado: não é alterada aqui.
begin;
create temp table _lp on commit drop as
select distinct on (item_id) item_id, entry_date, invoice_number, cost from (
  select ii.item_id, i.id, i.entry_date, i.received_at, i.invoice_number,
         sum(ii.line_total) / nullif(sum(ii.quantity), 0) as cost
  from public.invoice_items ii join public.invoices i on i.id = ii.invoice_id
  where i.store_id = 'teste' and i.status = 'received' and i.entry_date <= '2026-10-31'
  group by ii.item_id, i.id, i.entry_date, i.received_at, i.invoice_number
) x where cost is not null
order by item_id, entry_date desc, received_at desc;

create temp table _chg on commit drop as
select ci.id, it.code, it.name, ci.counted_quantity q, ci.unit_cost old_cost, round(lp.cost, 4) new_cost,
       ci.line_total old_total, round(ci.counted_quantity * round(lp.cost, 4), 2) new_total, lp.invoice_number, lp.entry_date
from public.stock_count_items ci
join public.stock_counts c on c.id = ci.count_id
join _lp lp on lp.item_id = ci.item_id
join public.items it on it.id = ci.item_id
where c.id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca' and c.status = 'draft'
  and abs(ci.unit_cost - round(lp.cost, 4)) >= 0.0001;

update public.stock_count_items ci set unit_cost = ch.new_cost, line_total = ch.new_total
from _chg ch where ci.id = ch.id;

select (select count(*) from _chg) linhas_alteradas,
       (select round(sum(old_total),2) from _chg) valor_antes, (select round(sum(new_total),2) from _chg) valor_depois,
       (select round(sum(line_total),2) from public.stock_count_items where count_id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca') total_ct0002,
       (select string_agg(code||' '||name||': '||q||' x '||old_cost||' -> '||new_cost||' (nota '||invoice_number||' '||entry_date||') '||old_total||' -> '||new_total, ' ## ' order by abs(new_total-old_total) desc) from _chg) detalhe;
commit;
