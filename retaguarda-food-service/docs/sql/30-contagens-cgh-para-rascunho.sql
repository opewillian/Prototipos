-- 30: Volta as contagens CT-0001 (30/09) e CT-0002 (31/10) da CGH para RASCUNHO (pedido do usuário em 23/11/2026).
-- Contagem finalizada não reabre pela regra do banco: os gatilhos ficam desligados só nesta transação.
-- Os ajustes de estoque gerados por elas são apagados (o saldo da CGH volta a ter só os movimentos de notas/transferências).
-- Quando forem finalizadas de novo pelo app, o ajuste será calculado contra o saldo do momento da finalização.
begin;
set local session_replication_role = replica;
delete from public.stock_movements where source_type = 'count'
  and source_id in ('de036d15-18e2-4c8e-af24-e2ca46007d25','df8a0795-4f63-41f5-b5b9-2cfa799fd2ca');
update public.stock_counts set status = 'draft', finalized_at = null, finalized_by = null, updated_at = now()
 where id in ('de036d15-18e2-4c8e-af24-e2ca46007d25','df8a0795-4f63-41f5-b5b9-2cfa799fd2ca');
set local session_replication_role = origin;
select display_id, count_date, status,
       (select count(*) from public.stock_count_items i where i.count_id = c.id) itens,
       (select round(sum(line_total),2) from public.stock_count_items i where i.count_id = c.id) valor,
       (select count(*) from public.stock_movements m where m.source_id = c.id) movimentos
from public.stock_counts c order by count_date;
commit;
