-- Retaguarda MFT · apaga as transferências em RASCUNHO (testes TR-0001 a TR-0006, CGH → DEL-VCP-C15). Pedido do Willian em 20/11/2026.
-- Rascunho não mexe em estoque; transferências emitidas ou canceladas não são tocadas.
-- Sem reversão (exclusão definitiva de rascunhos de teste).
begin;
delete from public.transfer_items i using public.transfers t where i.transfer_id = t.id and t.status = 'draft';
delete from public.transfers where status = 'draft';
select (select count(*) from public.transfers where status='draft') rascunhos_restantes,
       (select count(*) from public.transfers) transferencias_total;
commit;
