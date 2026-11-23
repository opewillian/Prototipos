-- 29: Contagens da CGH de 30/09 e 31/10/2026 (estoque do Everest), lançadas em 23/11/2026 a pedido do usuário.
-- CT-0001 (30/09, 133 itens, R$ 86.714,34) e CT-0002 (31/10, 129 itens, R$ 74.400,98) foram criadas e finalizadas pelo app.
-- Este script: (1) inclui na CT-0002 os 21 itens que tinham estoque em 30/09 e não aparecem em 31/10, com quantidade 0
--   (no Everest ficaram zerados; autorizado pelo usuário) — a contagem já finalizada é travada, gatilhos desligados só nesse insert;
-- (2) data as contagens no fim do dia (30/09 e 31/10 23:59, horário de Brasília) e (3) refaz os ajustes de estoque
--   em relação ao saldo NAQUELA data (o app calculou contra o saldo de hoje, que já tinha a nota 184284 e a transferência de 20/11).
begin;
set local session_replication_role = replica;
insert into public.stock_count_items (count_id, store_id, item_id, counted_quantity, unit_cost, line_total, parts)
select 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca'::uuid, 'teste', v.item_id, 0, v.cost, 0, '{}'::jsonb
from (values
 ('9a2371d9-ef58-41c4-b646-2aeadca09592'::uuid,3.5),
 ('adf4fb4c-1588-4855-ab90-3988b9ec7619'::uuid,20.15),
 ('0f8dd662-1693-4fa5-bdd5-b943d015de02'::uuid,6.0),
 ('698434f4-fc00-4ff4-ad73-ff36f40a2fa4'::uuid,0.995),
 ('4d0f18b1-deb4-4a6c-8b66-6e32ed7f29c0'::uuid,6.6667),
 ('5a902bc4-0642-4a79-8c81-31621784af2d'::uuid,0.0819),
 ('18ccd635-050a-4ba7-bb9a-3133b9bba45b'::uuid,0.0549),
 ('dab8a328-16c9-4b33-a3f2-188c94f4c2eb'::uuid,0.6644),
 ('ecfafce7-6bf7-4ed7-b2ce-20abc8fbaef3'::uuid,24.56),
 ('558f858a-92f1-4ef1-9b1a-8922abb02358'::uuid,3.025),
 ('498240d9-413d-4452-be8b-fa29ae33c715'::uuid,4.9),
 ('a47b0945-c8d7-4488-837a-acabfd60d8a7'::uuid,0.1215),
 ('578997c6-e4f0-4361-a0cd-94a771e94b58'::uuid,3.2),
 ('b5a7d91c-7d2b-4387-aa71-08920d3f57af'::uuid,2.86),
 ('a0794fef-5310-4014-9c02-79ae790de277'::uuid,2.86),
 ('16262669-980e-421f-a6e2-7eba3367e967'::uuid,2.86),
 ('0ac92dce-bf22-4d34-acba-d59ea1b0a102'::uuid,10.0),
 ('a8f7d22a-51e8-423f-a113-b41327db06aa'::uuid,18.97),
 ('1a53442e-aaf5-4988-bc2f-a54805a330c5'::uuid,3.2),
 ('1e781d36-56bb-48e2-a877-94d3ec61a824'::uuid,80.0),
 ('a35a82e6-7f06-4875-bfb7-75977de8509c'::uuid,1.79)
) v(item_id, cost)
where not exists (select 1 from public.stock_count_items x where x.count_id='df8a0795-4f63-41f5-b5b9-2cfa799fd2ca' and x.item_id=v.item_id);
set local session_replication_role = origin;

update public.stock_counts set finalized_at = timestamptz '2026-09-30 23:59:00-03' where id = 'de036d15-18e2-4c8e-af24-e2ca46007d25';
update public.stock_counts set finalized_at = timestamptz '2026-10-31 23:59:00-03' where id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca';

delete from public.stock_movements where source_type = 'count' and source_id in ('de036d15-18e2-4c8e-af24-e2ca46007d25','df8a0795-4f63-41f5-b5b9-2cfa799fd2ca');

insert into public.stock_movements (store_id,item_id,quantity_delta,unit_cost,movement_type,source_type,source_id,source_line_id,occurred_at)
select l.store_id, l.item_id, l.counted_quantity - coalesce((select sum(m.quantity_delta) from public.stock_movements m
         where m.store_id=l.store_id and m.item_id=l.item_id and m.occurred_at <= timestamptz '2026-09-30 23:59:00-03'),0),
       l.unit_cost, 'count_adjustment', 'count', l.count_id, l.id, timestamptz '2026-09-30 23:59:00-03'
from public.stock_count_items l where l.count_id = 'de036d15-18e2-4c8e-af24-e2ca46007d25'
  and l.counted_quantity - coalesce((select sum(m.quantity_delta) from public.stock_movements m
         where m.store_id=l.store_id and m.item_id=l.item_id and m.occurred_at <= timestamptz '2026-09-30 23:59:00-03'),0) <> 0;

insert into public.stock_movements (store_id,item_id,quantity_delta,unit_cost,movement_type,source_type,source_id,source_line_id,occurred_at)
select l.store_id, l.item_id, l.counted_quantity - coalesce((select sum(m.quantity_delta) from public.stock_movements m
         where m.store_id=l.store_id and m.item_id=l.item_id and m.occurred_at <= timestamptz '2026-10-31 23:59:00-03'),0),
       l.unit_cost, 'count_adjustment', 'count', l.count_id, l.id, timestamptz '2026-10-31 23:59:00-03'
from public.stock_count_items l where l.count_id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca'
  and l.counted_quantity - coalesce((select sum(m.quantity_delta) from public.stock_movements m
         where m.store_id=l.store_id and m.item_id=l.item_id and m.occurred_at <= timestamptz '2026-10-31 23:59:00-03'),0) <> 0;

select (select count(*) from public.stock_count_items where count_id='df8a0795-4f63-41f5-b5b9-2cfa799fd2ca') itens_3110,
       (select count(*) from public.stock_movements where source_id='de036d15-18e2-4c8e-af24-e2ca46007d25') mov_3009,
       (select count(*) from public.stock_movements where source_id='df8a0795-4f63-41f5-b5b9-2cfa799fd2ca') mov_3110,
       (select round(sum(quantity_delta*0+0),2) from public.stock_movements) dummy,
       (select round(sum(l.counted_quantity*l.unit_cost),2) from public.stock_count_items l where l.count_id='df8a0795-4f63-41f5-b5b9-2cfa799fd2ca') valor_3110,
       (select count(*) from (select item_id, sum(quantity_delta) q from public.stock_movements
            where store_id='teste' and occurred_at <= timestamptz '2026-10-31 23:59:00-03' group by item_id) s
          join public.stock_count_items l on l.item_id=s.item_id and l.count_id='df8a0795-4f63-41f5-b5b9-2cfa799fd2ca' where abs(s.q - l.counted_quantity) > 0.0001) divergentes_3110;
commit;
