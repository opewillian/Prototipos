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
