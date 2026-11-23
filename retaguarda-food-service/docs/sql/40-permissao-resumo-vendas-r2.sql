-- 40: As vendas passam a ficar só no Cloudflare R2 (decisão do usuário em 23/11/2026). As telas pedem o resumo à função
-- "degust" (ação "resumo"), que confere aqui, com o login de quem chama, se a pessoa vê Faturamento ou CMV da loja.
create or replace function public.can_view_sales(p_store text)
returns boolean language sql stable security definer set search_path = '' as $$
  select mft_private.has_tab_access(p_store, 'sales', false) or mft_private.has_tab_access(p_store, 'cmv', false);
$$;
revoke all on function public.can_view_sales(text) from public, anon;
grant execute on function public.can_view_sales(text) to authenticated;
select public.can_view_sales('teste') as teste_sem_login;
