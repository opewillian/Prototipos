# CÉREBRO DO PROJETO — RETAGUARDA FOOD SERVICE

> **Documento-mestre e fonte de continuidade.** Leia antes de planejar, programar, alterar o banco, publicar ou propor mudanças estruturais. Este arquivo preserva o escopo do produto, as decisões confirmadas, ideias futuras, regras de negócio, arquitetura, pendências e critérios de aceitação.
>
> **Última revisão:** 18/11/2026  
> **Natureza:** projeto real em desenvolvimento; funcionalidades ainda não homologadas não devem ser apresentadas como prontas.  
> **Referência de código desta revisão:** versão 1.0 (branch feat/versao-1, publicada na main em 18/11/2026).  
> **Manutenção:** atualizar este arquivo sempre que uma decisão ou funcionalidade mudar. O código e o esquema real do Supabase prevalecem para descrever o que *existe*; este documento prevalece para descrever o que *se pretende construir*, salvo decisão posterior explícita.

---

## 1. Identidade, propósito e princípio do produto

**Nome:** Retaguarda Food Service.  
**Objetivo:** plataforma web modular de retaguarda para operações de alimentação com múltiplas lojas, capaz de centralizar cadastros corporativos na Matriz e dar a cada unidade uma rotina operacional própria, consistente, auditável e fácil de usar.

É uma solução **independente de outras empresas/protótipos**. Não renomear, misturar ou migrar inadvertidamente projetos de terceiros, outras aplicações da conta ou implementações legadas.

### Resultado pretendido

- Matriz consegue administrar catálogo, fornecedores, usuários/permissões e acompanhar necessidades das lojas sem ter de entrar em cada uma.
- Loja registra contagens, listas, notas de entrada, compras, transferências, perdas e fechamentos de CMV, com fluxos claros e rápidos.
- Cada unidade enxerga e altera **somente os dados autorizados**, sem vazamentos ou registros cruzados.
- Regras de estoque, compras e CMV têm memória de cálculo, rastreabilidade e status bem definidos.
- Uma funcionalidade nasce e é validada na unidade **Teste**; apenas após homologação é liberada individualmente às demais.
- Interface atraente, rápida de interpretar, responsiva e útil no dia a dia — não apenas uma coleção de formulários.

### Princípios de produto

1. **Duas frentes realmente diferentes:** Matriz e Loja têm arquitetura de navegação, aparência, telas iniciais e responsabilidades próprias.
2. **Uma base corporativa, dados transacionais isolados:** catálogo compartilhado quando apropriado; movimentos, documentos, listas e indicadores por loja.
3. **Supabase é a fonte de dados:** NÃO reintroduzir modo demonstração, arrays fictícios, localStorage como banco ou dados estáticos apresentados como reais.
4. **Protótipo com dados reais da unidade Teste:** testes são controlados, não dados artificiais expostos como produção.
5. **Backend manda na segurança:** esconder botão não substitui RLS, permissões, restrições e validações do banco.
6. **Não cadastrar lojas pela retaguarda.** Provisionamento de unidades é uma ação administrativa externa, feita no Supabase.
7. **Sem reescrita desnecessária:** evoluir arquivos e componentes modulares, preservando o que funciona e os demais protótipos.
8. **Sem afirmação falsa de conclusão:** código existente ≠ funcionalidade aprovada; build verde ≠ teste real no navegador.

---

## 2. Infraestrutura e identificadores de referência

| Elemento | Valor / decisão |
| --- | --- |
| Repositório principal | GitHub privado: opewillian/Prototipos |
| Diretório do aplicativo | retaguarda-food-service/ |
| Branch de produção | main |
| Publicação | Cloudflare Pages conectado ao GitHub |
| URL pública | https://retaguarda-food-service.pages.dev |
| Root directory Cloudflare | retaguarda-food-service |
| Comando de build | npm run build |
| Output de build | dist |
| Banco e autenticação | Supabase — projeto Retaguarda MFT |
| Identificador do projeto Supabase | nngcbrqemhnbyqjjdnlh |
| Unidade especial administrativa | stores.id = matriz |
| Unidade real de homologação | stores.id = teste |
| Framework atual | HTML, CSS e JavaScript nativo com ES Modules; sem framework SPA obrigatório |

O frontend usa a URL do Supabase e uma **chave publicável**; nunca usar service_role, sb_secret, senhas, tokens privados ou dados pessoais sensíveis em arquivos versionados.

**Limites invioláveis:** não criar outro repositório, não criar outro projeto Supabase, não sobrescrever outros protótipos de opewillian/Prototipos, não alterar o projeto legado opewillian/MFT, não substituir a implementação atual por um projeto vazio e não quebrar publicação automática.

---

## 3. Jornada de acesso e navegação

1. A URL pública abre a **tela de entrada** com botão **Entrar**.
2. **(Alterado na versão 1.0, 18/11/2026)** A tela inicial já é o login (e-mail e senha, com "Esqueci minha senha"). Justificativa: o usuário pediu a experiência de um usuário real; o botão "Entrar" sem credenciais levava a telas vazias até o login. Antes: Entrar abria a escolha de ambiente sem credenciais.
3. Surge a tela **Selecionar ambiente**, com dois cartões independentes: **Matriz** ou **Loja**.
4. Para acessar informações reais, é exigido **login verdadeiro via Supabase Auth**, e as permissões da sessão são consultadas.
5. Escolha **Matriz**: abre painel e menu administrativos próprios.
6. Escolha **Loja**: escolher uma loja operacional autorizada (hoje, Teste) e abrir painel e menu da unidade.
7. É possível trocar de ambiente, selecionar outra unidade autorizada e sair; sair deve encerrar sessão real quando aplicável.

**Decisão confirmada:** a conveniência do primeiro botão sem credenciais NÃO autoriza usar as tabelas sem login. Se houver alteração de UX, preservar autenticação e RLS para dados reais.

### Matriz — responsabilidade e identidade

- Administração corporativa, consolidação e configuração.
- Menu lateral administrativo, identidade própria em grafite/cobre, painel com visão de unidades.
- Áreas visíveis: Painel da Matriz, Configuração inicial, Unidades, Itens, Fornecedores, Usuários e perfis, Pedidos das lojas.
- **Unidades: consulta/somente leitura**; não mostrar "Nova loja", "Editar loja" nem "Excluir loja".
- Usuário matrix_admin tem acesso corporativo condicionado às regras do banco.
- Pedidos das lojas: hoje acompanhamento/consulta; gestão central de status é objetivo de evolução e precisa ser implementada e testada antes de anunciar como disponível.

### Loja — responsabilidade e identidade

- Execução da rotina operacional de **uma unidade por vez**.
- Seleção de unidade autorizada; menu horizontal e identidade própria em tons de verde.
- Áreas: Visão da loja, Contagem, Listas, Notas fiscais, Pedidos de compra, Transferências, Perdas, CMV.
- **Não criar módulo Estoque separado**; estoque é resultado de contagens e movimentos, não uma aba independente.
- Operações devem sempre usar contexto de loja na consulta, criação, edição e vínculos entre documentos.

---

## 4. Mapa arquitetural dos arquivos

> **Versão 1.0 (18/11/2026) — estrutura atual.** Substitui o mapa conceitual abaixo, mantido como histórico.
>
>     index.html                      # fontes Inter/Montserrat, app.css + shell.css
>     assets/app.css                  # tokens da marca MFT e componentes
>     assets/shell.css                # login, escolha de ambiente, menus Matriz (grafite) e Loja (vinho)
>     assets/brand/logo-mft.png       # logo oficial
>     src/main.js                     # sessão, contexto (perfil, vínculos, lojas, flags) e rotas por hash
>     src/core/  config, supabase, db (list/get/insert/update/remove/nextNumber), format, icons, ui (componentes, drawer, diálogo, toast)
>     src/areas/access.js             # login, nova senha, escolha de ambiente
>     src/areas/matriz/shell.js       # menu da Matriz + registro dos módulos
>     src/areas/loja/shell.js         # barra da loja + módulos visíveis conforme store_feature_flags
>     src/modules/matriz/  painel, pedidos, itens, fornecedores, unidades, usuarios
>     src/modules/loja/    inicio, contagem, listas, pedidos, notas, transferencias, perdas, cmv
>     src/modules/shared/  catalog (itens, saldos, custo), doclines (linhas de documento), demand (consumo e sugestão)
>     docs/sql/            01-anexos-storage.sql, 02-limpar-dados-teste.sql, 03…07 (CGH, marca/tipo, importação de itens, marcas) (executar como admin no Supabase)
>
> Rotas: `#/matriz/<módulo>[/<id>]` e `#/loja/<loja>/<módulo>[/<id>]`. Cada módulo exporta `render(ctx)`.
> `npm run test` e `npm run build` validam sintaxe, imports e arquivos obrigatórios (os testes de interface do protótipo foram removidos a pedido do usuário).

Estrutura conceitual atual, a ser mantida e evoluída:

    retaguarda-food-service/
    ├── CEREBRO.md                   # ESTE documento-mestre
    ├── README.md                   # Introdução e links
    ├── index.html                  # Entrada do site
    ├── package.json                # Scripts de validação/build
    ├── scripts/
    │   ├── build.mjs
    │   └── check-areas.mjs
    ├── assets/
    │   ├── styles.css
    │   ├── areas.css
    │   ├── matrix.css
    │   ├── store.css
    │   ├── entry.css
    │   ├── operational.css
    │   └── setup.css
    ├── src/
    │   ├── main.js                 # Estado e fluxo de navegação
    │   ├── areas/
    │   │   ├── selection.js        # Matriz x Loja; selecionar unidade
    │   │   ├── shared.js           # Acesso e ações compartilhadas
    │   │   ├── matriz/             # config.js, layout.js, data.js, home.js
    │   │   └── loja/               # config.js, layout.js, home.js
    │   ├── core/
    │   │   ├── config.js
    │   │   ├── supabase.js
    │   │   ├── api.js
    │   │   ├── write-api.js
    │   │   ├── models.js
    │   │   ├── features.js
    │   │   ├── feature-map.js
    │   │   └── format.js
    │   ├── components/
    │   │   ├── entry.js
    │   │   ├── layout-independent-components
    │   │   ├── table.js
    │   │   └── editor.js
    │   └── modules/
    │       ├── configuracao/
    │       ├── lojas/
    │       ├── matriz/             # Itens do catálogo
    │       ├── fornecedores/
    │       ├── usuarios/
    │       ├── contagem/
    │       ├── listas/
    │       ├── notas-fiscais/
    │       ├── pedidos-compra/
    │       ├── transferencias/
    │       ├── perdas/
    │       └── cmv/
    └── docs/
        ├── ARQUITETURA.md
        ├── AMBIENTES.md
        ├── SUPABASE.md
        ├── OPERACAO.md
        ├── PRECONFIGURACAO.md
        ├── ENTRADA.md
        └── CLOUDFLARE.md

A linha layout-independent-components acima é apenas **descrição conceitual**, não um arquivo a criar; conferir sempre a árvore real. Cada nova regra de negócio deve morar no módulo que lhe pertence ou no core compartilhado, evitando transformar main.js num sistema monolítico.

**Padrão de mudança:** manter uma pasta por módulo; separar componentes, serviço de dados, esquema/validação e regras de cálculo conforme a complexidade crescer. Não duplicar código com divergência entre Matriz e Loja.

---

## 5. Supabase — modelo de multiunidades

**Escolha arquitetural:** um único projeto Supabase com isolamento lógico e de autorização por loja. **Não** criar um projeto Supabase individual para cada loja.

### Domínios compartilhados da Matriz

- stores: cadastro de unidades provisionadas externamente; na retaguarda, somente leitura.
- brands: marcas (cadastro central da Matriz).
- items: catálogo central de produtos e insumos; código, nome, tipo (item_type), marca (brand_id → brands; brand texto legado), categoria (legado), unidade-base, custo padrão, estoque mínimo, ativo, composes_cmv.
- suppliers: fornecedores corporativos, cadastro central.
- store_item_suppliers: vínculo específico **loja × item × fornecedor**, com múltiplos fornecedores possíveis por item e por loja; preferência e condições locais.
- user_profiles, store_memberships e user_tab_permissions: identidade, associação usuário/loja, papéis e permissões por aba.
- store_feature_flags: liberação técnica gradual por loja e funcionalidade.

### Domínios operacionais segregados por loja

| Domínio | Tabelas principais |
| --- | --- |
| Listas | purchase_lists, purchase_list_items |
| Contagens | stock_counts, stock_count_items |
| Pedidos | purchase_orders, purchase_order_items |
| Notas | invoices, invoice_items, invoice_payments, invoice_attachments, payment_attachments |
| Transferências | transfers, transfer_items |
| Perdas | losses, loss_items |
| Estoque/movimentações | stock_movements; views store_stock_balance, store_last_purchase_cost |
| CMV | cmv_closings, cmv_closing_items |
| Auditoria e estado | audit_events, app_store_state |

- Cada registro transacional tem store_id ou, na transferência, from_store_id/to_store_id.
- Chaves estrangeiras compostas (identificador do documento + loja) evitam vínculo cruzado entre linhas de documentos distintos.
- RLS habilitado nas tabelas operacionais; views de saldo e custo com security_invoker quando aplicável.
- Administração de outras unidades requer autorização no backend, não apenas mudança visual de dropdown.
- Dados consolidados da Matriz devem ser consultas agregadas sobre registros autorizados; nunca copiar documentos entre lojas para consolidar.

### Proteção de cadastro de lojas

- A tabela stores aceita SELECT para usuários autenticados autorizados.
- INSERT, UPDATE e DELETE de stores foram revogados dos papéis comuns da retaguarda.
- Não reintroduzir formulário nem endpoints de criação de lojas no frontend.
- Provisionamento de uma nova loja ocorre **fora da plataforma**, em ação administrativa do Supabase, seguido de concessão de permissões e liberação seletiva de recursos.
- A unidade matriz é administrativa; jamais gravar contagens, compras ou notas operacionais sob store_id=matriz.

