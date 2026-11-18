# Cloudflare Pages — Retaguarda Food Service

URL pública: https://retaguarda-food-service.pages.dev

A publicação é automática pelo GitHub, com:

| Campo | Valor |
|---|---|
| Repositório | `opewillian/Prototipos` |
| Branch | `main` |
| Diretório raiz | `retaguarda-food-service` |
| Build | `npm run build` |
| Saída | `dist` |

O script de build executa os testes de interface, valida sintaxe e imports JavaScript e copia apenas `index.html`, `src/` e `assets/` para o site publicado.

## Teste após cada publicação

1. Abra a URL e clique em **Entrar**.
2. Escolha **Matriz** ou **Loja**.
3. Faça login real com a conta autorizada no Supabase.
4. Na Loja, escolha a unidade **Teste**.
5. Confirme que os módulos carregam e que os dados lidos pertencem somente à loja escolhida.
6. Cadastre registros de teste exclusivamente na **Teste**, depois confira a persistência no Supabase.
7. Verifique que o cadastro/edição/exclusão de unidades não existe na interface da Matriz.
8. Teste novas funcionalidades e seus efeitos no estoque antes de habilitá-las para outras lojas.

**Atenção:** o botão Entrar apenas navega para a escolha de ambientes. Credenciais reais são obrigatórias para acessar registros do Supabase. Não existe fonte fictícia de dados.

Os administradores podem liberar módulos por loja em `store_feature_flags` após homologação. Nenhuma chave secreta deve ser publicada no frontend.
