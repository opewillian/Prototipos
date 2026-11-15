# Retaguarda Food Service: uso dos módulos

## Fluxo recomendado

1. **Matriz / Lojas**: crie as unidades operacionais (um administrador da matriz deve executar esta ação).
2. **Matriz / Itens e Fornecedores**: cadastre os produtos e fornecedores antes dos lançamentos.
3. **Listas**: monte listas de compra ou contagem; é possível incluir itens em cada lista.
4. **Contagens**: crie rascunho, inclua itens e quantidades; depois finalize. O Supabase possui gatilhos que podem gerar ajustes de estoque.
5. **Pedidos de compra**: crie pedido, adicione itens e quantidades. Situações permitidas: rascunho, enviado, realizando, realizado, cancelado.
6. **Notas fiscais**: cadastre e inclua itens, depois marque como recebida. O banco aplica movimentações de entrada.
7. **Transferências**: selecione loja destino, inclua itens e emita. O banco possui trigger de saída/entrada automática.
8. **Perdas**: cadastre perdas, inclua itens e registre. Movimentações são processadas pelo banco.
9. **CMV**: apresenta fechamentos existentes. Criação automática de fechamento por inventário ainda requer rotina específica de cálculo e validação de compras e perdas.

## Modos

**Demonstração:** cadastros, itens, edições e status são salvos no armazenamento do navegador e não são enviados ao banco.
**Supabase:** todas as operações passam por login e políticas RLS já existentes.

## Ativação do primeiro usuário

O banco Supabase `Retaguarda MFT` foi encontrado com **0 usuários Auth**, **0 perfis** e **0 associações a lojas**.
A habilitação de cadastro público automático com permissão de administrador seria insegura. Por isso, **não** foi habilitada.

1. Crie um usuário no painel Supabase → Authentication → Users.
2. Registre o mesmo ID em `public.user_profiles`.
3. Conceda a associação à loja Matriz em `public.store_memberships` com papel `matrix_admin`.
4. Faça login pelo frontend e confirme que as políticas RLS autorizam o acesso.
5. Para demais usuários, use a matriz para organizar atribuições e regras específicas. A interface de gestão de permissões ainda é somente leitura.

SQL de exemplo para ser executado **após criar o usuário** (substitua o UUID pelo ID do Auth e valide acesso):

```sql
insert into public.user_profiles(user_id,display_name,active)
values ('UUID-DO-USUARIO'::uuid,'Administrador',true)
on conflict (user_id) do update set active=true;
insert into public.store_memberships(user_id,store_id,role,active)
values ('UUID-DO-USUARIO'::uuid,'matriz','matrix_admin',true)
on conflict (user_id,store_id) do update set role='matrix_admin',active=true;
```

Não adicione credenciais ou `service_role` ao código frontend.

## Restrições

- Requer um navegador moderno e conexão com o CDN do Supabase.
- Os formulários genéricos de itens vinculados estão disponíveis para inclusão e exclusão, não edição de cada linha.
- Lançamentos com status final bloqueado não podem ser editados no aplicativo.
- Notas fiscais: vencimentos, anexos e boletos serão a próxima etapa.
- Compras: a seleção de fornecedor por item e vínculos de fornecedores por loja ainda requerem interface própria; registros que exigem vínculo específico podem ser recusados pelo banco.
- CMV: o cálculo automático do fechamento e a memória de cálculo estão pendentes; fechamentos existentes podem ser consultados.
- Usuários: a criação e concessão de permissões ainda exigem procedimento administrativo.
- Em produção, recomenda-se testes de integração por tipo de registro antes de operar dados reais.

O backend compartilhado foi preservado. Não houve modificação de esquema, políticas ou registros existentes.
