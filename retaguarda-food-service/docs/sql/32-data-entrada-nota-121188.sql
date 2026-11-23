-- 32: Data de entrada da nota 121188 (Eurobrasil, R$ 7.671,11) = 28/10/2026, pela planilha de entregas de out/26 da CGH (pedido do usuário em 23/11/2026).
-- Na planilha o número está como 121.138; o valor confirma que é a 121188. As outras 29 notas da planilha já estavam com a data certa.
update public.invoices set entry_date = '2026-10-28', updated_at = now()
 where store_id = 'teste' and invoice_number = '121188' and total_amount = 7671.11 and status = 'pending';
select invoice_number, issue_date, entry_date, status, total_amount from public.invoices where store_id = 'teste' and invoice_number = '121188';
