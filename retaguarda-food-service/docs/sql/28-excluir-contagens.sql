-- 28: Exclui TODAS as contagens da Retaguarda (pedido do usuário em 23/11/2026, antes de lançar as contagens de 30/09 e 31/10 da CGH).
-- Havia 6: CT-0001, CT-0003, CT-0004, CT-0005 (rascunhos vazios, loja 'teste' = DEL-CGH-PUB), CT-0001 da del-vcp-c15 (rascunho vazio)
-- e CT-0002 da CGH (finalizada em 20/11, 5 itens, 5 movimentos count_adjustment).
-- A contagem finalizada e seus itens são travados por gatilho: os gatilhos ficam desligados só dentro desta transação.
-- Os movimentos de ajuste da CT-0002 também são apagados (o saldo volta ao que era antes dela).
begin;
set local session_replication_role = replica;
delete from public.stock_movements where source_type = 'count' and source_id in (select id from public.stock_counts);
delete from public.stock_count_items where count_id in (select id from public.stock_counts);
delete from public.stock_counts;
set local session_replication_role = origin;
select (select count(*) from public.stock_counts) contagens,
       (select count(*) from public.stock_count_items) itens,
       (select count(*) from public.stock_movements where source_type='count') movimentos_de_contagem;
commit;
