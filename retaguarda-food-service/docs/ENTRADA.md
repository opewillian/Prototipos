# Entrada de protótipo: modo sem credenciais

A tela inicial tem um único botão **Entrar**. Ao clicar, ela abre o dashboard do **modo demonstração**, sem e-mail ou senha.

## Regras de funcionamento

- A entrada é apenas um controle de navegação **visual**, sem autenticação e sem autorização de acesso a dados reais.
- O botão Entrar não acessa o banco e não concede privilégios de administrador.
- O modo demonstração utiliza registros fictícios gravados apenas no armazenamento local do navegador.
- O estado de entrada é guardado em `sessionStorage`, para manter a navegação após atualizar a página na mesma aba, sem criar login verdadeiro.
- O botão Sair volta à entrada e encerra qualquer sessão real do Supabase caso uma tenha sido aberta.
- Para dados reais, selecione **Supabase** dentro do sistema. Aí será exigido login verdadeiro e as políticas RLS continuarão sendo aplicadas.

## Segurança

**Nunca interpretar o clique em Entrar como autenticação verdadeira.**
Antes de liberar dados reais para usuários finais, substituir a entrada visual por autenticação completa e testes de segurança. O módulo Supabase Auth existente foi preservado.

## Publicação

A implementação está nos arquivos `src/components/entry.js` e `assets/entry.css`, conectados em `src/main.js`. O build estático inclui esses arquivos automaticamente e o Cloudflare Pages acompanha a branch `main` do GitHub.
