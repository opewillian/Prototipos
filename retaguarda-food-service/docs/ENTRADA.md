# Entrada e autenticação

O botão inicial **Entrar** leva à seleção entre Matriz e Loja. Esse clique é apenas navegação, **não** uma autenticação.

Antes de ler ou gravar dados, o usuário deve entrar no Supabase com e-mail e senha. A Matriz valida o vínculo `matrix_admin`; a Loja mostra apenas unidades autorizadas por RLS.

Não existe modo de demonstração. As escolhas de navegação podem persistir na sessão do navegador, mas não substituem login. O botão **Sair** termina também a sessão do Supabase.
