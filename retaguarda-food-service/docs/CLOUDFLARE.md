# Publicação futura no Cloudflare Pages

A primeira versão funciona como site estático sem bundler e sem backend próprio.

Quando decidir publicar, vincule o repositório `opewillian/Prototipos` ao Cloudflare Pages e configure:

- **Diretório raiz / root directory:** `retaguarda-food-service`
- **Comando de build:** vazio (sem build)
- **Diretório de saída:** `.` (a própria raiz do protótipo)
- **Branch de produção:** `main`

Antes de habilitar login no domínio Cloudflare, atualize as configurações de Auth no Supabase, em especial URLs autorizadas e políticas de redirecionamento.

A URL e a chave publicável deste protótipo estão em `src/core/config.js`. Para operação definitiva, recomendamos Vite e variáveis de ambiente no dashboard do Cloudflare. Nunca use chaves secretas do Supabase no frontend.

**Nenhuma conexão com Cloudflare foi realizada nesta etapa.**
