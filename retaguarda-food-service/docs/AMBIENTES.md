# Retaguarda Food Service — Separação entre Matriz e Loja

## Fluxo de entrada

1. A tela inicial oferece **Entrar**, sem e-mail nem senha, exclusivamente no **protótipo**.
2. Após entrar, o usuário encontra a **seleção do ambiente**: Matriz ou Loja.
3. Ao escolher **Matriz**, abre uma aplicação administrativa, com menu lateral e painel corporativo.
4. Ao escolher **Loja**, a pessoa primeiro escolhe uma **unidade operacional** e depois abre a aplicação da loja, com menu horizontal.
5. **Trocar ambiente** volta à seleção, sem descartar a sessão Supabase.
6. **Sair** volta à tela inicial. Se houver uma sessão Supabase autenticada, ela é encerrada.
7. As escolhas de entrada, ambiente e loja ficam em `sessionStorage` até o encerramento da sessão da aba (ou clique em Sair).

## Estrutura por frente

```
src/
  areas/
    selection.js        # Tela após entrar + seleção da unidade
    shared.js           # Alternância demo/Supabase, controles de sessão
    matriz/
      config.js         # Menu exclusivo
      layout.js         # Casca visual administrativa
      data.js           # Consultas corporativas e autorização
      home.js           # Painel corporativo e pedidos centralizados
    loja/
      config.js         # Menu exclusivo
      layout.js         # Casca visual operacional
      home.js           # Painel de indicadores da unidade
  modules/              # Componentes de cada domínio funcional
  core/                 # Supabase e camada compartilhada de acesso
```

**Matriz**: Painel da Matriz, Configuração inicial, Unidades, Itens, Fornecedores, Usuários e perfis, Pedidos das lojas (acompanhamento).

**Loja**: Visão da loja, Contagem, Listas, Notas fiscais, Pedidos de compra, Transferências, Perdas e CMV.

Menus e estilos são independentes. Os módulos de negócios existentes são reaproveitados conforme o ambiente.

## Segurança e dados

- O clique inicial e a escolha do ambiente **não autentica** ninguém no Supabase.
- Em **Demonstração**, todos os dados são fictícios e editáveis somente no navegador.
- Em **Supabase**, é necessário autenticar usuário real.
- O ambiente Matriz consulta o vínculo ativo `matrix_admin` em `store_memberships`. Sem ele, exibe acesso não autorizado.
- O ambiente Loja lista apenas unidades de tipo `operational` visíveis pelas regras RLS.
- A seleção de ambiente não concede acesso adicional; o banco continua aplicando isolamento de dados e permissões.
- Não foram alteradas tabelas, políticas ou registros do Supabase nesta etapa.

## Testes

Execute `npm run test` para testar seleção e isolamento dos menus, ou `npm run build` para testar e preparar a pasta `dist`. O GitHub Actions executa o build a cada push. Esses são testes automatizados de interface e sintaxe; não substituem testes de navegação e autorização com navegador autenticado.