### Unidade Teste — política de homologação

- Teste é **unidade real** no banco: id=teste, code=TESTE, store_type=operational.
- Sua existência não significa massa fictícia importada.
- Inicialmente apenas Teste recebeu flags habilitadas; demais lojas futuras não recebem escrita automaticamente.
- A Teste não é um projeto Supabase separado: erros de esquema, gatilhos e funções compartilhadas podem impactar outras unidades mesmo quando a escrita está restrita. Fazer migrações com cautela e transações.
- O catálogo global é compartilhado; **alterações em items/suppliers podem afetar todas as lojas** e devem ser testadas/planejadas como mudança corporativa.
- Transferências não devem movimentar estoque de lojas de produção durante homologação; exigir liberação também no destino.

### Loja Teste → Congonhas (CGH)

**Execução: 18/11/2026 — concluída no Supabase Retaguarda MFT** (`nngcbrqemhnbyqjjdnlh`).

- **Identidade preservada:** `public.stores.id = 'teste'` não foi alterado. A unidade de homologação agora se chama **Congonhas**, código **CGH**, tipo `operational`, `active = true`. Não trocar o ID por `cgh`: documentos, endereços/rotas e vínculos do aplicativo continuam referenciando `teste`.
- **Limpeza realizada:** executado `docs/sql/02-limpar-dados-teste.sql` em transação. Antes do COMMIT houve simulação com ROLLBACK: `contagens = 0`, `notas = 0`, `itens_teste = 0`. A execução definitiva foi confirmada e uma nova consulta fora da transação verificou os mesmos zeros.
- **Dados removidos:** documentos, linhas e movimentações operacionais da unidade `teste`; catálogo de teste `items.code LIKE 'TST-%'` (2 itens), fornecedor `TST-F1` (1 fornecedor) e vínculos associados; eventos `audit_events.store_id = 'teste'` e `action = 'teste_log'`. Após a limpeza, nenhum desses cadastros ou eventos de teste permaneceu. A alteração de `session_replication_role` foi local à transação, sem modificar permanentemente gatilhos.
- **Renomeação realizada:** transação `UPDATE public.stores SET name='Congonhas', code='CGH', updated_at=now() WHERE id='teste'`, validada com ROLLBACK antes da execução definitiva com COMMIT. O arquivo `docs/sql/03-renomear-teste-para-cgh.sql` não estava presente no repositório no momento da execução; aplicou-se o SQL explicitamente aprovado para a etapa.
- **Verificação posterior:** `matriz` permaneceu `MATRIZ / Loja matriz / matrix / active`; `teste` ficou `CGH / Congonhas / operational / active`. As **10** linhas de `store_feature_flags` da unidade permaneceram habilitadas e o vínculo `store_memberships` com papel `store_manager` permaneceu ativo. Nenhuma outra loja foi modificada; sem alterações de RLS, funções ou gatilhos.
- **Orientação de continuidade:** menções históricas a **Teste** neste documento referem-se à **mesma unidade** de homologação, hoje chamada **Congonhas (CGH)** e ainda identificada internamente por `teste`. Para reverter apenas a identificação visual: `UPDATE public.stores SET name='Teste', code='TESTE' WHERE id='teste';`. A limpeza dos dados não é revertida por esse UPDATE.

### Unidades do Everest (20/11/2026, `docs/sql/12-unidades-everest.sql`, executado)

- Todas as **109 empresas do Everest** estão em `stores`: 108 operacionais + a Matriz (empresa 1, MFT-OLI-ADM, nome mantido). Lista de origem: `Documents/MFT/dados/everest_empresas_20-11-2026.tsv` (janela "Alterar Empresa" do Everest).
- Colunas novas em `stores`: `everest_code` (código da empresa, único), `cnpj`, `city`, `uf`. Status = `active` (todas ativas).
- Nome = Fantasia do Everest; código = Fantasia (ou Fantasia-<empresa> quando a Fantasia se repete: 21 nomes duplicados, ex. DEL-NAT-CHE 58/80, DEL-BSB-NOR 69/3278 — provável CNPJ antigo × novo; conferir quais inativar). `id` = código em minúsculas; a Congonhas continua `id='teste'` e virou **DEL-CGH-PUB** (empresa 57).
- Marcas pelo prefixo: DEL DeltaExpresso (59), SAL Salch&Pão (14), BIT Bitte Burger (10), BOL Boleria das Marias (3), CPQ Casa do Pão de Queijo (3), AVI Aviador (1). **Sem marca: ACB (17) e MFT-CVD-EST (1)** — nome da marca ACB pendente.
- Lojas novas **sem módulos liberados** (`store_feature_flags`) e **sem usuários** (`store_memberships`): ninguém grava nelas até liberar. Só a CGH tem flags.
- **DEL-VCP-C15** (empresa 36, Campinas, DeltaExpresso) liberada em 20/11/2026 para testar transferências com a CGH (`13-liberar-del-vcp-c15.sql`): copia da CGH 10 módulos, 1 usuário e 7 permissões.

### Feature flags

Tabela: store_feature_flags (store_id, feature_code, enabled).

Códigos de operação: counts, lists, notes, orders, transfers, losses, cmv. Códigos de suporte: catalog, stock, api.

- Verificar flag antes de habilitar **gravação no frontend**, mas também aplicar no banco.
- mft_private.has_tab_access exige flag habilitada para gravações; respeita matrix_admin ou associação/permissão adequada.
- Permissões de leitura podem continuar disponíveis mesmo quando a escrita do módulo está bloqueada.
- As flags só podem ser administradas por infraestrutura autorizada no Supabase; não criar editor irrestrito de flags na retaguarda.
- **Flag true significa habilitado para testes, NÃO homologado em produção.**
- Registrar homologação, versão, testes e aprovação antes de replicar flags a outras lojas.

---

## 6. Autenticação e autorização

- Autenticação real com Supabase Auth (e-mail/senha).
- A entrada visual "Entrar" é somente navegação para escolher ambiente.
- Não oferecer bypass de autenticação, cadastro público de matrix_admin, service_role no browser ou confiança em dados editáveis da sessão para definir privilégios.
- Papéis previstos no banco: matrix_admin, store_manager, store_operator, viewer.
- Controle granular por loja e aba via user_tab_permissions (can_view/can_edit).
- Unidade Matriz: acesso administrativo exige vínculo ativo com papel matrix_admin.
- Loja: listar apenas lojas autorizadas pelo banco; consultar e gravar somente seu escopo permitido.
- Atualização de papel/permissões deve ser auditável.
- Não declarar gestão visual de usuários pronta: a tela atual é essencialmente de consulta.

---

## 7. Escopo funcional completo — Matriz

### 7.1 Painel administrativo

**Atual:** painel inicial com indicadores simples de unidades, itens, fornecedores e pedidos consultados.

**Visão-alvo:** cartões rápidos, pendências operacionais por loja, pedidos aguardando aprovação/andamento, unidades com atrasos, comparações entre lojas, alertas relevantes e atalhos para gestão.

Regras:
- Cada indicador com conceito e período explícitos.
- Não inventar faturamento, CMV ou número de pedidos.
- Não apresentar amostra limitada (ex.: 200 registros recentes) como total global do banco.
- Visual limpo, rápido, escaneável; tabelas e filtros úteis.

### 7.2 Unidades

**Decisão final:** listar e consultar unidades autorizadas; sem criar, editar, excluir ou ativar unidades pela retaguarda. Novas lojas via Supabase administrativo.

### 7.3 Itens

- Código, nome, **tipo**, **marca**, unidade, custo padrão, estoque mínimo, ativo/inativo (status).
- **Unidades (20/11/2026):** só `un` (unidade), `kg` (quilo) e `l` (litro) — regra `items_base_unit_check` no banco (`10-unidades-un-kg-l.sql`, executado). Convertidos: 1000491 PAÇOCA ROLHA 550G g→kg; 2000263 SACO VIAGEM DELTAEXPRESSO pct→un. Hoje: un 196, kg 40, l 11.
- **Tipo** (20/11/2026) substitui categoria: Matéria-prima, Revenda, Embalagem, Produto acabado, Uso e consumo, Outras, Ativo imobilizado (check em `items.item_type`). `category` segue no banco só como legado; Contagem e Listas usam `item_type` com fallback para `category`.
- Colunas `brand` e `item_type` criadas por `docs/sql/04-itens-marca-tipo.sql`; a tela de Itens só grava depois desse SQL rodar.
- Migração do Everest: `05-importar-itens-cgh.sql` (247 itens "Sim" da CGH, emp 57) e `06-importar-itens-cgh-avaliar.sql` (91 "Avaliar"), origem `Documents/MFT/ITENS_CGH_EVEREST.xlsx`; pulam códigos já cadastrados. Marca vem vazia.
- **Executado em 20/11/2026** (SQL Editor, projeto Retaguarda MFT): 04 aplicado (colunas `brand`, `item_type`, check e índice) e 05 importado. Antes: `items` vazia (0). Depois: 247 itens ativos, 0 sem tipo — Matéria-prima 100, Revenda 82, Embalagem 48, Produto acabado 17. O 06 (91 "Avaliar") **não** foi rodado.
- `items.category` é NOT NULL com default `''`: a tela nova não envia categoria (usa o default).
- **Marcas (20/11/2026):** tabela `brands` (id, name único sem diferenciar maiúsculas, active, created_at, updated_at) criada por `docs/sql/07-marcas.sql` e executada; RLS igual a items (membro lê, admin da Matriz grava). `items.brand_id` → brands(id) (on delete restrict). Tabela vazia; `items.brand` (texto) fica como legado. Tela **Matriz › Cadastros › Marcas** (`src/modules/matriz/marcas.js`, permissão do módulo Itens/`catalog`): lista com nº de itens por marca, criar/editar/inativar (sem excluir). No item, a Marca é um seletor de `brand_id` (marcas ativas + a atual) com botão "Nova" que cadastra e já seleciona. Nome duplicado → "Já existe uma marca com esse nome."
- **Marca da loja e marca global (20/11/2026, `docs/sql/08-marca-global-e-loja.sql`, executado):** `brands.is_global` (no máximo uma, índice `brands_one_global`) e `stores.brand_id`. Marcas: **Global** (global) e **DeltaExpresso** (cadastrada pela tela). CGH (`teste`) → **DeltaExpresso** (`09-cgh-marca-deltaexpresso.sql`, executado); a "Delta Expresso" criada pelo 08 ficou **inativa** (sem itens nem lojas; não apagada). A marca da loja é definida só por SQL (regra: lojas não se editam pela UI).
- **Regra de visibilidade:** a loja só usa itens da marca dela + da marca global; **item sem marca não aparece em loja nenhuma**; loja sem marca vê só a global. Implementado em `loadItems({store})` (`shared/catalog.js`): itens fora da marca voltam como `active:false,_offBrand:true` — somem das escolhas (listas, contagem, pedidos, notas, perdas, transferências, início) mas documentos antigos ainda acham o nome pelo id. CMV usa `loadItems()` sem filtro. Busca por código digitado agora também ignora itens inativos/fora da marca.
- Os 247 itens importados estão **sem marca** (o Willian vai mandar a lista de qual marca é cada item); até lá a CGH não vê itens.
- Flag **compõe CMV** por item.
- Cadastro corporativo; parametrização de fornecedor conforme loja.
- Custo padrão é **fallback** quando ainda não existir compra/nota recebida.
- Não mostrar custo de nota inexistente como se tivesse sido comprovado.
- Histórico de alterações, importação e validação de unidades são extensões futuras.

### 7.4 Fornecedores e vínculos

- Razão social/nome, código, documento, telefone, e-mail, ativo.
- Mesmo item pode ter mais de um fornecedor na mesma loja e fornecedores diferentes entre lojas.
- A relação item × loja × fornecedor é central para pedidos e comparação de preços.
- Interface específica para atribuir fornecedor às lojas e marcar preferencial está **pendente**.

### 7.5 Integração de compras

**Visão-alvo:** centralizar pedidos de todas as unidades, filtrar por unidade, fornecedor, data, status, usuário e valor; acompanhar/fazer transições permitidas: Realizado, Realizando, Cancelado (respeitando o conjunto de status real do banco).

**Atual:** visão de pedidos da Matriz com consulta; edição central, agrupamento e integração ainda pendentes.

### 7.6 Usuários e perfis

- Gestão por loja, aba e papel; permissões can_view/can_edit.
- Usuário com acesso a várias lojas quando expressamente autorizado.
- Cadastro de usuários sem autoaprovação de administradores.
- Tela de gestão completa com fluxo de convite, edição, revogação e auditoria: planejada; não implementada plenamente.

---

## 8. Escopo funcional completo — Loja

### 8.1 Painel da loja

- Resumo rápido de contagens, notas, pedidos, alertas e CMV.
- Somente dados da loja selecionada.
- Mostrar período, origem e limites de consulta em métricas.
- Estados vazios honestos; sem placeholder apresentado como fato.
- Navegação direta para cada rotina.

### 8.2 Listas de contagem e compras

- **20/11/2026:** arrastar pela alça (⋮⋮) muda a posição do item na lista (mouse e toque); ao soltar grava `purchase_list_items.sort_order` só das linhas que mudaram. Desligado enquanto a busca está preenchida. Animação: o item levanta (sombra, leve aumento) e segue o ponteiro; as outras linhas deslizam (FLIP) e ao soltar ele assenta na posição.
- **Listas são só de contagem (20/11/2026):** sai o "Usar em" (contagem/compra/ambos) e a coluna "Uso". Novas listas gravam `list_type='count'` (coluna mantida no banco). Contagem oferece todas as listas ativas. **Pedido de compra não usa mais lista**: nasce da contagem de referência (ou vazio, para incluir itens à mão); pedidos antigos com `list_id` continuam recalculando pela lista.

