-- 26: MP - CREME DE LEITE (1000044) passa de un para kg. EXECUTADO PELO USUÁRIO (decisão dele, 23/11/2026).
-- A única entrada já feita é a nota 184284 (Sendas, recebida): 54 un a R$ 2,6524 = R$ 143,23.
-- Convertida para 10,8 kg a R$ 13,262/kg (mesmo valor). Como a nota já foi recebida, a linha e o movimento são
-- travados por trigger; este script desliga os triggers SÓ para essas duas linhas (session_replication_role) e religa em seguida.
-- De-paras de creme passam para kg: caixinha 200 g = 0,2 kg; caixa C/27 = 5,4 kg.
-- Reversão: mesmos updates ao contrário (quantidade / 0,2, custo x 0,2, base_unit 'un', fatores 1 e 27).
begin;
update public.items set base_unit = 'kg', updated_at = now() where code = '1000044' and base_unit = 'un';

set local session_replication_role = replica;
update public.stock_movements set quantity_delta = 10.8, unit_cost = 13.262
 where id = '69fedf36-d0c2-4827-a025-0188e978acf6' and quantity_delta = 54;
update public.invoice_items set quantity = 10.8, unit_cost = 13.262
 where id = '3231a1bb-dd59-46e9-98ce-0391dc708c70' and quantity = 54;
set local session_replication_role = origin;

update public.supplier_item_map m set item_unit = 'kg',
       factor = case when m.factor >= 27 then 5.4 else 0.2 end, updated_at = now()
 where m.item_id = (select id from public.items where code = '1000044');

select i.base_unit,
       (select quantity_delta || ' @ ' || unit_cost from public.stock_movements where id = '69fedf36-d0c2-4827-a025-0188e978acf6') movimento,
       (select quantity || ' @ ' || unit_cost from public.invoice_items where id = '3231a1bb-dd59-46e9-98ce-0391dc708c70') linha_nota,
       (select string_agg(supplier_item_code || '=' || factor || ' ' || item_unit, ', ') from public.supplier_item_map where item_id = i.id) de_paras
from public.items i where i.code = '1000044';
commit;
