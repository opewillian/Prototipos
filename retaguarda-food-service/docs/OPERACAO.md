# Operação da Retaguarda

A plataforma utiliza somente dados reais do Supabase. Não existe ambiente de demonstração.

**Matriz**: consulta de unidades, cadastros centrais de itens e fornecedores, usuários e visão de pedidos. Cadastro de novas lojas não está disponível.

**Loja**: selecionar uma unidade. Contagens, Listas, Notas fiscais, Pedidos, Transferências, Perdas e CMV mantêm seus dados por unidade. Apenas funcionalidades liberadas em `store_feature_flags` podem receber gravações, sujeitas às permissões do usuário.

**Teste** é a unidade reservada para homologar operações e novas funcionalidades antes de liberar para outras lojas.

Operações que finalizam contagens, recebem notas, registram perdas e emitem transferências podem criar movimentos de estoque via gatilhos do Supabase. Faça os primeiros testes com registros próprios da unidade Teste e monitore os movimentos gerados.

Transferências dependem de outra unidade habilitada e não devem ser usadas para homologar contra lojas em produção. Anexos, cálculo automático completo de CMV e gestão visual de perfis ainda requerem desenvolvimento.
