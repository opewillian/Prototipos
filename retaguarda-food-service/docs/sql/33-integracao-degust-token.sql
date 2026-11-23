-- 33: Integração Linx Degust One (faturamento). Guarda o token da API (vale 4 h; a Linx não deixa gerar token toda hora).
-- Só a função do servidor (service role) lê e grava: RLS ligado e nenhuma política para usuários do app.
create table if not exists public.integration_tokens (
  provider text primary key,
  token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.integration_tokens enable row level security;
revoke all on public.integration_tokens from anon, authenticated;
select provider, expires_at from public.integration_tokens;
