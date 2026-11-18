# Integração Supabase — Retaguarda MFT

Projeto: `nngcbrqemhnbyqjjdnlh`.
Cliente: `src/core/supabase.js`.
Configuração pública: `src/core/config.js`.

**Somente Supabase.** O modo de dados fictícios e o armazenamento local de registros foram retirados.

As unidades são compartilhadas em um único projeto, com tabelas operacionais isoladas por `store_id`, políticas RLS e integridade referencial. A unidade Teste é `teste`.

`stores`: SELECT para usuários autenticados com vínculo, escrita revogada. Novas lojas somente pelo painel administrativo do Supabase.

`store_feature_flags`: SELECT sujeito a RLS; escrita não concedida a usuários comuns. A função `mft_private.has_tab_access` exige a flag ativa ao gravar um módulo; além disso, políticas restritivas exigem aprovação da loja destino para transferências e habilitação de catálogo para vínculos `store_item_suppliers`.

Os módulos exibem dados conforme a sessão autorizada. No futuro, liberar funcionalidades por loja exige habilitar sua respectiva flag no Supabase.

**Não usar service_role no frontend**. Validar login, escrita e RLS por loja antes de produção.
