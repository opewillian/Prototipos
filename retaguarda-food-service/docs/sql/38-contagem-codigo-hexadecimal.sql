-- 38: Código das contagens em hexadecimal aleatório (ex.: CT-7F3A9C), como nas transferências (pedido do usuário em 23/11/2026).
-- O app passa a gerar o código ao criar (insertWithCode). Aqui: código único por loja e troca dos códigos já existentes.
begin;
update public.stock_counts
   set display_id = 'CT-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))
 where display_id !~ '^CT-[0-9A-F]{6}$';
create unique index if not exists stock_counts_store_display_id_key on public.stock_counts (store_id, display_id);
select store_id, display_id, count_date, status from public.stock_counts order by store_id, count_date;
commit;