- **Filtros em uma linha (20/11/2026, `src/core/filters.js`):** `filterBar`/`bindFilters` — busca, selects, período (de/até) e "Limpar", com contagem e soma do que está filtrado; filtra na tela. Usado em Transferências (direção, situação, loja), Contagens (situação) e Perdas (motivo, situação); nessas três telas os cards de resumo saíram e a barra não mostra contagem/soma. Se não couber, a barra rola para o lado.
- **Sem recarregar ao adicionar (20/11/2026):** na lista, adicionar/remover item atualiza só a tela (sem buscar tudo de novo), mantém a busca e devolve o foco ao campo. `ctx.reload()` em todas as telas passou a ser "suave": não mostra o esqueleto nem volta ao topo (`softReload` em `main.js`).
- **Sugestões ao digitar (20/11/2026, `src/core/suggest.js`, ligado em `main.js`):** todo `<input list>` do sistema (adicionar item em Listas, Contagem, Pedidos, Notas/Perdas/Transferências e vínculo de fornecedor) troca a lista nativa por uma lista própria: procura por partes do nome ou código, sem acento, até 40 resultados (começa-com primeiro), ↑ ↓ Enter Esc e toque; ao escolher dispara Enter, que cada tela já usa para adicionar.
- **Planilhas (20/11/2026, `src/modules/loja/listas-planilha.js`):** *Importar planilha* (na tela de Listas cria lista nova; dentro de uma lista acrescenta itens) lê .xlsx/.xls/.csv, reconhece cabeçalho "Código"/"Nome" (sem cabeçalho = 1ª coluna é código), casa por código (sem zeros à esquerda) e depois por nome, mantém a ordem, ignora repetidos e mostra antes de gravar o que não foi achado ou não está liberado para a loja (marca/inativo). *Exportar planilha* gera .xlsx com Ordem, Código, Nome, Tipo, Unidade (mesmo formato aceito na importação). Biblioteca SheetJS 0.20.3 (cdn.sheetjs.com), carregada só ao usar.

- Lista vinculada à loja, nome, tipo: contagem, compra ou ambos, status ativo.
- Itens selecionados do catálogo central, organizados e pesquisáveis.
- Evitar item duplicado dentro da mesma lista.
- Permitir reutilizar listas em novas contagens e pedidos.
- Exportação/importação com regras restritivas e validação — a definir por fluxo.
- Impressão da lista com nome, unidade e espaço para quantidade manuscrita.
- Lista pertencente à unidade A não aparece na unidade B, mesmo com itens iguais.
- **Pendência crítica:** selecionar uma lista deve **carregar todos os seus itens** no documento de contagem/pedido, e incluir novos itens de outra lista sem apagar os existentes.

### 8.3 Contagem

- **Nova contagem (20/11/2026, `11-contagem-por-lista.sql` executado):** ao abrir, **todos os itens liberados para a loja** já são linhas (não precisa lista). Colunas (nesta ordem): Item e Unid. (travadas ao rolar), Total, **Padrão** (quantidade digitada na tela; antes "Quantidade"), **uma coluna por lista** adicionada e **Total** (= soma). Botão **Adicionar via lista** abre uma janela: escolhe a lista, aparecem os itens dela (só os liberados) com Unid. e Quantidade; Salvar grava e cria a coluna com o nome da lista. Clicar no título da coluna reabre a janela para editar; apagar todas as quantidades da lista tira a coluna. Banco: `stock_counts.list_columns` (jsonb `[{id,name}]`) e `stock_count_items.parts` (jsonb `{manual, <list_id>}`); `counted_quantity` = total, então estoque/pedidos/CMV não mudam. Custo não aparece mais na tela: `unit_cost` = última compra (ou custo padrão) no momento de gravar. Sem formulário de "Nova contagem": o botão cria o rascunho com a data de hoje e abre a contagem; **Data da contagem** e **Observações** ficam no topo da contagem e gravam ao sair do campo. Saíram "Carregar itens de uma lista", "Incluir item avulso" e o × de remover (apagar a quantidade = não contado).

- Data da contagem, ID amigável e simples, status rascunho/finalizada/cancelada conforme banco.
- Cada linha com item, quantidade, custo unitário, total e ação remover X enquanto editável.
- **Zero é contagem válida; vazio é item NÃO contado**. Não converter vazio em zero automaticamente.
- Aceitar números decimais e validar não negativos.
- Ao selecionar lista, acrescentar itens ausentes sem duplicação.
- Custo unitário = última nota recebida **da mesma loja**; se inexistente, fallback do custo padrão do item.
- Valor total por linha e estoque total; permitir revisão antes de finalizar.
- Finalizada fica bloqueada; gatilho do banco pode gerar ajuste de estoque.
- Não confundir contagem com tela de estoque separada.
- **Restrição do banco:** `counted_quantity` é NOT NULL; itens não contados não viram linha (ficam pendentes só na tela). Mudar isso exigiria migração e revisão do gatilho de ajuste — não fazer sem aprovação.

### 8.4 Notas fiscais

- Número da nota por loja, fornecedor cadastrado, emissão, entrada, chave de acesso, observações.
- Itens com quantidade e custo; vínculos opcionais com pedido de compra.
- Anexos múltiplos: XML/PDF/nota, boletos, comprovantes. Limites físicos e storage a definir.
- Parcelas/formas de pagamento com vencimentos, valores e anexos.
- Recebimento de nota deve gerar entradas de estoque da mesma unidade via gatilho, sem duplicidade.
- Bloquear edições incompatíveis após recebimento.
- **Atual:** esquema e formulários de cabeçalho/itens; interface completa de pagamentos/anexos está pendente.

### 8.5 Pedidos de compra

- **20/11/2026:** sem formulário inicial — "Novo pedido" cria o rascunho (entrega em 2 dias, última contagem finalizada) e já calcula as sugestões; **Entrega prevista, Contagem de referência e Observação** ficam no topo do pedido; trocar entrega ou contagem grava e recalcula.

Fluxo-alvo:

1. Selecionar lista de compra existente da loja.
2. Selecionar contagem de referência e trazer **quantidade contada** por item.
3. Definir data pretendida de entrega.
4. Considerar média vendida/consumida em 10 dias (origem real da informação ainda a definir).
5. Considerar tempo de estoque entre contagem e entrega.
6. Considerar pedidos ainda em aberto realizados após a contagem, sem somar em duplicidade.
7. Calcular uma **sugestão de compra**, com memória de cálculo e alertas de risco.
8. Permitir ajuste manual da quantidade solicitada e custo unitário, com total atualizado.
9. Agrupar por fornecedor e respeitar fornecedor habilitado para a loja e item.
10. Usar filtros digitáveis para localizar itens.
11. Acompanhar estados rascunho, enviado, realizando, realizado e cancelado, conforme restrições do banco.

Regras de UX já decididas:
- Quantidade da contagem deve efetivamente popular o pedido — evitar bug histórico.
- Selecionar pedido deve carregar seus itens **como uma lista editável**, não um formulário solto sem contexto.
- Não incluir coluna redundante de fornecedor na visão Matriz se agrupamento atender melhor.
- Remover coluna "Projeção na entrega"; preferir "?" de ajuda em títulos com regras complexas.
- Priorizar alertas úteis (red flags) e explicações verificáveis.
- **Atual:** cabeçalho, linhas e status genéricos; cálculo inteligente, preenchimentos automáticos, agrupamento e UX final estão pendentes.

### 8.6 Transferências

- **20/11/2026:** sem formulário inicial — "Nova transferência" cria o rascunho (destino = 1ª loja habilitada) e abre a transferência; **Loja de destino, Data da transferência (`transfers.transfer_date`, `14-transferencia-data.sql`) e Observação** ficam no topo e gravam ao sair do campo (trocar destino atualiza `transfer_items.to_store_id`). **Custo unitário não é digitado:** última compra da loja de origem ou custo padrão (`mountLines({fixedCost:true})`). No rascunho, **todos os itens liberados da loja já aparecem** (Item, Unid., Em estoque, Quantidade, Custo, Total): digitar a quantidade grava a linha; vazio ou 0 tira o item. Botão **Imprimir formulário** na lista: folha em branco com todos os itens liberados da loja (item, unidade, quantidade) e campos de destino, data, responsável e recebido por.

- Transferir item entre unidades distintas, com origem/destino, quantidades, custo e status.
- Emissão aprovada gera saída na origem e entrada automática no destino; não duplicar manualmente.
- Não permitir mesma loja como origem e destino.
- **Numeração (20/11/2026):** `transfers.number` é único entre todas as lojas. Novas transferências recebem **código aleatório hexadecimal** de 6 dígitos (ex. TR-7F3A9C) via `insertWithCode` (`core/db.js`), que sorteia de novo se der duplicado. Antigas (TR-0001, TR-0002) seguem como estão. Contagens (CT-) e pedidos (PC-) continuam sequenciais por loja.
- **Rascunho pode ser excluído** (botão Excluir no lugar de Cancelar; apaga itens e transferência, sem mexer em estoque). "Nova transferência" reabre um rascunho vazio da loja em vez de criar outro. Em 20/11/2026 os rascunhos de teste TR-0001…0006 foram apagados (`16-apagar-transferencias-rascunho.sql`). Confirmação de emissão em tópicos (Destino, Data, Itens, Valor + aviso de saldo negativo).
- ~~Conferir estoque disponível antes da emissão~~ — **20/11/2026: não trava mais por estoque** (pedido do Willian). Tela só avisa na confirmação; banco: verificação "Insufficient stock" removida de `mft_private.post_transfer_movements()` por `15-transferencia-sem-trava-estoque.sql` (definição anterior guardada em `mft_private.function_backups`). A origem pode ficar negativa até a próxima contagem.
- Em homologação, evitar transferir da Teste para lojas reais antes de liberação deliberada em **ambas**.
- Registrar origem, destino, usuário, data e memória de movimentação.

### Fornecedores vindos do Everest (20/11/2026, `docs/sql/17-fornecedores-cgh-2026.sql`, executado)

- 29 fornecedores cadastrados em `suppliers`: os que têm NF-e emitida em 2026 para a CGH (empresa 57). Fonte: Everest DFI → Monitor → **Monitor de DANFEs Recebidas** (tem CNPJ do fornecedor, chave de acesso e aba Itens por nota; consulta máxima de 12 meses; filtrar a grade por "CGH-PUB" com a coluna Fantasia visível).
- `code` = código do fornecedor no Everest; `name` = razão social da NF-e (fornecedores do grupo MFT com a fantasia do Everest entre parênteses, ex. "(MFT-OLI-ADM)"); `tax_id` = CNPJ só números. Inclui 4 CNPJs do próprio grupo (OLI-ADM, GIG-DES, BSB-SUL, CVD-EST).
- Exportações guardadas em `Documents/MFT/dados/everest_danfes_57_*.tsv` (747 NF-e jan/2025–nov/2026) e `everest_notas_recebidas_57_2025-2026.tsv`.
- Próximos passos combinados: notas e itens (itens em lote pelo relatório 554 do ADM; o Monitor só mostra itens nota a nota).

### De-para de fornecedores (20/11/2026, `docs/sql/18-depara-fornecedor.sql` executado, `src/modules/matriz/depara.js`)

- Tabela `supplier_item_map`: fornecedor + código do produto na nota (cProd do XML) → nosso item + `factor` (quantas unidades do nosso item, na UM base un/kg/l, vêm em 1 unidade do fornecedor). Também guarda unidade e descrição do fornecedor, observação e ativo. Código único por fornecedor (sem diferenciar maiúsculas). RLS igual a suppliers (membro lê, admin Matriz grava).
- Regra para a entrada automática de notas (a fazer): qtd interna = qtd da nota × fator; custo unitário interno = valor unitário da nota ÷ fator.
- Tela Matriz → Cadastros → **De-para** (permissão "Fornecedores"): filtro por fornecedor/situação, cadastro com frase de conversão e exemplo ao vivo ("nota com 2 CX a R$ 30 → entram 24 un a R$ 2,50"). Na tela do fornecedor, botão "De-para (n)" abre a lista já filtrada (`#/matriz/depara/<fornecedor>`).

### Itens da NF-e e nota de teste (20/11/2026, `docs/sql/19-nfe-itens-e-nota-teste.sql` executado)

