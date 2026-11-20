-- Retaguarda MFT · CGH passa a usar a marca "DeltaExpresso" (cadastrada pela tela); "Delta Expresso" (criada pelo 08) fica inativa.
-- Decisão do Willian em 20/11/2026. Nada é apagado.
-- Reversão: update public.stores set brand_id=(select id from public.brands where name='Delta Expresso') where id='teste';
--           update public.brands set active=true where name='Delta Expresso';
begin;
update public.stores
   set brand_id = (select id from public.brands where name = 'DeltaExpresso'), updated_at = now()
 where id = 'teste';
update public.brands set active = false, updated_at = now()
 where name = 'Delta Expresso'
   and not exists (select 1 from public.items i where i.brand_id = brands.id)
   and not exists (select 1 from public.stores s where s.brand_id = brands.id);
select b.name, b.active, b.is_global,
       (select string_agg(s.name, ', ') from public.stores s where s.brand_id = b.id) lojas,
       (select count(*) from public.items i where i.brand_id = b.id) itens
  from public.brands b order by b.name;
commit;
