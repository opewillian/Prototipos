-- Retaguarda MFT · renomeia a loja de homologação "Teste" para Congonhas (CGH).
-- Executar no SQL Editor do Supabase (projeto nngcbrqemhnbyqjjdnlh), com usuário administrador.
-- O identificador interno continua 'teste' (usado em vínculos, documentos e endereços #/loja/teste);
-- trocar o id exigiria atualizar todas as tabelas relacionadas e não é necessário.
-- Atenção: os registros de teste ([TESTE], TST-*) continuam nesta loja até rodar 02-limpar-dados-teste.sql.
-- Reversão: update public.stores set name = 'Teste', code = 'TESTE' where id = 'teste';
begin;
update public.stores
   set name = 'Congonhas', code = 'CGH', updated_at = now()
 where id = 'teste';
select id, code, name, store_type, active from public.stores where id = 'teste';
commit;