- `invoices` ganhou `series`, `total_amount`, `origin` ('everest' quando importada).
- Tabela nova `invoice_nfe_items`: a linha da NF-e como veio (código/descrição/unidade/embalagem do fornecedor, quantidade, valor unitário, desconto, total, CFOP) + o vínculo do Everest (código e nome do item no Everest, quantidade em estoque) + `item_id` (nosso item quando o código do Everest existe em `items`). RLS igual a `invoice_items` (aba Notas).
- Importada 1 nota de teste na CGH (`store_id='teste'`): Sendas/Assaí nº 184284, série 300, 12/11/2026, **pendente** (não mexe no estoque), 21 itens, 6 já ligados a item nosso, 9 sem vínculo nem no Everest. Soma dos itens R$ 1.426,30 × valor da nota R$ 1.355,98 (diferença R$ 70,32, a confirmar).
- Tela da nota mostra o card "Itens da NF-e" (só leitura) com a situação de cada item (ligado / "Falta de-para"). `invoice_items` (entrada no estoque) continua vazio até a conversão pelo De-para.
- **De-para automático na nota (20/11/2026, `20-nfe-depara-automatico.sql`, `src/modules/shared/nfe.js`):** nota com linhas de NF-e mostra "Itens da nota" a partir da NF-e, com símbolo por linha (✓ verde = de-para feito, ! laranja = falta). Ao abrir nota pendente, `syncNfe` cria/atualiza/remove `invoice_items` para cada linha com de-para ativo (qtd = qtd da nota × fator; valor = total da linha; custo = total ÷ qtd) e grava `invoice_nfe_items.invoice_item_id`. Clique na linha abre o de-para: fornecedor, código, descrição e unidade travados (vêm da nota); edita só nosso item, unidade (tem que ser a do cadastro do item; gravada em `supplier_item_map.item_unit`) e conversão. Sem de-para, sugere o vínculo do Everest (item + qtd em estoque ÷ qtd da nota). "Dar entrada" bloqueia enquanto houver linha sem de-para. Gravar de-para exige administrador da Matriz (RLS).
- **Lista de itens (20/11/2026):** colunas símbolo · Código · Nome · Unid. · Qtd · Valor unit. · Valor total. Com de-para mostra o NOSSO item (código, nome, nossa unidade, qtd e custo convertidos; fornecedor em letra pequena); sem de-para mostra o item do fornecedor com símbolo de atenção. Todas as linhas abrem o de-para (editar ou fazer). Rodapé: total dos itens, valor da nota e diferença. "Valor dos itens" da nota = soma de todas as linhas da NF-e.
- **Outros custos da nota (20/11/2026, `21-nota-outros-custos.sql`):** tabela `invoice_other_costs` (tipo: desconto, frete, seguro, outras despesas, IPI, ICMS ST, outro acréscimo/abatimento; valor positivo, o tipo dá o sinal). Card "Outros custos" na nota com conferência: total dos itens + outros custos = total calculado × valor da nota; botão "Lançar diferença como desconto/acréscimo". "Total da nota" no topo = itens + outros custos (pagamentos comparam com ele). Em nota de NF-e os outros custos são **rateados** no custo dos itens (proporcional ao valor da linha; sobra de centavos na maior linha); a tabela mostra o valor unitário da nota e, embaixo, o custo "c/ rateio". Em nota manual não há rateio.
- **Anexos ativados e anexo por parcela (21/11/2026, `22-anexos-e-anexo-da-parcela.sql`):** o bucket `retaguarda-anexos` não existia (o 01 nunca foi executado); agora existe, privado, 15 MB, com políticas por pasta `<store_id>/...` usando `mft_private.has_tab_access` (ler: notes/cmv; enviar/excluir: notes com edição). `invoice_attachments` ganhou `payment_id` (anexo da parcela) e `doc_type` (boleto, comprovante, nota, xml, outro). Cada parcela mostra seus anexos e o botão "Anexar boleto"/"Anexar comprovante" (destacado quando a parcela não tem anexo); caminho `<loja>/<nota>/parcela-<id>/...`. Excluir parcela apaga também os arquivos. O card "Anexos" da nota mostra só os anexos sem parcela. Base para a futura visão de parcelas do financeiro.
- **Marcas dos itens (22/11/2026, `23-marcas-dos-itens.sql`):** marcas definidas pelo usuário na planilha `Documents/MFT/ITENS_RETAGUARDA_MARCAS.xlsx`: 185 itens DeltaExpresso (só lojas da marca), 59 Global (todas as lojas); 4000749 virou "PAO DE QUEIJO GOLD 80G" / Matéria-prima. Os 3 marcados "Excluir" (1000938, 1000164, 1000524) foram inativados, não apagados, e ficaram sem marca. Com isso a CGH passa a enxergar 244 itens no de-para e nas telas da loja.
- **Primeiro de-para real (22/11/2026, nota 184284 Sendas):** 19 de 21 itens ligados em `supplier_item_map` pelo app. Criados 10 itens "Uso e consumo" (marca Global, un, fora do CMV) com o código e nome do Everest: 7000537, 7000007, 7000003, 7000189, 7001155, 7000203, 7000002, 7000004, 7000014, 7000444. 1000491 renomeado para "MP - PACOCA - KG". Conversões de pacote: esponja c/12 = 12, luva c/100 = 100, panos microfibra c/4 = 4 (PANO MULTIUSO), colher c/50 = 50, açúcar cx 400 = 400. Depois: doce cremoso 900g → DOCE DE LEITE 0,9 kg; leite em pó Batavo 400g → 1000466 renomeado "MP - LEITE EM PO INTEGRAL KG" e passado de un para kg (sem movimentos), 0,4 kg. Nota com 21/21 de-para; itens + outros custos = 1.355,98 (bate com a nota).
- **Notas da CGH ago–nov/2026 importadas (22/11/2026, `24-notas-cgh-ago-nov-2026.sql`):** 116 NF-e (emissão 01/08 a 20/11/2026, todas de fornecedores já cadastrados) + 606 linhas em `invoice_nfe_items`, extraídas do Everest (DFI > Monitor de DANFEs Recebidas, aba Itens, uma a uma; bruto em `Documents/MFT/dados/everest_danfes_itens_57_2026-08_2026-11.txt`). Todas PENDENTES (não mexem no estoque). A unique de `invoices` virou `(store_id, supplier_id, invoice_number, series)` nulls not distinct, porque Eurofoods matriz e filial têm a mesma nota 6378. Lista de notas mostra `total_amount` da NF-e quando existe. Após a importação: 46 de 627 linhas já com de-para (Sendas), 231 códigos de fornecedor sem de-para.
- **De-para geral da CGH (23/11/2026, `25-depara-geral-cgh.sql`):** revisado com o usuário (REVISAR e SEM ITEM um a um; os 167 "OK" com as correções sugeridas). 13 itens novos com código e nome do Everest (álcool em gel, brigadeiros chocolate/ninho DeltaExpresso, faca churrasco, CPU PDV, Máquina Miniqool 102 revenda, recibo, estilete, filtro 102, fita, grampo, detergente líquido em litro, bobina térmica). 1000586 tomate assado e 1000476 maionese azeitona passaram de kg para un. Fatores por embalagem (ex.: Red Bull C/24 = 24, copos C/5 CX = 250/500, MU 250G = 0,25 kg, molhos/caldas pelo peso). Resultado: 620 de 627 linhas com de-para; 110 de 117 notas completas. Creme de leite (1000044) passou para **kg** (`26-creme-de-leite-kg.sql`, executado a pedido do usuário em 23/11/2026): a entrada da nota 184284 (recebida) virou 10,8 kg a R$ 13,262 (mesmos R$ 143,23), com os triggers desligados só nessas duas linhas; de-paras: caixinha 200 g = 0,2 kg, caixa C/27 = 5,4 kg. Saldo da CGH: 10,8 kg. Final: 627/627 linhas e 117/117 notas com de-para.
- **Estorno de nota (23/11/2026, `27-estorno-de-nota.sql`, `src/modules/shared/estorno.js`, `src/modules/matriz/notas.js`):** só **administrador da Matriz** (`app.isAdmin` na tela; `mft_private.is_matrix_admin()` no banco). `public.reverse_invoice(p_invoice_id, p_reason)` exige nota recebida e motivo, **bloqueia se a entrada está dentro de um fechamento de CMV salvo** (received_at entre os finalized_at das contagens do fechamento), apaga os movimentos `invoice_receipt` da nota (cópia em `invoice_reversals.movements`, com quem/quando/motivo/valor), devolve a nota para pendente (`received_at`/`received_by` nulos) e grava `audit_events` action `reverse`. O gatilho `post_invoice_receipt` só aceita received→pending quando chamado por essa função (flag de transação `mft.invoice_reversal` = id da nota). Telas: Matriz > **Notas fiscais** (todas as notas de todas as lojas, qualquer situação; KPIs; filtros por loja, situação, fornecedor, busca por número/chave e datas de entrada; Abrir na loja; botão Estornar nas recebidas; histórico de estornos) e botão **Estornar nota** na nota recebida. Nota estornada mostra aviso com data e motivo até receber de novo. Testado na 184284: estorno (21 movimentos, R$ 1.355,94) e nova entrada (21 movimentos, mesmo valor, creme 10,8 kg).
- **Contagens da CGH refeitas (23/11/2026, `28-excluir-contagens.sql`, `29-contagens-cgh-set-out.sql`):** a pedido do usuário, todas as contagens antigas foram excluídas (5 rascunhos vazios + CT-0002 finalizada de teste com 5 ajustes; gatilhos desligados só na transação). Lançadas as duas do Everest: **CT-0001 30/09/2026** (inventário nº1 da 57: 133 itens, R$ 86.714,34) e **CT-0002 31/10/2026** (inventários nº2–4 = planilha de out: 129 itens, R$ 74.400,98, + 21 itens de 30/09 com 0, porque no Everest ficaram zerados). Criadas e finalizadas pelo app; depois `finalized_at` e os ajustes datados em 30/09 e 31/10 23:59 (Brasília) e recalculados contra o saldo daquela data (o gatilho calcula contra o saldo de hoje). Conversões para a unidade do cadastro (valor mantido): 30/09 maionese azeitona 2,4 kg→12 un, tomate 3,21 kg→53,5 un, Ovomaltine 750G inativo 0,3 un→0,225 kg em OVOMALTINE; 31/10 Billy Jack 1 un→0,2 kg, leite em pó 5×200 g→1 kg, queijo ralado 0,1 kg→2,5 un, creme de leite 5,4 un→1,08 kg. Saldo em 31/10 bate item a item com a CT-0002.
- **Contagens da CGH de volta a rascunho + valores na contagem (23/11/2026, `30-contagens-cgh-para-rascunho.sql`):** a pedido do usuário, CT-0001 (30/09) e CT-0002 (31/10) voltaram a **rascunho** (ajustes de estoque delas apagados; gatilhos desligados só na transação). Ao finalizar de novo pelo app, o ajuste será calculado contra o saldo do momento (e a data de finalização será a de agora). Tela da contagem ganhou as colunas **Valor unit.** (custo da linha, até 4 casas; em cinza o custo que será usado se ainda não contado) e **Valor total** (qtd × custo).
- Itens das outras 15 notas mais novas já extraídos do Everest em arquivos (pasta itens/ do scratchpad da sessão), não importados (decisão do Willian: testar com 1 nota).

### 8.7 Perdas

- **20/11/2026:** sem formulário inicial — "Registrar perda" cria o rascunho (data de hoje, motivo vazio; reabre rascunho vazio existente) e abre o lançamento; **Data, Motivo e Detalhe** ficam no topo e gravam ao sair do campo (`losses.reason` = "Motivo — detalhe"). Registrar baixa exige motivo.
- **20/11/2026:** botão **Imprimir formulário** na lista de perdas (como em Transferências): folha em branco com todos os itens liberados para a loja, colunas quantidade e motivo (nº da legenda), cabeçalho com loja, data e responsável. O **custo unitário** não é mais digitado: vem da última compra da loja ou do custo padrão do item (`mountLines` com `fixedCost`).

- Registrar perda por motivo, data, itens, quantidade, custo e status.
- Tipos usuais: validade, quebra, avaria, descarte (taxonomia a detalhar).
- Registro aprovado gera redução de saldo com rastreabilidade e validação de estoque disponível.
- Nunca esconder perda no cálculo de custo ou duplicar seu efeito.

### 8.8 CMV

Fechamento selecionado por datas/contagens de estoque; histórico mensal e períodos personalizados.

**Conceito-base:** CMV físico do período = Estoque inicial + Compras líquidas elegíveis - Estoque final.

- Estoque inicial: contagem inicial finalizada.
- Compras líquidas: notas/entradas elegíveis dentro do intervalo, **somente itens com composes_cmv=true**, com devoluções/estornos conforme regra futura aprovada.
- Estoque final: contagem final finalizada.
- Perdas: evidenciar separadamente, com conciliação; definir se segregam parte do CMV sem **subtrair duas vezes** algo que já reduziu estoque final.
- Considerar eventos de transferência entre unidades de forma coerente, sem inflar compras.
- Memória de cálculo por item, documento, período e origem; auditoria e possibilidade de comparação entre fechamentos.
- Preço do estoque: última compra válida da unidade com fallback do cadastro quando necessário, com identificação da fonte.
- **Atual:** leitura de fechamentos existentes; geração automática completa, visual de memória e regras de conciliação ainda pendentes.

---

## 9. Estados dos documentos e integridade operacional

Estados atuais do banco (nomes técnicos):

| Documento | Estados |
| --- | --- |
| Contagem | draft, finalized, cancelled |
| Nota fiscal | pending, received, cancelled |
| Pedido de compra | draft, sent, realizing, realized, cancelled |
| Transferência | draft, issued, cancelled |
| Perda | draft, recorded, cancelled |

- A transição de status deve obedecer gatilhos/regras reais e não simplesmente sobrescrever uma coluna.
- Após status terminal, bloquear edição indevida do documento e das linhas relacionadas.
- Gatilhos atuais processam ajuste de estoque na contagem finalizada, entrada na nota recebida, saída/entrada na transferência emitida e redução de saldo na perda registrada.
- Transações críticas devem ser atômicas e idempotentes; nenhuma duplicação de stock_movements.
- Não testar finalizações sobre dados de outras lojas.
- Validar efeito no estoque após cada ação, inclusive tentativa de ação repetida, rollback, conflitos e falta de saldo.

---

## 10. Situação real da implementação — corte em 18/11/2026

### Confirmado

