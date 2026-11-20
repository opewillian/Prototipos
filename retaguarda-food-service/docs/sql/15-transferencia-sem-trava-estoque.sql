-- Retaguarda MFT · transferência não trava mais por estoque menor que a quantidade. Pedido do Willian em 20/11/2026.
-- Remove da função mft_private.post_transfer_movements() só a verificação "Insufficient stock to issue this transfer".
-- Efeito: ao emitir, a loja de origem pode ficar com saldo negativo do item (a próxima contagem acerta).
-- Antes de trocar, guarda a definição atual em mft_private.function_backups (para voltar, rode a linha da Reversão).
-- Reversão: do $$ begin execute (select def from mft_private.function_backups where fn='mft_private.post_transfer_movements()' order by saved_at desc limit 1); end $$;
begin;
create table if not exists mft_private.function_backups (
  id bigint generated always as identity primary key,
  fn text not null,
  def text not null,
  reason text,
  saved_at timestamptz not null default now()
);
revoke all on mft_private.function_backups from public, anon, authenticated;

do $$
declare old_def text; new_def text;
begin
  old_def := pg_get_functiondef('mft_private.post_transfer_movements()'::regprocedure);
  new_def := regexp_replace(old_def,
    'if\s*\(\s*select\s+coalesce\(sum\(quantity_delta\),0\)\s+from\s+public\.stock_movements\s+where\s+store_id\s*=\s*new\.from_store_id\s+and\s+item_id\s*=\s*line\.item_id\s*\)\s*<\s*line\.quantity\s+then\s+raise\s+exception\s+''Insufficient stock to issue this transfer''\s*;\s*end\s+if\s*;',
    '', 'i');
  if new_def = old_def or position('Insufficient stock' in new_def) > 0 then
    raise exception 'Trecho da verificação de estoque não encontrado; nada foi alterado.';
  end if;
  insert into mft_private.function_backups (fn, def, reason) values ('mft_private.post_transfer_movements()', old_def, 'antes de tirar a trava de estoque (SQL 15)');
  execute new_def;
end $$;

select position('Insufficient stock' in pg_get_functiondef('mft_private.post_transfer_movements()'::regprocedure)) = 0 as trava_removida,
       position('stock_movements' in pg_get_functiondef('mft_private.post_transfer_movements()'::regprocedure)) > 0 as movimentos_mantidos,
       (select count(*) from mft_private.function_backups) backups;
commit;
