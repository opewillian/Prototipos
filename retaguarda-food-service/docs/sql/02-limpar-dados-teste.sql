-- Retaguarda MFT · remove TODOS os registros operacionais da loja 'teste' e os cadastros [TESTE]
-- (itens TST-*, fornecedor TST-F1). Documentos finalizados são travados por gatilhos, por isso
-- este script desliga os gatilhos apenas dentro da transação (session_replication_role = replica).
-- Não afeta nenhuma outra loja. Conferir as contagens do SELECT final antes do COMMIT.
begin;
set local session_replication_role = replica;
delete from public.cmv_closing_items where closing_id in (select id from public.cmv_closings where store_id = 'teste');
delete from public.cmv_closings where store_id = 'teste';
delete from public.stock_movements where store_id = 'teste';
delete from public.payment_attachments where store_id = 'teste';
delete from public.invoice_attachments where store_id = 'teste';
delete from public.invoice_payments where store_id = 'teste';
delete from public.invoice_items where store_id = 'teste';
delete from public.invoices where store_id = 'teste';
delete from public.purchase_order_items where store_id = 'teste';
delete from public.purchase_orders where store_id = 'teste';
delete from public.loss_items where store_id = 'teste';
delete from public.losses where store_id = 'teste';
delete from public.transfer_items where from_store_id = 'teste' or to_store_id = 'teste';
delete from public.transfers where from_store_id = 'teste' or to_store_id = 'teste';
delete from public.stock_count_items where store_id = 'teste';
delete from public.stock_counts where store_id = 'teste';
delete from public.purchase_list_items where store_id = 'teste';
delete from public.purchase_lists where store_id = 'teste';
delete from public.store_item_suppliers where item_id in (select id from public.items where code like 'TST-%')
   or supplier_id in (select id from public.suppliers where code = 'TST-F1');
delete from public.items where code like 'TST-%';
delete from public.suppliers where code = 'TST-F1';
select (select count(*) from public.stock_counts where store_id='teste') as contagens,
       (select count(*) from public.invoices where store_id='teste') as notas,
       (select count(*) from public.items where code like 'TST-%') as itens_teste;
commit;