- Repositório existente no GitHub, sem criar outro.
- Cloudflare Pages publicado e configurado para build automático na main.
- Projeto Supabase Retaguarda MFT conectado ao frontend.
- Primeiro administrador real provisionado no Auth/perfil e vínculo com Matriz.
- Unidade administrativa matriz e unidade operacional teste.
- Separação visual e estrutural entre ambientes Matriz e Loja.
- Navegação de entrada, seleção de ambiente, seleção de unidade e menus específicos.
- Componentes genéricos para consulta, formulários de cabeçalho, inclusão/exclusão de linhas e alguns status.
- Remoção do modo demonstração e arquivos de fixtures do fluxo ativo.
- Bloqueio do cadastro de lojas no frontend **e** revogação de escrita em stores para usuários comuns.
- Isolamento de tabelas transacionais por loja, RLS, relações compostas e liberação por store_feature_flags.
- GitHub Actions com execução aprovada após as mudanças de Supabase exclusivo (referência de 18/11: run 44211736893).

### Implementado parcialmente — não declarar pronto

- Formulários genéricos: não cobrem toda validação, fluxo de edição de linhas e UX de cada módulo.
- Matriz/usuários: consulta, mas gestão completa de convites e permissões ainda não feita.
- Fornecedores por item/loja: esquema existe, tela própria e regras de seleção ainda não concluídas.
- Listas → contagem: carregamento com merge implementado em 18/11 (em teste na Teste). Listas → pedidos: a construir.
- Pedido de compra inteligente e vínculo automático com contagem: pendentes.
- Notas fiscais com anexos, parcelas e comprovantes: pendentes.
- Fechamento CMV com memória de cálculo: pendente.
- Gestão central de estados de pedidos na Matriz: pendente.
- Testes reais completos de login, gravação, importação, emissão, estoque, autorização multiusuário e deploy público: ainda exigem roteiro e evidências funcionais.

### Estado dos dados

A última inspeção da unidade Teste mostrou a loja provisionada e **sem itens, listas, notas, contagens e pedidos cadastrados automaticamente**. Tratar contagens de registros como fotografia daquela inspeção; consultar o Supabase de novo antes de afirmar que o banco continua vazio.

### Riscos e atenção

- Loja Teste e lojas futuras dividem o **mesmo esquema e as mesmas funções SQL**. Alterações globais devem ser revisadas com cuidado.
- As flags habilitam escrita na Teste, mas alguns recursos estão incompletos; não usar a flag como selo de qualidade.
- Catálogo central pode afetar todas as lojas quando houver mais unidades.
- Consultas limitadas a 200/500 registros não devem ser apresentadas como totais completos.
- Estoque, recebimento e CMV precisam de testes de integridade transacional.
- Visibilidade via menu não é autorização.
- Revisar fluxo real de login e evento de sessão para evitar consulta com usuário não autenticado.

### Auditoria técnica de 18/11/2026 (segunda sessão)

**Como foi feita:** leitura integral do código, `npm run test`/`npm run build`, comparação do site publicado com o HEAD da main (idênticos), sondagem da API REST com a chave publicável sem login e navegação no site publicado pelo Chrome.

**Limites desta auditoria (não inventar resultados):**
- Não houve login: a IA não digita senhas. Fluxos autenticados (Matriz, Loja Teste, gravações, status, gatilhos) **não foram testados no navegador**.
- O conector Supabase disponível na sessão pertence a outra conta; o esquema, as políticas RLS, os gatilhos e a contagem de registros do projeto `nngcbrqemhnbyqjjdnlh` **não foram inspecionados**. Os nomes de colunas usados no código não foram confrontados com o banco.

**Verificado:**
- Sem login, todas as tabelas e views (stores, items, suppliers, listas, contagens, pedidos, notas, flags, perfis, vínculos, saldo, último custo) respondem `permission denied` ao papel anon.
- Tela de entrada, escolha de ambiente e tela de login da Loja carregam sem erros de console.
- CI (GitHub Actions) verde nos últimos runs; build executa testes.

**Diagnóstico por módulo (código):**

| Módulo | Situação |
| --- | --- |
| Entrada / ambientes / login | Implementado; login real não testado nesta sessão |
| Matriz · Painel, Unidades, Usuários, Pedidos | Somente consulta; contagens limitadas a 200 registros |
| Matriz · Itens e Fornecedores | CRUD genérico; sem busca/filtro, sem vínculo item × loja × fornecedor |
| Listas | Cabeçalho + incluir/remover itens (bloqueia duplicado no front); sem busca, impressão ou reutilização |
| Contagem | Linhas manuais; **não carrega lista**, **custo não vem da última nota**, sem total da contagem, sem edição de linha |
| Pedidos de compra | Campos de lista/contagem existem mas **não carregam itens**; sugestão não calculada; status sem ordem de transição |
| Notas fiscais | Cabeçalho + itens; sem pagamentos/anexos; recebimento depende de gatilho não verificado |
| Transferências | Cabeçalho + itens; colunas mostram IDs das lojas |
| Perdas | Cabeçalho + itens |
| CMV | Somente leitura de fechamentos; geração não implementada |

**Correções aplicadas (branch fix/auditoria-estabilidade):**
1. Checkboxes "Compõe CMV" e "Ativo/Ativa" estavam **sem rótulo** (função `bool` chamada sem label).
2. Total da linha do pedido usava a quantidade **contada** quando preenchida; agora usa a **solicitada** (`lineQuantityField` em models.js).
3. Editar uma transferência pela loja destino sobrescrevia `from_store_id` com a loja atual; agora a loja do documento é preservada na edição (vale também para `store_id`).
4. Renovação automática do token (TOKEN_REFRESHED) e INITIAL_SESSION recarregavam a tela e **fechavam formulários abertos**; agora só há recarga quando o usuário muda (login/logout), chamada fora do callback de autenticação.
5. Itens/fornecedores/listas inativos não são oferecidos em novos lançamentos (permanecem visíveis se já gravados).
6. "Aguardando liberação" não aparece mais antes do login/seleção de loja; tipo de lista exibido em português; erro de digitação "RETAgUARDA".
7. Novo `scripts/check-rules.mjs` (incluído em `npm run test`): zero válido, vazio ≠ zero, decimais com vírgula, negativos recusados, total por quantidade correta, loja preservada, Matriz não operacional, datas da nota, rótulos.

Essas correções foram publicadas na main (commit 2ac1469) em 18/11/2026; CI verde e Cloudflare atualizado.

**Bloqueio restante:** acesso administrativo ao projeto Supabase Retaguarda MFT (conector da conta correta ou exportação do esquema/políticas/gatilhos). Sem ele, definições de RLS, funções e gatilhos continuam não lidas; os testes abaixo foram feitos como usuário autenticado pela API pública.

### Teste funcional autenticado de 18/11/2026

Usuário administrador logado no site publicado (papel `matrix_admin` com vínculo ativo em `matriz`). Testes feitos pela interface e pela API com a sessão do usuário, apenas na loja **Teste**.

**Banco no início:** todas as tabelas vazias (1 perfil de usuário); lojas `matriz` e `teste`; as 10 flags habilitadas somente para `teste`.

**Registros de homologação criados (identificados com [TESTE]):** itens `TST-001 [TESTE] Arroz` (kg, 5,50) e `TST-002 [TESTE] Óleo` (un, 8,90) no catálogo central; fornecedor `TST-F1 [TESTE] Fornecedor Homologação`; lista `[TESTE] Lista semanal` (2 itens) na Teste; contagem `CT-TESTE-01` **finalizada** na Teste (Arroz 0; Óleo 2,5 × 8,90). Remover ou inativar esses registros só com aprovação do usuário.

**Resultados:**
- Todas as colunas usadas pelo código existem no banco (consulta sem erro em todas as tabelas/views).
- Matriz: criação de itens e fornecedor OK; rótulos dos checkboxes visíveis.
- Listas: inclusão de itens OK; duplicidade bloqueada no front **e** no banco (`purchase_list_items_list_id_item_id_key`).
- Isolamento: linha com `store_id` diferente do documento e contagem com `store_id = matriz` são recusadas por RLS.
- Contagem: zero e decimal aceitos; campo vazio recusado; item repetido bloqueado no banco (`stock_count_items_count_id_item_id_key`).
- Finalização: status `finalized` + `finalized_at`; gerou **1** `stock_movements` (`count_adjustment`, +2,5 Óleo, custo 8,90) e `store_stock_balance` = 2,5. Arroz contado 0 sem saldo anterior não gerou movimento (delta 0).
- Após finalizar, o banco bloqueia: editar linhas ("parent is no longer a draft"), voltar para rascunho ("Only draft counts can change status") e excluir.
- **Esquema:** `stock_count_items.counted_quantity` é **NOT NULL**. Portanto "não contado" não pode ser gravado como linha: itens pendentes ficam só na tela até receberem quantidade (decisão de implementação abaixo).
- `store_last_purchase_cost` expõe `store_id`, `item_id`, `unit_cost`, `entry_date`, `received_at`.
- Erro de login vinha em inglês ("Invalid login credentials") e aparecia acima do formulário, fora da área visível.

### Contagem com listas — entrega de 18/11/2026 (branch feat/contagem-lista)

Situação: **Implementado → Testando em Teste** (não homologado). Arquivo principal: `src/modules/contagem/lines.js` (regras e renderização) + eventos em `main.js`.

- No rascunho: **Carregar lista** (listas ativas da loja com uso contagem ou ambos) acrescenta itens ausentes sem duplicar; **Incluir item avulso**; **Buscar na contagem** por nome/código.
- Cada linha tem quantidade e custo editáveis; a gravação acontece ao sair do campo ou com Enter (que avança para a próxima quantidade). Vírgula decimal; negativos e texto recusados; sem separador de milhar.
- **Vazio = não contado:** linha pendente (fundo destacado, "Não contado") não é gravada. **0 = contado sem estoque**, gravado normalmente. Apagar a quantidade de uma linha já gravada é recusado com orientação para remover pelo ×.
- Custo sugerido: última compra recebida da loja (`store_last_purchase_cost`), senão custo padrão do item; a origem aparece na dica do campo. Editável.
- Resumo no topo: itens contados, sem contagem e valor total da contagem.
- Finalizar com itens pendentes pede confirmação dizendo quantos ficarão fora.
- Contagem finalizada mostra tabela somente leitura (sem campos, sem remover).
- Pendentes vivem só na tela: ao reabrir a contagem, basta carregar a lista de novo (o merge traz só o que falta).
- Login: mensagem em português dentro do formulário e e-mail preservado após erro.
- Testes automatizados novos em `scripts/check-rules.mjs` (parseQty, fmtQty, merge, custo, resumo, bloqueio).

---

### Versão 1.0 — entrega de 18/11/2026 (branch feat/versao-1)

**Pedido do usuário:** sistema com design e funcionalidades de versão final, identidade da marca, sem rótulos de protótipo, sem etapas de homologação, conectado ao Supabase, e apagar os dados [TESTE].

**Implementado e testado no navegador (prévia da branch, login real como matrix_admin, loja Teste):**
- Todas as 14 telas carregam sem erro de console.
- Nota fiscal: lançar, itens, gerar 2 parcelas, pagar, dar entrada (movimentos invoice_receipt gerados).
- Perda: itens e registro (movimento loss). Contagem: carregar lista, quantidades, total R$ 55,25 conferido, finalizar (ajustes corretos).
- Pedido: criação com lista + contagem, sugestão (Arroz contado 0, mínimo 2 → 2 kg), fornecedor, envio.
- CMV: prévia correta (22,25 + 90,60 − 55,25 = 57,60; perdas 8,90 destacadas). Itens, fornecedores (vínculo), usuários (abre), painéis.

**Fatos do banco descobertos nesta entrega:**
- `invoice_payments.status`: pending, paid, cancelled. `user_tab_permissions.tab_code`: códigos de feature (counts, lists...), e exige vínculo em `store_memberships` da mesma loja (FK).
- `purchase_order_items.supplier_id` exige vínculo existente em `store_item_suppliers` (FK loja+item+fornecedor). A tela de pedido cria o vínculo ao escolher fornecedor ainda não vinculado.
- `cmv_closings` exige datas diferentes entre contagem inicial e final (check). A prévia mesmo dia é exibida, sem botão salvar.
- `cmv_closing_items.component_type`: valores aceitos ainda desconhecidos; a gravação do detalhe é tentada com "cmv" e, se recusada, o fechamento é salvo assim mesmo (a tela recalcula a memória pelas contagens e documentos travados).
- Movimento de perda usa `loss_date` à meia-noite; CMV usa horários de finalização/recebimento/emissão para o período e `created_at` para perdas.
- Não existe bucket de Storage: anexos exigem `docs/sql/01-anexos-storage.sql`.
- Documentos finalizados não podem ser excluídos pelo app (gatilhos). Limpeza de dados de teste: `docs/sql/02-limpar-dados-teste.sql`.

**Pendências:** executar os dois SQL; confirmar `component_type` do CMV; criação de logins de novos usuários só pelo painel do Supabase (exige service role); sugestão de compra depende de duas contagens finalizadas em datas diferentes.

### Layout único inspirado no Degust — 18/11/2026 (versão 1.1)

**Pedido do usuário:** não gostou do layout separado nem da forma de trocar de loja; pediu para se inspirar no Degust One (Linx), analisado em navegador com login do usuário, somente leitura.

**O que mudou:**
- Matriz e Loja passam a usar **uma única estrutura**: menu lateral vinho, recolhível (ícones ↔ nomes), com busca no menu e grupos (Loja: Início, Estoque, Compras, Análise; Matriz: Painel, Pedidos das lojas, Cadastros).
- **Barra superior fixa** com **Ambiente** (Matriz/Loja, só aparece se houver as duas opções) e **Loja pesquisável** (nome e código, teclado e Ctrl+K). Trocar a loja mantém o módulo aberto.
- Sem tela de escolha após o login: abre o último ambiente/loja usado (localStorage `rfs-last-route`).
- Visual: indicadores com faixa lateral colorida, cabeçalho de tabela em vinho, títulos de página e de cartões em caixa alta.
- Arquivos: `src/areas/shell.js` (estrutura), `src/areas/matriz/shell.js` e `src/areas/loja/shell.js` viraram apenas registros de módulos.

