-- Retaguarda MFT · libera a unidade DEL-VCP-C15 (empresa 36, Campinas) para testar transferências com a DEL-CGH-PUB.
-- Decisão do Willian em 20/11/2026. Copia da CGH (id 'teste'): módulos liberados (store_feature_flags),
-- usuários vinculados (store_memberships) e permissões por módulo (user_tab_permissions). Nada é apagado.
-- Reversão: delete from public.user_tab_permissions where store_id='del-vcp-c15';
--           delete from public.store_memberships where store_id='del-vcp-c15';
--           delete from public.store_feature_flags where store_id='del-vcp-c15';
begin;
do $$ begin
  if not exists (select 1 from public.stores where id='del-vcp-c15' and everest_code=36) then
    raise exception 'Unidade del-vcp-c15 (empresa 36) não encontrada.';
  end if;
end $$;

insert into public.store_feature_flags (store_id, feature_code, enabled)
select 'del-vcp-c15', f.feature_code, f.enabled from public.store_feature_flags f
 where f.store_id='teste'
   and not exists (select 1 from public.store_feature_flags x where x.store_id='del-vcp-c15' and x.feature_code=f.feature_code);

insert into public.store_memberships (user_id, store_id, role, active)
select m.user_id, 'del-vcp-c15', m.role, m.active from public.store_memberships m
 where m.store_id='teste'
   and not exists (select 1 from public.store_memberships x where x.store_id='del-vcp-c15' and x.user_id=m.user_id);

insert into public.user_tab_permissions (user_id, store_id, tab_code, can_view, can_edit)
select p.user_id, 'del-vcp-c15', p.tab_code, p.can_view, p.can_edit from public.user_tab_permissions p
 where p.store_id='teste'
   and not exists (select 1 from public.user_tab_permissions x where x.store_id='del-vcp-c15' and x.user_id=p.user_id and x.tab_code=p.tab_code);

select (select count(*) from public.store_feature_flags where store_id='del-vcp-c15' and enabled) modulos,
       (select count(*) from public.store_memberships where store_id='del-vcp-c15' and active) usuarios,
       (select count(*) from public.user_tab_permissions where store_id='del-vcp-c15') permissoes,
       (select name||' · '||coalesce((select name from public.brands b where b.id=s.brand_id),'sem marca') from public.stores s where id='del-vcp-c15') loja;
commit;
