-- 39: Controle de acesso dos módulos novos (pedido do usuário em 23/11/2026).
--   Loja   › Faturamento  → código 'sales' (antes usava a liberação do CMV).
--   Matriz › Notas fiscais → código 'invoices' (antes: só administrador, fora da tela de acessos).
-- Ninguém perde acesso: quem tinha CMV ganha Faturamento; quem está na Matriz ganha Notas fiscais;
-- lojas com o módulo CMV ligado ficam com Faturamento ligado.
begin;
alter table public.user_tab_permissions drop constraint user_tab_permissions_tab_code_check;
alter table public.user_tab_permissions add constraint user_tab_permissions_tab_code_check check (tab_code = any (array[
  'counts','cmv','transfers','losses','orders','notes','lists','catalog','suppliers','matrixOrders','users','sales','invoices']));
alter table public.store_feature_flags drop constraint store_feature_flags_feature_code_check;
alter table public.store_feature_flags add constraint store_feature_flags_feature_code_check check (feature_code = any (array[
  'counts','lists','notes','orders','transfers','losses','cmv','catalog','stock','api','sales']));

insert into public.store_feature_flags (store_id, feature_code, enabled)
select store_id, 'sales', enabled from public.store_feature_flags where feature_code = 'cmv'
on conflict (store_id, feature_code) do nothing;

insert into public.user_tab_permissions (user_id, store_id, tab_code, can_view, can_edit)
select user_id, store_id, 'sales', can_view, can_edit from public.user_tab_permissions where tab_code = 'cmv'
on conflict (user_id, store_id, tab_code) do nothing;

insert into public.user_tab_permissions (user_id, store_id, tab_code, can_view, can_edit)
select distinct p.user_id, 'matriz', 'invoices', true, true from public.user_tab_permissions p
join public.store_memberships m on m.user_id = p.user_id and m.store_id = 'matriz' and m.active
where p.store_id = 'matriz'
on conflict (user_id, store_id, tab_code) do nothing;

-- Vendas: lê quem tem Faturamento ou CMV (o CMV mostra o faturamento do período).
do $$ declare t text; begin
  foreach t in array array['sales','sale_items','sale_payments','sales_imports'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (mft_private.has_tab_access(store_id,''sales'',false) or mft_private.has_tab_access(store_id,''cmv'',false))', t||'_read', t);
  end loop;
end $$;

select (select count(*) from public.store_feature_flags where feature_code='sales') lojas_com_faturamento,
       (select count(*) from public.user_tab_permissions where tab_code='sales') acessos_faturamento,
       (select count(*) from public.user_tab_permissions where tab_code='invoices') acessos_notas_matriz;
commit;