**Decisão anterior substituída:** "Matriz e Loja não devem ser um painel único com menus diferentes" / identidades visuais distintas. Justificativa: pedido explícito do usuário de seguir o modelo do Degust, em que a troca de contexto é feita na barra superior. A separação de dados, permissões e módulos entre Matriz e Loja continua igual.

### Acessos únicos e log de alterações — 18/11/2026 (versão 1.2)

**Pedido do usuário:** liberar lojas e fazer **uma única liberação de módulos** (ex.: Notas fiscais liberado = notas de todas as lojas a que a pessoa tem acesso); incluir os acessos da Matriz; incluir log de alterações.

**Regra de acesso (tela Matriz › Usuários e acessos):**
- Seções: **Matriz** (administrador = acesso total; ou módulos da Matriz: Pedidos das lojas `orders`, Itens `catalog`, Fornecedores `suppliers`, Usuários e log `users`), **Lojas liberadas** (marcar lojas) e **Módulos das lojas** (Contagem, Listas, Pedidos, Notas, Transferências, Perdas, CMV — Ver/Editar).
- O banco continua por loja: ao salvar, a mesma liberação é gravada em `store_memberships` e `user_tab_permissions` de cada loja marcada; desmarcar a loja desativa o vínculo. Acesso parcial à Matriz grava vínculo `matriz` com papel `viewer` + permissões com `store_id='matriz'`.
- Códigos aceitos pelo check de `user_tab_permissions.tab_code`: counts, lists, orders, notes, transfers, losses, cmv, catalog, suppliers, users. A permissão exige vínculo ativo na mesma loja (FK).
- **Sem seletor de papel** (removido a pedido, sem efeito prático): o papel gravado em store_memberships é derivado dos módulos — algum Editar = store_operator (gerentes existentes são mantidos), só Ver = viewer.
- Frontend: `src/core/access.js` (storePerm, matrixPerm, hasMatrix). Menus mostram só módulos com "Ver"; sem "Editar" a tela fica em modo consulta (classe `.read-only` esconde ações). **RLS no banco não foi alterado**: para usuário não administrador com módulos parciais da Matriz, leituras/gravações dependem das políticas existentes (que hoje privilegiam `matrix_admin`); validar com um usuário real antes de liberar.

**Log de alterações:**
- Tabela `audit_events` (id, store_id, user_id, action, entity_type, entity_id, details jsonb, created_at). O app grava; **o banco recusa exclusão** (log imutável pelo app). Não há gatilhos de auditoria no banco: o registro vem do app (`src/core/audit.js`).
- Registrado automaticamente em `db.insert/update/remove` para: itens, fornecedores, vínculos de fornecedor, listas, contagens, pedidos, notas, parcelas, perdas, transferências e fechamentos de CMV. Alterações guardam só os campos que mudaram, com valor anterior e novo. Linhas de documentos não entram (evita ruído).
- Alterações de acesso: `action='access'`, `entity_type='user_access'`, `entity_id`=usuário, com lista legível das mudanças.
- Telas: Matriz › Log de alterações (90 dias, filtros por tipo e loja, busca) e histórico dentro do painel de cada usuário.
- Um registro de sonda (`action='teste_log'`) ficou no log; `docs/sql/02-limpar-dados-teste.sql` o remove.

### Acessos sem "administrador" — 18/11/2026 (versão 1.3)

**Pedido do usuário:** não existir o perfil "administrador" na tela; módulo liberado = pode usar e editar; escolher acesso à Matriz da mesma forma que às lojas.

- Tela: seção **Acessos** com cartões **Matriz** + cada loja; **Módulos da Matriz** (Pedidos das lojas, Itens, Fornecedores, Usuários/acessos/log) e **Módulos das lojas** (valem para todas as lojas marcadas), cada módulo só liga/desliga. Sem distinção Ver/Editar (grava `can_view = can_edit`).
- Painel e Unidades acompanham o acesso à Matriz. Você não pode remover o próprio acesso à Matriz nem o módulo de Usuários.
- **Banco:** marcar a Matriz grava vínculo `matriz` com papel `matrix_admin`, porque as políticas atuais do banco liberam as telas da Matriz por esse papel; os módulos da Matriz limitam o que aparece no app. **Limitação de segurança:** quem tem a Matriz liberada, mesmo com poucos módulos, tem no banco o alcance de `matrix_admin` (inclusive leitura de todas as lojas via API). Para restringir no banco, é preciso ajustar as políticas RLS para considerar `user_tab_permissions` da Matriz (migração a planejar com acesso administrativo).
- Lojas: papel interno `store_operator` (gerentes antigos mantidos); o app mostra ao usuário apenas as lojas com vínculo ativo (cadastro antigo de administrador sem vínculo de loja continua vendo todas).
- Substitui a regra da v1.2 de "Administrador da Matriz" como opção na tela e os níveis Ver/Editar.

### Módulo Unidades retirado — 18/11/2026
A pedido do usuário, a tela Matriz › Unidades foi removida: o cadastro e a consulta de lojas são feitos diretamente no Supabase (pela sessão de desenvolvimento/administração). Continua proibido criar, editar ou excluir lojas pela retaguarda. "Painel e Unidades acompanham o acesso à Matriz" passa a valer só para o Painel.

### Congonhas (CGH) — próximos lançamentos
Rename e limpeza já executados (ver seção "Loja Teste → Congonhas (CGH)" acima; SQL em `docs/sql/03-renomear-teste-para-cgh.sql`). Por decisão do usuário, os lançamentos da CGH (cadastro de itens, lista de contagem, estoque inicial de 31/10 e notas) ficam para depois. Fonte: `Documents\MFT\CONGONHAS 7666 -CMV OUTUBRO 2026.xlsx` (abas ESTOQUE e ITENS). Com o rename, não há mais loja dedicada a testes; criar outra se necessário.

## 11. Diretrizes visuais e de experiência

**Identidade (versão 1.0):** marca MFT — vinho #85071D (principal), grafite #595959, fundo claro; títulos Montserrat, texto Inter. Matriz com menu lateral grafite; Loja com barra vinho e navegação horizontal. Substitui grafite/cobre e verde do protótipo. Módulos sem flag liberada não aparecem no menu (sem rótulo "Aguardando liberação").


- Visual moderno, premium, corporativo, sem excesso de poluição.
- Matriz: grafite/cobre, gestão mais analítica, menu lateral.
- Loja: verde, execução diária, menu horizontal e seleção clara da unidade.
- Cartões com números principais, status, alertas e atalhos rápidos.
- Prioridade à **leitura instantânea de indicadores**, tabelas ordenáveis, filtros digitáveis, busca e vazio bem explicado.
- Reflow responsivo: desktop, tablet, celular e zoom alto (sem tabelas ilegíveis).
- Formulários acessíveis: rótulos visíveis, mensagens de erro por campo, feedback pós-gravação, confirmação para ações irreversíveis.
- Datas, valores e números no padrão pt-BR. Quantidades decimais sem arredondamento indevido.
- Um único local para definir regras de negócio: não espalhar cálculos por componentes.
- Não usar dados "bonitos" inventados no painel real. Sem informação → mostrar ausência/pendência.
- Nunca apresentar um número estimado como real sem identificação de fonte e hipótese.

---

## 12. Roadmap recomendado (prioridades)

### Fase A — Estabilidade, acesso e isolamento (P0)

- Testar ponta a ponta a URL Cloudflare com login real.
- Confirmar acesso do administrador à Matriz e à unidade Teste.
- Verificar permissões RLS sob administrador, operador autorizado e usuário sem permissão.
- Testar leitura/escrita isolada em unidades separadas quando houver outra unidade provisionada.
- Conferir tratamento de erros, perda de sessão, carregamento e atualização de páginas.
- Implementar testes de build e regressão para as regras de acesso e ausência de cadastro de lojas.

### Fase B — Cadastros corporativos (P1)

- Itens, fornecedores e cadastro de vínculo item–loja–fornecedor.
- Unidade-base, custo padrão/fallback, ativo, composes_cmv.
- Pesquisa, filtros, edição e validação com registro de alterações.
- Unidades permanecem somente leitura.

### Fase C — Listas e Contagem (P1)

- Listas por loja reutilizáveis, impressão e gestão de itens.
- Selecionar lista e carregar itens na contagem, com merge correto.
- Preenchimento de zeros/decimais e distinção vazio ≠ zero.
- Custo última nota local ou cadastro; totais por item e por contagem.
- Finalização e conciliação de ajustes de estoque.

### Fase D — Pedidos de compra (P1)

- Pedidos a partir de lista + contagem, com dados persistidos.
- Cálculo de demanda, média 10 dias, pedidos em aberto, sugestão e red flags.
- Seleção de fornecedor por loja/item; preços, quantidades e total editáveis.
- Status e visão consolidada da Matriz.

### Fase E — Notas, anexos e pagamentos (P1/P2)

- Itens de notas e recebimento com entrada no estoque.
- Suporte a anexos de nota, boletos e comprovantes no storage autorizado.
- Cronograma de pagamento, parcelas e vínculos documentais.

### Fase F — Transferências, perdas e CMV (P2)

- Transferências bilaterais com testes de saldo e idempotência.
- Perdas com rastreabilidade e reconciliação.
- Fechamento CMV por contagens, elegibilidade de compras, perdas destacadas e memória por item.

### Fase G — Usuários, escala e governança (P2)

- Interface de perfis/permissões por unidade e módulo.
- Auditoria gerencial, aprovação de pedidos, onboarding de lojas.
- Ajustes de performance, paginação, observabilidade, backup e recuperação.
- Liberação progressiva por loja após homologação formal.

**Regra de priorização:** primeiro tornar o fluxo completo de uma loja confiável; depois habilitar em outras unidades. Não implementar múltiplos módulos superficialmente em detrimento de um fluxo funcional testável.

---

## 13. Critério de pronto e procedimento de homologação

Um módulo só está **homologado** quando:

1. Interface e navegação completas, desktop e mobile.
2. Todos os campos e regras de negócio acordados foram implementados.
3. CRUD (quando aplicável) e status persistem corretamente no Supabase.
4. Cada registro respeita escopo por loja, RLS e papéis diferentes.
5. Seleções, buscas, filtros e inclusão/remoção de itens funcionam sem regressão.
6. Erros de validação e estados vazios têm mensagem compreensível.
7. Cálculos têm memória verificável, testes com zero, decimal, vazio e casos-limite.
8. Ações de estoque são idempotentes, auditáveis e não duplicam movimentos.
9. Build e testes automatizados passam; testes reais no navegador foram registrados.
10. Homologação começa em Teste; só depois o recurso é liberado para outras unidades.

**Status recomendados para acompanhamento:** Planejado → Em desenvolvimento → Implementado → Testando em Teste → Homologado → Liberado por loja → Monitorado.

Não usar "Concluído" apenas porque apareceu no menu ou porque o CI passou.

---

## 14. Procedimento obrigatório para qualquer IA / desenvolvedor

Antes da mudança:

1. Ler ESTE CEREBRO.md e README.md.
2. Consultar o código atual na branch main e as pastas do módulo afetado.
3. Conferir esquema, RLS, constraints e triggers reais do Supabase quando mexer em dados.
4. Identificar e proteger regras de Matriz/Loja, isolamento de unidade e flags.
5. Definir objetivo da mudança, critérios de aceitação, dados afetados e risco de regressão.

Durante:

6. Alterar apenas arquivos do projeto retaguarda-food-service; preservar os outros protótipos.
7. Preferir mudanças localizadas; criar/editar serviço por módulo quando necessário.
8. Nunca gravar senhas ou chaves secretas no GitHub.
9. Se exigir mudança no banco, documentar SQL/migração, impacto, rollback e verificação.
10. Não usar a unidade Matriz como loja operacional e não liberar nova funcionalidade em todas as unidades por padrão.
11. Não reintroduzir demonstração ou criar lojas pela plataforma.

Depois:

12. Rodar npm run test e npm run build (ou conferir GitHub Actions com evidência).
13. Verificar deploy automático no Cloudflare; nunca presumir URL atualizada sem teste.
14. Testar funcionalmente na **Teste**, com dados próprios da unidade.
15. Verificar integridade da operação e permissões no Supabase.
16. Reportar claramente **implementado**, **testado**, **parcial** e **pendente**.
17. Atualizar CEREBRO.md (seção de decisões, status, roadmap ou risco) no mesmo conjunto de mudanças.

**Definição de fonte da verdade em caso de conflito:** para estado técnico corrente, consultar código e banco; para escopo e intenção, usar última decisão explícita e este arquivo; para publicação, verificar GitHub Actions + Cloudflare real.

---

## 15. Decisões históricas que não podem ser perdidas

