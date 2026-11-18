-- Retaguarda MFT · ativa o armazenamento de anexos de notas e pagamentos.
-- Executar UMA vez no SQL Editor do Supabase (projeto nngcbrqemhnbyqjjdnlh).
-- Caminho dos arquivos: <store_id>/<invoice_id>/<arquivo>. Acesso restrito a quem tem vínculo ativo
-- com a loja da pasta, ou ao administrador da Matriz.
-- Reversão: drop das 3 policies abaixo e delete from storage.buckets where id='retaguarda-anexos' (após esvaziar).
begin;
insert into storage.buckets (id, name, public, file_size_limit)
values ('retaguarda-anexos', 'retaguarda-anexos', false, 15728640)
on conflict (id) do nothing;

create policy "retaguarda_anexos_ler" on storage.objects for select to authenticated
using (bucket_id = 'retaguarda-anexos' and exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.active
    and (m.store_id = (storage.foldername(name))[1] or (m.store_id = 'matriz' and m.role = 'matrix_admin'))));

create policy "retaguarda_anexos_enviar" on storage.objects for insert to authenticated
with check (bucket_id = 'retaguarda-anexos' and exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.active
    and (m.store_id = (storage.foldername(name))[1] or (m.store_id = 'matriz' and m.role = 'matrix_admin'))));

create policy "retaguarda_anexos_excluir" on storage.objects for delete to authenticated
using (bucket_id = 'retaguarda-anexos' and exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.active
    and (m.store_id = (storage.foldername(name))[1] or (m.store_id = 'matriz' and m.role = 'matrix_admin'))));
commit;
