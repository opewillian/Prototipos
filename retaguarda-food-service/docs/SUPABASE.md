# Integração com o Supabase

Projeto conectado: **Retaguarda MFT** — `nngcbrqemhnbyqjjdnlh`.
URL pública: `https://nngcbrqemhnbyqjjdnlh.supabase.co`.

A camada `src/core/supabase.js` instancia o cliente oficial no navegador com uma **chave publicável**.
A camada `src/core/api.js` concentra as consultas e faz o filtro por unidade quando aplicável.
Cada módulo contém seu próprio arquivo `index.js` com campos e tabela.

## Estado atual

- A instância Supabase foi encontrada ativa e com as tabelas esperadas.
- Não há usuários em `public.user_profiles` e os módulos reais exigem login e associação autorizada no banco.
- RLS existente **não foi alterado**, nem foi adicionada política de leitura anônima.
- No modo Supabase, a aplicação é **somente leitura**; no modo demonstração, os dados fictícios permanecem no navegador.
- O projeto compartilha o backend existente Retaguarda MFT. Se for necessária independência entre protótipos, crie um projeto Supabase separado antes de usar dados reais.
- Nenhuma chave `service_role` ou secret foi adicionada ao repositório.

## Próximos passos

1. Configurar usuários reais no Auth, perfis e permissões por unidade.
2. Validar cada tela com login de teste que tenha acesso autorizado.
3. Planejar gravações com validações e testes de RLS para cada módulo.
4. Adicionar Storage privado para anexos com regras por unidade e tipo de documento.
5. Evoluir o frontend para um fluxo com build e testes automatizados antes de produção.

Referências: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/reference/javascript/initializing