| Tema | Decisão consolidada |
| --- | --- |
| Repositório | Usar opewillian/Prototipos; preservar os outros diretórios |
| Banco | Um único projeto Retaguarda MFT, com dados separados por loja |
| Publicação | Cloudflare Pages, main, root retaguarda-food-service, npm run build, dist |
| Interface | Entrar → Matriz ou Loja; seleção de unidade no ambiente Loja |
| Autenticação | Entrada visual simples; Auth obrigatório para dados |
| Demonstração | Removida; somente Supabase |
| Desenvolvimento | Testar toda nova funcionalidade na unidade real Teste |
| Lojas | Não criar, editar ou excluir pela retaguarda |
| Estoque | Sem aba Estoque; contagem e movimentos alimentam saldos |
| Catálogo | Itens/fornecedores centrais; associações por loja |
| Custo | Última nota recebida da loja; fallback ao cadastro |
| Itens contados | Campo vazio = não contado; zero = quantidade válida |
| Compras | Lista + contagem + média 10 dias + pedidos em aberto + sugestão explicada |
| Transferência | Saída e entrada automática; isolamento e autorização em ambas as lojas |
| CMV | Estoque inicial + compras líquidas elegíveis − estoque final, com perdas discriminadas |
| Segurança | RLS, regras SQL, roles por loja/aba e feature flags por unidade |
| Status de homologação | Flag ativa não equivale a módulo concluído |
| Identidade (18/11/2026) | Marca MFT (vinho/grafite, logo) nos dois ambientes |
| Entrada (18/11/2026) | Tela inicial é o login real; escolha de ambiente depois |
| Módulos não liberados (18/11/2026) | Ocultos no menu da loja, sem rótulos de protótipo |
| Layout (18/11/2026, v1.1) | Estrutura única estilo Degust: menu lateral recolhível + barra com Ambiente e Loja pesquisável |
| Acessos (18/11/2026, v1.2) | Lojas liberadas + um único conjunto de módulos para todas elas; módulos próprios da Matriz |
| Auditoria (18/11/2026, v1.2) | Log de alterações gravado pelo app em audit_events, imutável pelo app |
| Acessos (18/11/2026, v1.3) | Sem perfil administrador na tela: Matriz e lojas são acessos; módulo liberado = usar e editar |

---

## 16. Ideias para evolução futura (não aprovadas como pronto)

- Centro de avisos operacionais e pendências prioritárias no painel.
- Rotinas de aprovação e SLA de pedidos entre loja e Matriz.
- Calendário de compras e entregas, com lembretes de vencimento.
- Comparador de preços por fornecedor, item, loja e período.
- Sugestão de compra com tendência real de consumo e sazonalidade, somente se houver fonte confiável.
- Importação de XML de NF-e e extração de itens, mediante validação humana.
- Inventário por categorias/local físico, respeitando contagem em branco.
- Relatórios de divergência contagem × saldo, acurácia e evolução de perdas.
- Exportação CSV/Excel/PDF, quando útil, respeitando permissões e isolamento.
- Trilha de auditoria de alterações, aprovações, anexos e movimentos de estoque.
- Painel comparativo da Matriz com indicadores normalizados por unidade.
- Alertas de itens sem fornecedor habilitado, sem custo ou com saldo crítico.
- Perfis pré-definidos e convites para usuário, com revisão pelo administrador.
- Mecanismo formal para aprovar e liberar funcionalidades da Teste às demais lojas.
- Controle de versões de regras de CMV e memória de cálculo de cada fechamento.

**Essas são ideias/roadmap, não funcionalidades entregues.** Priorizar apenas após o fluxo operacional básico estar confiável.

---

## 17. Checklist de continuidade para a próxima sessão

- [ ] Abrir GitHub e ler CEREBRO.md.
- [ ] Verificar qual é o HEAD atual da main.
- [ ] Confirmar último GitHub Actions e deploy Cloudflare.
- [ ] Inspecionar estado atual do Supabase sem alterar dados indevidamente.
- [ ] Confirmar que "Teste" está disponível e que nenhuma loja pode ser criada no app.
- [ ] Identificar o módulo que será trabalhado e o resultado funcional esperado.
- [ ] Criar implementação isolada, com testes técnicos e funcionais na Teste.
- [ ] Anotar decisões, pendências e regressões neste documento.

### Registro de referência

**18/11/2026 — consolidação inicial:** documento criado a partir do histórico de desenvolvimento e da inspeção dos arquivos principais da branch main. Estado informado: Supabase e Cloudflare conectados; Matriz/Loja separados; sem dados fictícios; Teste provisionada; cadastro de lojas bloqueado; homologação funcional dos módulos ainda em evolução.

**18/11/2026 — auditoria técnica e teste autenticado:** ver seção 10 (auditoria, teste funcional e entrega "Contagem com listas"). Próximos passos: homologar a contagem com listas na Teste; depois Fase 2 (vínculo item × loja × fornecedor, busca em Itens/Fornecedores) e Listas (busca, impressão, ordenação).

**Este arquivo não é uma especificação congelada.** Deve evoluir junto do produto, mas decisões não devem desaparecer sem explicação ou aprovação explícita.

### Script 31 (23/11/2026) — contagem única por data
- Índice único parcial `stock_counts_store_date_key` em (store_id, count_date) onde status <> 'cancelled': uma loja não pode ter duas contagens na mesma data (canceladas não contam).
- App (loja/contagem.js): "Nova contagem" avisa e abre a contagem já existente de hoje; mudar a data para uma já usada mostra o aviso e volta a data anterior.

### CMV com calendário (23/11/2026)
- Página CMV (loja/cmv.js): botão "Selecionar datas" abre calendário que só libera dias com contagem (rascunho ou finalizada; canceladas fora). 1º clique = estoque inicial, 2º = estoque final (data posterior).
- Documentos por DATA: do dia seguinte ao estoque inicial até o dia do estoque final, inclusive. Compras = notas recebidas pela entry_date; transferências emitidas pela transfer_date; perdas registradas pela loss_date.
- Prévia avisa contagens em rascunho e notas pendentes / transferências e perdas em rascunho do período (ficam fora do cálculo). Salvar fechamento só com as duas contagens finalizadas.


### Script 32 (23/11/2026) — datas de entrada out/26 CGH
- Planilha de entregas de out/26 (31 notas) conferida: 29 já tinham a data certa; 121188 (planilha "121.138", R$ 7.671,11) passou para 28/10; Eurofoods 6636 (R$ 15,00, 27/10) NÃO existe na Retaguarda: foi EXCLUÍDA no Monitor de DANFEs do Everest (emp 57) em 09/11/2026 17:10; decisão do usuário: fica fora. "SPAL 181.961" da planilha é a Sendas 181961.

### Entrada das notas de out/26 da CGH (23/11/2026)
- Das 30 notas da planilha (de-para completo + data revisada), 19 receberam entrada pelo app (de-para/rateio iguais à tela): 111 movimentos, R$ 43.502,91.
- 11 ficaram PENDENTES porque a soma dos itens não fecha com o valor da nota (faltam descontos/impostos em "Outros custos"): Sendas 177919, 178953, 179616, 179704, 180447, 180877, 181113, 181961, 182114 (itens acima da nota = desconto); SPAL 16946833 e 16979884 (itens abaixo da nota = IPI/ST/frete).
- Depois (a pedido do usuário): nas 11 pendentes a diferença foi lançada em Outros custos ("Desconto" nas 9 da Sendas; "ICMS ST" nas 2 da SPAL: 4,82 e 190,62), com descrição "Diferença para fechar com o valor da nota", rateio reaplicado e entrada dada. Resultado: 30/30 notas de out/26 recebidas, 154 movimentos, R$ 47.866,68 (notas somam 47.867,27; 0,59 é arredondamento do custo unitário em 4 casas).

### Integração Linx Degust One — faturamento (23/11/2026)
- API: https://lx-degust-api-integracao-prd.azurewebsites.net (swagger em /swagger). Login POST /api/usuario/autenticar → {statusCode, acesso:{token}} (token 4 h; não gerar toda hora).
- Segredos no Supabase (Edge Functions → Secrets): DEGUST_USUARIO, DEGUST_SENHA, DEGUST_FRANQUEADOR (cadastrados pelo usuário; ninguém vê o valor).
- Edge Function `degust` (supabase/functions/degust/index.ts, publicada pelo editor do painel): só admin da Matriz; ações "lojas" e "vendas" (relatorio-vendas, máx. 30 dias, tipoData C = data do caixa). Token guardado em public.integration_tokens (script 33, sem acesso do app).
- Teste OK: 131 lojas na franquia; CGH = codLoja 12 "DELTA AERO CONGONHAS 09-03 - PUBLICA". 20/11/2026: 254 vendas, 39 canceladas, líquido R$ 8.088,50.
- Script 34: stores.degust_code (CGH 'teste' = 12); tabelas sales / sale_items / sale_payments / sales_imports (gravação só pela função; leitura pela aba 'cmv'); funções sales_by_day / sales_by_product / sales_by_payment. Sem CPF do consumidor (só has_customer_doc).
- Regra de valores da Linx: valProduto (gross) já vem SEM o desconto dos itens → bruto = gross + item_discount; descontos = discount + item_discount; líquido = valLiquido = gross − discount + surcharge. Out/26 CGH: bruto 268.979,00 − desc 5.220,28 = líquido 263.758,72 (= soma dos pagamentos).
- Função degust: ação "importar" (1 dia por chamada: apaga o dia e regrava) e "diario" (últimos 3 dias de cada loja com degust_code). Histórico CGH carregado 01/08–22/11/2026: 114 dias, 25.282 vendas, R$ 957.141,99 líquido.
- Script 35: pg_cron + pg_net, job 'degust-vendas-diario' às 09:00 UTC (06:00 BRT) com x-cron-key (integration_tokens 'cron') + apikey publishable. Teste manual OK (20–22/11 reimportados). "Verify JWT" da função continua LIGADO (desligar foi bloqueado; não precisou).
- Tela Loja › Financeiro › Faturamento (primeiro grupo do menu, logo após Início) (loja/faturamento.js, liberação 'cmv'): período De/Até + atalhos; resumo; por dia; produtos (com busca); formas de pagamento; botão de importar o período (só admin).

- CMV (loja/cmv.js): resumo mostra faturamento líquido do período (sales_by_day de from a to, mesmo período dos documentos), CMV % e perdas % sobre o faturamento; avisa quando faltam dias importados. Out/26 CGH: faturamento 263.758,72, CMV 22,6%.
- CMV memória de cálculo clicável: nome do item abre popin com todas as movimentações (estoque inicial, compras, transf. recebidas/enviadas, perdas, estoque final; por data, com link para o documento) e o CMV do item; cada número abre só aquela categoria. Estoque inicial/final de contagem em RASCUNHO (com lápis) abre a edição da quantidade (colunas da contagem; grava em stock_count_items e recalcula).
- Script 36 (23/11/2026): regra do custo da contagem = custo da planilha SÓ quando o item não tem compra lançada; com compra recebida até a data, usa a ÚLTIMA compra (custo da linha da nota). Aplicado na CT-0002 (31/10, rascunho): 63 linhas, R$ 46.944,22 -> 38.469,59; CT-0002 total 74.400,98 -> 65.926,35. CT-0001 (finalizada, set/26 fechado) não alterada. Atenção: vários itens mudaram muito porque a unidade da quantidade da planilha difere da unidade da compra (de-para): grão Ruby 3kg, Chocodelta, concentrado limão 5L, mu 250g, leite em pó, azeite, manteiga, aromatizante, molho Billy Jack, Frapease, Lacta, creme de leite, calda branca, bobina — a revisar.
- Script 37: revisão item a item da CT-0002 após o 36 — CHOCODELTA 90 potes = 45 kg; LEITE EM PÓ DESNATADO 3 pacotes 280 g = 0,84 kg (decisão do usuário). Demais itens revisados (Ruby, MU 250g, concentrado limão, leite integral, Billy Jack, azeite, manteiga, aromatizante, Frapease, Lacta, calda branca, creme de leite, bobina, Red Bull, açúcar): quantidade já na unidade do item, só o custo da planilha era por embalagem — ficam com o custo da compra. CT-0002 = 62.253,76.
- Script 38 (23/11/2026): código das contagens em hexadecimal aleatório (CT-XXXXXX, insertWithCode; índice único stock_counts_store_display_id_key). Renomeadas: CT-0001 (30/09) = CT-F123C1; CT-0002 (31/10) = CT-0FD67D. insertWithCode só sorteia de novo quando o duplicado é o próprio código.
- Script 39 (23/11/2026): controle de acesso dos módulos novos — Loja › Faturamento = código "sales" (feature flag + user_tab_permissions; copiado de quem tinha CMV) e Matriz › Notas fiscais = código "invoices" (copiado para quem está na Matriz). Vendas leem com sales OU cmv. STORE_TABS/MATRIX_TABS (core/access.js) atualizados; tela Usuários e acessos mostra os dois.
- Início da loja repaginada (loja/inicio.js + core/chart.js): card Faturamento com botão Dia a dia (mês atual) / Mês a mês (12 meses + pontilhado do ano anterior); notas pendentes de entrada; CMV por período (pares de contagens seguidas, até 6) com % sobre o faturamento líquido. Blocos só com o módulo liberado.
- Volume de vendas (23/11/2026): CGH tem vendas no Degust desde dez/2021 (não importado; usuário decide depois). Detalhado ocupa ~28 MB por 114 dias de 1 loja (~7,4 MB/mês/loja); banco total 44 MB; plano grátis Supabase = 500 MB. 131 lojas detalhadas ~1 GB/mês: para escalar, guardar só resumo diário por loja e detalhe de poucos meses, ou subir o plano.
- Arquivo das vendas no Cloudflare R2 (23/11/2026): bucket retaguarda-vendas (conta Cloudflare do site). Toda importação grava o dia como veio da Linx (sem CPF do consumidor) em vendas/loja=<id>/ano=<AAAA>/mes=<MM>/<AAAA-MM-DD>.json.gz (S3 SigV4 na função degust; ação r2_list lista e soma). Segredos R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. 1 dia CGH ~60 KB compactado (1,45 MB bruto) => ~2,8 GB/ano para 131 lojas. BigQuery: código pronto mas DESLIGADO (só com segredo BQ_ENABLED=1) — conta de faturamento do Google fechada/pré-pago de R$ 200; dataset retaguarda (São Paulo) e tabelas já criados.
- R2 carregado (23/11/2026): 114 arquivos da CGH (01/08–22/11/2026) = 6,5 MB (150 MB sem compactar; 28 MB no Supabase). 25.282 vendas, R$ 957.141,99 (bate com o Supabase). Projeção: ~57 KB/dia/loja => ~2,7 GB/ano com 131 lojas (faixa grátis 10 GB). A importação diária já grava no R2.
- VENDAS SÓ NO R2 (23/11/2026, decisão do usuário: "todas as vendas e detalhes em um só lugar"): função degust grava por dia vendas/...json.gz (detalhe) + resumo/...<dia>.json + resumo/.../mes.json; ação "resumo" {storeId,de,ate} atende as telas (permissão public.can_view_sales, script 40). Telas Faturamento/Início/CMV leem via src/modules/shared/vendas.js. Supabase guarda só sales_imports (registro dos dias). Conferido: R2 = Supabase em out/26, 10/10–05/11 e 01/08–22/11 (vendas, bruto, desc, líquido, produtos, pagamentos). BigQuery removido do código. Script 41 (confirmado pelo usuário): tabelas sales/sale_items/sale_payments e funções sales_by_* APAGADAS do Supabase; produção publicada lendo do R2.
- Regra do usuário (23/11/2026): arquivo completo das vendas só a partir de 01/10/2026 (DETALHE_DESDE na função degust); antes disso, só resumos. Ação r2_limpar_detalhe apagou 63 arquivos completos (ago-set/2026 + 2 testes), ~3,6 MB. Importação do histórico jan/2025–jul/2026 (só resumos) para o comparativo mês a mês com o ano anterior. Gráfico dia a dia da Início sem comparativo.
- CMV › botão "Análise completa" (analysisModal em loja/cmv.js, limites em ANALISE): notas pendentes no período; transferências/perdas em rascunho; contagens em rascunho; custo da contagem x média das compras (>=1,5x); compras com preço fora da mediana do item; CMV negativo por item (<= -R$10); estoque contado com custo zero; itens que zeraram sem compra; itens >5% do CMV; faturamento incompleto e CMV fora de 15–35%. Primeira leitura 30/09–31/10: 54 pontos (15 notas pendentes, 16 custos divergentes — vários na CT-F123C1 de 30/09 — e 13 CMV negativos).

