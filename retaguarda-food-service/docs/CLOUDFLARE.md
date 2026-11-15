# Publicação com Cloudflare Pages

Repositório: `opewillian/Prototipos` (privado).
Aplicação: `retaguarda-food-service/`.

No Cloudflare Dashboard, vá até Workers & Pages, crie um projeto **Pages** e selecione **Import an existing Git repository**. Autorize o GitHub e escolha `opewillian/Prototipos`.

## Configurações do deploy

| Campo | Valor |
| --- | --- |
| Nome sugerido | `retaguarda-food-service` |
| Production branch | `main` |
| Framework preset | `None` |
| Root directory (advanced) | `retaguarda-food-service` |
| Build command | `npm run build` |
| Build output directory | `dist` |

O script `scripts/build.mjs` faz validação sintática e de imports e publica somente os diretórios `src/` e `assets/`, além do `index.html`. Outras pastas do repositório não serão expostas pelo Pages.

A integração com Supabase usa chave **publicável**, não uma chave secreta. O navegador acessa dados reais somente mediante login e políticas RLS.

## Teste depois do deploy

1. Copie a URL `*.pages.dev` real fornecida pelo Cloudflare.
2. Verifique o modo **Demonstração** criando um registro fictício e atualizando a página.
3. Mude para **Supabase**, entre com sua conta administradora já criada e confirme a exibição da Matriz.
4. Crie uma loja de teste e cadastre itens e fornecedores, conferindo no painel Supabase.
5. Não finalize operações de inventário, recebimento ou transferências com dados reais até testar os gatilhos.
6. Em Supabase → Authentication → URL Configuration, configure a URL do Cloudflare para futuros e-mails e fluxos de recuperação de senha.
7. Verifique se novos commits na pasta do projeto causam deploy automático.

Caso `Prototipos` não apareça na lista de repositórios do Cloudflare, revise o acesso do aplicativo Cloudflare Pages no GitHub e autorize este repositório.

**Observação:** o assistente preparou o build e o repositório, mas não executou a conexão com a conta Cloudflare. A etapa de autorização do GitHub no Cloudflare é feita no painel.

Referências: https://developers.cloudflare.com/pages/configuration/monorepos/ e https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
