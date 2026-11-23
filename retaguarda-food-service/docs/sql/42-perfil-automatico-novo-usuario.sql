-- 42: Usuário criado no painel do Supabase (Authentication) não aparecia em Matriz › Usuários e acessos,
-- porque não havia nada criando a linha em public.user_profiles (23/11/2026, caso mariana@igtalimentos.com).
-- Cria os perfis que faltam e um gatilho para os próximos usuários já ganharem o perfil.
-- Nome = metadado "name"/"full_name" se houver; senão a parte do e-mail antes do @, com a 1ª letra maiúscula.
-- O perfil nasce SEM acesso a nenhuma loja/módulo: a liberação continua sendo feita na tela Usuários e acessos.
begin;
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), nullif(new.raw_user_meta_data->>'full_name',''),
                           initcap(split_part(coalesce(new.email,''),'@',1))))
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.user_profiles (user_id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'name',''), nullif(u.raw_user_meta_data->>'full_name',''), initcap(split_part(coalesce(u.email,''),'@',1)))
from auth.users u where not exists (select 1 from public.user_profiles p where p.user_id = u.id);

select u.email, p.display_name, p.active from auth.users u join public.user_profiles p on p.user_id = u.id order by u.created_at;
commit;