- **Perfil automático de novos usuários (23/11/2026, `42-perfil-automatico-novo-usuario.sql`):** usuário criado no painel do Supabase (Authentication › Add user) não aparecia em Matriz › Usuários e acessos porque nada criava `user_profiles`. Gatilho `on_auth_user_created` em `auth.users` cria o perfil (nome = metadado name/full_name ou parte do e-mail antes do @), sem acesso a lojas/módulos. Perfil da Mariana (mariana@igtalimentos.com) criado na hora; liberação de acessos continua na tela.

- **Conexões com o banco (análise de 23/11/2026):** nenhum código abre conexão Postgres direta. O site (`src/core/supabase.js`) e a função `degust` usam supabase-js, que fala HTTP com a API do Supabase (PostgREST); quem conecta no Postgres é o pool do próprio PostgREST (5 conexões ociosas reaproveitadas). Medido em `pg_stat_activity`: 12 conexões de 60 (`max_connections`), `statement_timeout` 120 s. Não usar `pg`/`postgres.js` com conexão direta nas Edge Functions; se um dia precisar de SQL direto, usar a string do pooler Supavisor (porta 6543, modo transaction) com pool de 1 conexão por execução.

- **Faturamento projetado (23/11/2026, `43-faturamento-projetado.sql`):** tabela `public.sales_forecast` (loja, dia, `projected_net` + os dois critérios guardados). Função `public.refresh_sales_forecast(de, ate)` (padrão: amanhã até o fim do mês, horário de SP) apaga e refaz o período. Critérios pedidos pelo usuário: (1) média do mesmo dia da semana nas últimas 8 semanas; (2) média histórica do mesmo dia da semana no ano anterior (D-371, D-364, D-357) × crescimento (últimas 8 semanas ÷ mesmas semanas do ano anterior); projetado = média dos dois. Dias com líquido 0 ficam fora (ex.: 07 e 08/11/2026 zerados na CGH). Base = `sales_imports`. Leitura: quem vê Faturamento/CMV da loja (`can_view_sales`); gravação só pela função. Projeção começa HOJE (vendas do dia só entram às 06:00 do dia seguinte; `45-...inclui-hoje.sql`), dias passados ficam guardados. Recalculada todo dia às 06:30 (pg_cron `faturamento-projetado-diario`, 09:30 UTC, `44-faturamento-projetado-agendamento.sql`; no último dia do mês projeta o mês seguinte inteiro). Aparece na tela Início como linha pontilhada vinho (dia a dia: dias que faltam; mês a mês: vendido + projeção do mês atual). 1ª rodada (CGH, 24 a 30/11): R$ 67.454,02; crescimento 1,0867.

- **Tour do sistema (23/11/2026):** botão "Tour" na barra superior (`src/core/tour.js`, ligado em `src/areas/shell.js`). Abre o tour DA TELA ATUAL: cada módulo da Matriz (9) e da Loja (9) e as telas de detalhe da Loja (contagem, lista, transferência, perda, pedido, nota, resultado do CMV) têm passos próprios em `SCREENS` (chave `area:modulo` ou `area:modulo:detalhe`). No último passo, link "Ver o tour geral do sistema" (menu, ambiente, loja, grupos). Passo cujo elemento não existe na tela é pulado. Ao mudar uma tela, atualizar os passos dela.

- **Recibos do dia (23/11/2026):** em Faturamento, clicar em um dia da tabela "Por dia" abre um popin com os recibos (cupons) do dia: hora (`dataHoraInclusao`), NFC-e, caixa, itens, pagamento, valor e situação, com busca e opção de mostrar cancelados. Clicar em um recibo abre na frente o recibo em estilo cartoon animado (sai de uma impressora; carimbo PAGO/CANCELADO; sem logo e sem rodapé, a pedido). Dados: nova ação `cupons` da função `degust` (mesma permissão do resumo), lida do arquivo completo do R2, só a partir de 01/10/2026; devolve só os campos do recibo, sem dados do cliente. Código: `src/modules/loja/recibos.js`, estilos `rc-*`/`rcp-*` em `assets/app.css`.

- **Faturamento por hora (23/11/2026):** o resumo de cada dia no R2 passou a ter `hours`/`hoursN` (líquido e nº de vendas por hora 0–23, pela hora do 1º item lançado no caixa; `dataHoraInclusao` não serve: é a hora em que a venda chegou ao Degust e, com caixa offline, acumula vendas às 23h/0h). Resumos de 01/10 a 22/11/2026 refeitos com a ação `resumir` a partir dos cupons guardados; dias novos já entram com horas. Antes de outubro/2026 não há horas (só resumo do dia). Tela Início: 3ª visão "Por hora" no gráfico de faturamento = média por dia de cada hora no mês atual x mês anterior (tracejado), com o horário de pico no topo.

- **Gráfico "Vendas" no Início (23/11/2026):** o card "Faturamento" virou "Vendas", com seletor de medida — Faturamento (líquido), Ticket médio (líquido ÷ cupons) e Cupons (nº de vendas não canceladas) — combinado com Dia a dia / Mês a mês / Por hora. Projeção (sales_forecast) só aparece em Faturamento. Por hora: faturamento e cupons = média por dia; ticket = líquido ÷ cupons da hora. Escolhas guardadas no navegador (`rfs-inicio-met`, `rfs-inicio-fat`).

- **Início sem notas pendentes (23/11/2026):** a pedido do usuário, o card "Notas pendentes de entrada" saiu da tela Início (as notas pendentes continuam em Compras › Notas fiscais e na Análise completa do CMV). Início = gráfico Vendas + CMV por período.

- **Lojas Degust x Retaguarda (23/11/2026):** o Degust (franqueador da conta) tem 131 pontos de venda; pelo CNPJ, 52 pontos ligam a 48 lojas nossas (REC-PRA = 3 pontos, CWB-DOM = 2, MCZ-DES = 2); 60 lojas nossas não aparecem nesse Degust (outras marcas e DEL com CNPJ 37.154.511). Primeira venda de cada ponto levantada (busca binária na API, a partir de 2012): a mais antiga é 31/10/2021 — provável implantação do Degust. Planilha para o usuário ligar os códigos: `Documents/MFT/LIGACAO_LOJAS_DEGUST.xlsx`.
- **Decisão do usuário (23/11/2026): NÃO importar vendas das outras lojas agora.** Importar uma loja por vez, no rollout de cada loja para a Retaguarda: gravar `stores.degust_code`, importar resumos (antes de 01/10/2026) e venda completa (a partir de 01/10/2026), refazer resumos com horas e conferir com o Degust. Só a CGH (`teste`, código 12) tem vendas importadas.
- **Escopo do Degust (23/11/2026, confirmado pelo usuário):** a integração Degust atual (credenciais/franqueador nos segredos da função `degust`) cobre **só as lojas DEL (DeltaExpresso)**. As outras marcas (SAL, ACB, BIT, BOL, CPQ, AVI, MFT) ficam para configurar depois (outra conta/franqueador ou outro sistema). Cruzamento Everest x Degust (20/11/2026, Resumo Financeiro PDV do MLO): 15 pontos DEL confirmados pelo valor ao centavo; as outras marcas não batem com nenhum ponto. Indício de lojas DEL duplicadas no cadastro (SLZ-DES 75/123, PMW-CHE 118/1021, CWB-DES 74/124, BSB-NOR 69/3278).

- **Importação das vendas das lojas DEL (23–24/11/2026, `46-importar-vendas-lojas-del.sql`, `47-fila-importacao-agendamento.sql`):** pedido do usuário: "pode importar as vendas das lojas DEL; vendas detalhadas do dia 01/10 para frente e resumida para trás" (substitui a decisão de importar loja a loja). 45 lojas DEL, 49 pontos do Degust, ligação pela planilha `LIGACAO_LOJAS_DEGUST.xlsx` (CNPJ + valor de 20/11 igual ao Everest). Lojas com vários pontos do mesmo CNPJ são SOMADAS na loja (`stores.degust_codes`), como no Everest (uma empresa por CNPJ) — REC-PRA (41+53 juntos 2022–2023, depois 10057), MCZ-DES (47; 10047 nunca vendeu), CWB-DOM (21 até ~08/2025 e 10036 até ~09/2024, juntos). Duplicadas do cadastro: gravado na que bate o Everest (SLZ-DES-75, PMW-CHE-1021, CWB-DES-74, BSB-NOR-3278). Período de cada loja: da 1ª venda no Degust até 23/11/2026 (CGH só 23/11/2021–31/12/2024, o resto já existia).
  - **Fila `public.sales_import_jobs`** (RLS sem políticas; só a função): `dias` = quinzena (1–15, 16–fim), `mes` = refaz o resumo do mês depois que as quinzenas dele terminam; `public.claim_sales_import_job()` (FOR UPDATE SKIP LOCKED; `running` parado 15 min volta). Função `degust`, ação `fila` (cron ou admin): processa por ~110 s; `importRange` busca a quinzena de uma vez por ponto (conferido: bate dia a dia com a importação diária, CGH 01–15/11/2026), separa pelo `dataVenda` e grava os dias 5 por vez. Arquivo completo só a partir de 01/10/2026.
  - **Agendamentos:** `degust-fila-1..3` a cada minuto. **Desligar quando a fila esvaziar:** `select cron.unschedule(jobname) from cron.job where jobname like 'degust-fila%';`. O diário (`degust-vendas-diario`) agora enfileira os 3 últimos dias de cada loja com Degust e processa a fila (antes importava loja a loja e não caberia no tempo da função com 45 lojas).
  - Acompanhar: `select status, kind, count(*) from public.sales_import_jobs group by 1,2;`

- **Franquias SAL, ACB e BIT no Degust (24/11/2026, `48-franquia-degust-por-loja.sql`, `49-importar-vendas-sal-acb-bit.sql`):** mesma API e mesmo usuário Linx, muda o código da franquia: **SAL 2168, ACB 2642, BIT 2202** (DEL = segredo `DEGUST_FRANQUEADOR`). `stores.degust_franqueador` (vazio = DEL); a unicidade passou a ser franquia + código (índice `stores_degust_franq_code_key`; o antigo `stores_degust_code_key` foi removido — códigos de loja repetem entre franquias). A função `degust` guarda um token por franquia (`integration_tokens`: "degust" e "degust:<franquia>") e as ações `lojas`, `vendas`, `periodo_teste` aceitam `{franqueador}`; fila, diário e `importar` usam a franquia da loja.
  - Degust: SAL 21 pontos, ACB 22, BIT 13. Ligados 34 pontos a 33 lojas nossas (14 confirmados pelo valor de 20/11 no Everest; resto pelo CNPJ). Duplicadas: a que bate o Everest (BIT-CWB-DOM-82, BIT-NAT-CHE-83, ACB-PMW-CHE-1145; BIT-BSB-NOR-101 pelo CNPJ). ACB-REC-DOM soma os pontos 12 e 14 (mesmo CNPJ; o 14 está parado e sua 1ª venda não foi achada — importação desde 01/11/2021). Fora: pontos que não são lojas nossas (shoppings/outlets de Recife, Boa Vista, Santos, Sorocaba, Continente etc.), lojas teste e "ERRO CADASTRO".
  - Importação com a mesma regra das DEL (detalhe desde 01/10/2026, resumo antes), na mesma fila `sales_import_jobs` (+2.550 quinzenas).
  - Outras marcas (BOL, CPQ, AVI, MFT): ainda sem código de franquia.

- **Ranking de ticket médio no Início (24/11/2026):** card "Ranking de ticket médio" com todas as lojas da MESMA MARCA da loja vista (marca = `stores.brand_id`; sem marca, o prefixo do código — as ACB estão sem marca): ticket do mês passado, ticket deste mês (até ontem) e variação %, ordenado pela variação; a loja vista em destaque. Ação `ranking` da função `degust` (quem vê Faturamento/CMV da loja; devolve só o ticket das outras lojas, não as vendas), calculada de `sales_imports`.
