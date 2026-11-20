-- Retaguarda MFT · unidades de medida reduzidas a un (unidade), kg (quilo) e l (litro). Pedido do Willian em 20/11/2026.
-- Converte os itens com outras unidades: pc, pct, par, cx, fd, dz -> un; g -> kg; ml -> l.
-- Só troca o rótulo da unidade. Por isso, aborta se algum desses itens já tiver documento lançado,
-- porque nesse caso as quantidades antigas mudariam de sentido.
-- Depois cria uma regra no banco que só aceita un, kg ou l.
-- Reversão: alter table public.items drop constraint if exists items_base_unit_check;
--           (as unidades antigas dos itens convertidos estão listadas no resultado deste script)
begin;
create temp table _conv on commit drop as
select id, code, name, base_unit as antes,
       case when base_unit in ('g') then 'kg' when base_unit in ('ml') then 'l' else 'un' end as depois
  from public.items where base_unit not in ('un','kg','l');
do $$
declare n int;
begin
  select count(*) into n from _conv c where
       exists (select 1 from public.stock_count_items x where x.item_id=c.id)
    or exists (select 1 from public.purchase_list_items x where x.item_id=c.id)
    or exists (select 1 from public.purchase_order_items x where x.item_id=c.id)
    or exists (select 1 from public.invoice_items x where x.item_id=c.id)
    or exists (select 1 from public.transfer_items x where x.item_id=c.id)
    or exists (select 1 from public.loss_items x where x.item_id=c.id);
  if n > 0 then raise exception 'Há % item(ns) com documentos lançados; converter manualmente.', n; end if;
end $$;
update public.items i set base_unit = c.depois, updated_at = now() from _conv c where i.id = c.id;
alter table public.items add constraint items_base_unit_check check (base_unit in ('un','kg','l'));
select code, name, antes, depois from _conv order by name;
commit;
