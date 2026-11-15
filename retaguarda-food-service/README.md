# Retaguarda Food Service

Protótipo modular de retaguarda para operação de lojas de food service.

## Estrutura

- `src/modules/dashboard/`: resumo executivo
- `src/modules/matriz/`: catálogo e cadastros centrais
- `src/modules/fornecedores/`: fornecedores
- `src/modules/contagem/`: contagens de estoque
- `src/modules/notas-fiscais/`: entrada de notas fiscais
- `src/modules/pedidos-compra/`: pedidos de compra
- `src/modules/transferencias/`: transferências entre lojas
- `src/modules/cmv/`: fechamento de CMV
- `src/modules/usuarios/`: visualização de perfis (sujeita às permissões)
- `src/core/`: conexão, autenticação, consultas, formatação e demonstração
- `src/components/`: layout e tabelas reutilizáveis
- `assets/`: identidade visual e estilos
- `docs/`: orientações de integração e publicação

## Supabase já configurado

A aplicação inicializa um cliente Supabase apontando para o projeto existente **Retaguarda MFT** (`nngcbrqemhnbyqjjdnlh`).
A URL e a **chave publicável** ficam em `src/core/config.js`. A chave publicável é projetada para uso no navegador; chaves secretas e `service_role` jamais devem ser colocadas no frontend.

**IMPORTANTE:** Este protótipo lê as tabelas existentes do projeto Retaguarda MFT e, portanto, compartilha o mesmo backend. Nenhuma tabela ou política existente foi alterada. As políticas de RLS já configuradas no banco decidem que usuário pode acessar cada loja e módulo.

Por segurança, nesta fase as telas reais fazem **leituras**. Cadastros e alterações serão implantados depois da definição dos fluxos.

## Como abrir

É uma aplicação estática em JavaScript ES Modules, sem etapa de build ou dependências locais obrigatórias. Rode um servidor HTTP na pasta do projeto:

```bash
cd retaguarda-food-service
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

O **modo demonstração** contém dados 100% fictícios, identificados na interface. Troque para **Supabase** e autentique-se com um usuário já configurado no Supabase Auth e autorizado pelas políticas de acesso da Retaguarda MFT. Sem permissões, os dados reais não aparecerão.

## Cloudflare Pages (etapa posterior)

O projeto foi preparado para ser publicado como site estático. Veja `docs/CLOUDFLARE.md`. Nenhum deploy foi realizado nesta etapa.

## Limites da primeira versão

- Navegação visual por módulos e consultas reais sujeitas à autenticação e RLS.
- Dados fictícios no modo demonstração.
- Operações de escrita, anexos, cadastro de perfis e automações de estoque **ainda não estão implementadas**.
- A biblioteca Supabase JS é importada de um CDN com versão fixada; antes de produção, recomendamos incluir um pipeline de build e testes.

## Build para Cloudflare Pages

O aplicativo possui agora `package.json` com `npm run check` e `npm run build`. O build valida JavaScript e copia somente o site para `dist/`.

Na configuração Cloudflare Pages, selecione o repositório `opewillian/Prototipos`, root directory `retaguarda-food-service`, build command `npm run build` e output directory `dist`. Consulte `docs/CLOUDFLARE.md` para o procedimento.

## Tela inicial do esqueleto

A página inicial apresenta uma entrada simples, sem formulário: **Entrar** abre diretamente o **modo demonstração**. Esse clique não autentica usuários no Supabase e não concede acesso a dados reais. O acesso protegido ao Supabase continua disponível mediante e-mail e senha na opção apropriada dentro do sistema. Consulte `docs/ENTRADA.md`.

## Separação de ambientes: Matriz e Loja

Após clicar em **Entrar**, escolha entre **Matriz** (administração corporativa) e **Loja** (operação da unidade). Cada frente possui layouts, navegação e painel inicial próprios, com arquivos em `src/areas/matriz/` e `src/areas/loja/`.

A seleção do ambiente é uma escolha visual, não uma autorização: os dados reais continuam protegidos pelo Supabase Auth e pelas regras RLS. Veja `docs/AMBIENTES.md`. Para validar a estrutura, execute `npm run test`.
