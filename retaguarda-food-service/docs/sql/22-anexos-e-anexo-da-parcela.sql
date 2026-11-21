-- 22: Ativa o armazenamento de anexos (substitui o 01, que nunca foi executado) e permite anexo por PARCELA.
-- Arquivos ficam no bucket privado 'retaguarda-anexos', caminho <store_id>/<invoice_id>/...  (parcela: <store_id>/<invoice_id>/parcela-<payment_id>/...).
-- Acesso ao arquivo = mesma regra da aba Notas da loja da pasta (ler: notes ou cmv; enviar/excluir: notes com edição). Admin da Matriz passa pela própria has_tab_access.
-- invoice_attachments.payment_id: anexo da parcela (boleto, comprovante...). doc_type: boleto | comprovante | nota | xml | outro.
-- Nada é apagado. Reversão: drop das 3 policies 'retaguarda_anexos_*'; alter table public.invoice_attachments drop column if exists payment_id, drop column if exists doc_type;
--           delete from storage.buckets where id='retaguarda-anexos' (só depois de esvaziar).
begin;
insert into storage.buckets (id, name, public, file_size_limit)
values ('retaguarda-anexos', 'retaguarda-anexos', false, 15728640)
on conflict (id) do nothing;

drop policy if exists retaguarda_anexos_ler on storage.objects;
create policy retaguarda_anexos_ler on storage.objects for select to authenticated
using (bucket_id = 'retaguarda-anexos' and (
  mft_private.has_tab_access((storage.foldername(name))[1], 'notes', false) or mft_private.has_tab_access((storage.foldername(name))[1], 'cmv', false)));

drop policy if exists retaguarda_anexos_enviar on storage.objects;
create policy retaguarda_anexos_enviar on storage.objects for insert to authenticated
with check (bucket_id = 'retaguarda-anexos' and mft_private.has_tab_access((storage.foldername(name))[1], 'notes', true));

drop policy if exists retaguarda_anexos_excluir on storage.objects;
create policy retaguarda_anexos_excluir on storage.objects for delete to authenticated
using (bucket_id = 'retaguarda-anexos' and mft_private.has_tab_access((storage.foldername(name))[1], 'notes', true));

alter table public.invoice_attachments add column if not exists payment_id uuid references public.invoice_payments(id) on delete cascade;
alter table public.invoice_attachments add column if not exists doc_type text;
alter table public.invoice_attachments drop constraint if exists invoice_attachments_doc_type_check;
alter table public.invoice_attachments add constraint invoice_attachments_doc_type_check check (doc_type is null or doc_type in ('boleto','comprovante','nota','xml','outro'));
create index if not exists invoice_attachments_payment_idx on public.invoice_attachments (payment_id);

select (select count(*) from storage.buckets where id='retaguarda-anexos') bucket,
       (select string_agg(policyname, ',') from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'retaguarda_anexos%') politicas,
       (select count(*) from information_schema.columns where table_schema='public' and table_name='invoice_attachments' and column_name in ('payment_id','doc_type')) colunas;
commit;
