-- 37: Revisão da CT-0002 (31/10/2026, rascunho) depois do script 36 — decisão do usuário em 23/11/2026.
-- A planilha contou em embalagens, mas a unidade do item é kg:
--   CHOCODELTA 500G (1000417): 90 potes de 500 g = 45 kg.
--   MP - LEITE EM PO DESNATADO (1000465): 3 pacotes de 280 g = 0,84 kg.
-- Os demais itens revisados ficaram como estão: a quantidade já estava na unidade do item e só o custo da planilha era por embalagem.
begin;
update public.stock_count_items ci set
  counted_quantity = v.q, parts = jsonb_build_object('manual', v.q), line_total = round(v.q * ci.unit_cost, 2)
from (values ('1000417', 45.0::numeric), ('1000465', 0.84::numeric)) v(code, q)
join public.items it on it.code = v.code
where ci.item_id = it.id and ci.count_id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca';
select it.code, it.name, ci.counted_quantity, ci.unit_cost, ci.line_total,
       (select round(sum(line_total),2) from public.stock_count_items where count_id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca') total_ct0002
from public.stock_count_items ci join public.items it on it.id = ci.item_id
where ci.count_id = 'df8a0795-4f63-41f5-b5b9-2cfa799fd2ca' and it.code in ('1000417','1000465');
commit;
