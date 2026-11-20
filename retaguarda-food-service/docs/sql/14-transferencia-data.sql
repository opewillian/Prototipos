-- Retaguarda MFT · data da transferência (escolhida na própria tela da transferência). Pedido do Willian em 20/11/2026.
-- Só acrescenta a coluna; transferências existentes recebem a data em que foram criadas.
-- Reversão: alter table public.transfers drop column if exists transfer_date;
begin;
alter table public.transfers add column if not exists transfer_date date;
update public.transfers set transfer_date = (created_at at time zone 'America/Sao_Paulo')::date where transfer_date is null;
alter table public.transfers alter column transfer_date set default (now() at time zone 'America/Sao_Paulo')::date;
alter table public.transfers alter column transfer_date set not null;
select count(*) transferencias, count(transfer_date) com_data from public.transfers;
commit;
