// Tour guiado da Retaguarda (botão "Tour" na barra superior).
// Ao clicar, abre o tour DA TELA ATUAL (cada módulo e cada tela de detalhe tem o seu); no fim oferece o tour geral
// do sistema (menu, ambiente, loja e grupos). Tela sem tour próprio abre direto o geral.
// Cada passo destaca uma parte da tela: "sel" (seletor CSS) ou "find" (função que devolve o elemento). Passo cujo
// elemento não existe na tela (módulo não liberado, botão que só aparece em rascunho etc.) é pulado sozinho.
// Teclado: → avança, ← volta, Esc fecha.  Ao mudar uma tela, atualize os passos dela aqui (SCREENS).
import {e} from "./format.js";

// ---------------------------------------------------------------- Localizadores
const $=s=>document.querySelector(s);
const inContent=s=>"#content "+s;
/** Card da tela cujo título contém o texto. */
const cardT=t=>()=>[...document.querySelectorAll("#content .card")].find(k=>(k.querySelector(".card-head,header,h2,h3")?.innerText||"").toLowerCase().includes(t.toLowerCase()))||null;
/** Card que contém a tabela principal. */
const tableCard=()=>$("#content table")?.closest(".card")||null;
/** Barra de filtros: o card de filtros ou a linha com a busca. */
const filters=()=>{
 const fb=$("#content .fbar-card");if(fb)return fb;
 const q=$("#content #q");if(!q)return null;
 let p=q;while(p.parentElement&&!p.parentElement.classList.contains("card")&&p.parentElement.id!=="content")p=p.parentElement;
 return p;
};
const btn=a=>inContent("[data-"+a+"]");
const head=()=>$("#content .page-head")||$("#content .doc-head");

// ---------------------------------------------------------------- Tours de cada tela
// Chave: "area:modulo" (lista) ou "area:modulo:detalhe" (um documento aberto).
const SCREENS={
 // ---------------- Matriz
 "matriz:painel":[
  {title:"Painel da Matriz",text:"O faturamento líquido de todas as lojas, dia a dia, numa tabela só."},
  {sel:inContent(".pm-month"),title:"Mês",text:"Troque o mês nas setas. O mês atual vai até ontem (as vendas entram no dia seguinte)."},
  {sel:inContent(".pm-table"),title:"Lojas por marca",text:"Lojas agrupadas pela marca (DEL primeiro) e ordenadas pelo aeroporto. A linha da marca soma as lojas; a última linha é a rede. A tabela abre no fim do mês; role para o lado para ver os outros dias. De hoje em diante os valores são a projeção (em itálico). As duas últimas colunas são o Total geral (realizado até ontem) e o Total projetado (realizado + projeção até o fim do mês). Clique numa loja para abrir o faturamento dela."},
  {find:cardT("Ranking de faturamento"),title:"Ranking de faturamento",text:"As lojas do maior para o menor faturamento realizado no mês, com a participação de cada uma no total da rede. Tem o próprio seletor de mês e mostra 10 lojas por página."},
  {sel:inContent(".pm-pies"),title:"Participação por marca e aeroporto",text:"Pizzas com a participação de cada marca (1º pedaço do código) e de cada aeroporto (2º pedaço) no faturamento do mês. Clique numa fatia ou na legenda para abrir uma tela com as lojas daquele grupo."},
  {find:cardT("Faturamento mês a mês"),title:"Faturamento mês a mês",text:"A rede inteira mês a mês: este ano (vinho), o ano passado (cinza tracejado) e a projeção até dezembro (tracejado claro). O mês atual soma o realizado e a projeção diária; os meses seguintes usam o mesmo mês do ano passado corrigido pelo crescimento dos 3 últimos meses fechados. Passe o mouse para ver como cada mês foi projetado."}
 ],
 "matriz:pedidos":[
  {title:"Pedidos das lojas",text:"Todos os pedidos de compra feitos pelas lojas, em um lugar só."},
  {sel:inContent(".kpis"),title:"Resumo",text:"Pedidos em aberto (com o valor), atrasados, rascunhos nas lojas e realizados nos últimos 30 dias."},
  {find:filters,title:"Filtros",text:"Busque pelo número do pedido ou fornecedor e filtre por loja e situação."},
  {find:tableCard,title:"Lista de pedidos",text:"Clique em um pedido para ver os itens, quantidades e valores."},
  {find:cardT("Em aberto por fornecedor"),title:"Em aberto por fornecedor",text:"Quanto está pedido e ainda não entregue em cada fornecedor."}
 ],
 "matriz:notas":[
  {title:"Notas fiscais",text:"Notas de todas as lojas que você acessa, para acompanhar o que já deu entrada e o que está pendente."},
  {sel:inContent(".kpis"),title:"Resumo",text:"Total de notas, pendentes e recebidas (com os valores) e estornos feitos."},
  {find:filters,title:"Filtros",text:"Busque por número, fornecedor ou chave de acesso e filtre por loja, situação, fornecedor e período."},
  {find:tableCard,title:"Lista de notas",text:"Emissão, data de entrada, valor e situação de cada nota. Clique para abrir."},
  {find:cardT("Histórico de estornos"),title:"Histórico de estornos",text:"Notas que tiveram a entrada desfeita: quando, o motivo e o que saiu do estoque."}
 ],
 "matriz:itens":[
  {title:"Itens",text:"Cadastro central de itens, usado por todas as lojas em contagens, listas, pedidos, notas e CMV."},
  {sel:inContent(".kpis"),title:"Números do cadastro",text:"Itens ativos, quantos compõem o CMV, quantos tipos e quantos estão inativos."},
  {sel:btn("new"),title:"Novo item",text:"Cadastra um item: nome, tipo, marca, unidade, custo padrão e estoque mínimo."},
  {find:filters,title:"Filtros",text:"Busque por nome ou código e filtre por tipo, marca e situação (ativos ou inativos)."},
  {find:tableCard,title:"Lista de itens",text:"Clique em um item para editar. O custo padrão é usado quando a loja ainda não tem compra recebida do item. A coluna CMV mostra se o item entra no cálculo do CMV."}
 ],
 "matriz:marcas":[
  {title:"Marcas",text:"A marca define em quais lojas o item aparece. Itens \"Global\" aparecem em todas as lojas."},
  {sel:inContent(".kpis"),title:"Números do cadastro",text:"Resumo das marcas cadastradas."},
  {sel:btn("new"),title:"Nova marca",text:"Cria uma marca e escolhe as lojas dela."},
  {find:tableCard,title:"Lista de marcas",text:"Quantas lojas e itens cada marca tem. Clique para editar."}
 ],
 "matriz:fornecedores":[
  {title:"Fornecedores",text:"Cadastro central de fornecedores, usado nos pedidos e nas notas de todas as lojas."},
  {sel:inContent(".kpis"),title:"Números do cadastro",text:"Resumo dos fornecedores cadastrados."},
  {sel:btn("new"),title:"Novo fornecedor",text:"Cadastra nome, CNPJ/CPF e contato."},
  {find:filters,title:"Busca",text:"Encontre pelo nome, código ou CNPJ."},
  {find:tableCard,title:"Lista de fornecedores",text:"Mostra quantos itens estão vinculados a cada fornecedor. Clique para editar."}
 ],
 "matriz:depara":[
  {title:"De-para de fornecedores",text:"Liga o produto como vem escrito na nota do fornecedor ao nosso item, com o fator de conversão. É o que faz a nota entrar certo no estoque."},
  {sel:btn("new"),title:"Novo de-para",text:"Escolha o fornecedor, o produto da nota, o nosso item e quanto 1 unidade da nota vale na nossa unidade (ex.: 1 caixa = 12 un)."},
  {find:filters,title:"Filtros",text:"Busque por código, descrição ou item e filtre por fornecedor e situação."},
  {find:tableCard,title:"Lista de de-para",text:"Confira a conversão: fator errado gera custo e quantidade errados no estoque e no CMV."}
 ],
 "matriz:usuarios":[
  {title:"Usuários e acessos",text:"Quem usa o sistema e o que cada pessoa pode ver."},
  {sel:inContent(".kpis"),title:"Resumo",text:"Usuários ativos, quantos acessam a Matriz, quantos acessam lojas e quem ainda está sem acesso."},
  {find:filters,title:"Busca",text:"Encontre a pessoa pelo nome."},
  {find:tableCard,title:"Usuários",text:"Clique em uma pessoa para liberar a Matriz, as lojas e os módulos dela. Conta nova é criada no Supabase e aparece aqui sozinha, sem acesso."}
 ],
 "matriz:log":[
  {title:"Log de alterações",text:"Registro de quem mudou o quê e quando: cadastros, acessos e documentos."},
  {sel:inContent(".kpis"),title:"Resumo",text:"Alterações de hoje e dos últimos 90 dias, quantas pessoas alteraram e quantas mudanças de acesso houve."},
  {find:filters,title:"Filtros",text:"Busque por pessoa ou registro e filtre pelo tipo de alteração e pela loja (ou Matriz)."},
  {find:tableCard,title:"Alterações",text:"Data e hora, pessoa, ação, onde aconteceu e os detalhes da mudança."}
 ],
 // ---------------- Loja
 "loja:inicio":[
  {title:"Início da loja",text:"O resumo da loja: vendas, ranking da marca, CMV e notas pendentes."},
  {find:()=>$("#content [data-chart]")?.closest(".card"),title:"Vendas",text:"Linha cheia: o que já foi vendido. Pontilhada vinho: a projeção até o fim do mês (recalculada todo dia às 6h30). Passe o mouse para ver os valores."},
  {sel:inContent(".chart-ctrls"),title:"Medida e visão",text:"Escolha o que ver — Faturamento, Ticket médio, Cupons ou Taxa de oportunidade (faturamento por passageiro da área da loja no aeroporto, por mês; passe o mouse para ver passageiros e cupons) — e a visão. No mês a mês, a linha cinza tracejada é o ano anterior. Por hora mostra quanto a loja vende, em média por dia, em cada hora — e o horário de pico — comparando com o mês anterior."},
  {find:cardT("Ranking de ticket médio"),title:"Ranking de ticket médio",text:"As lojas da mesma marca, do ticket médio que mais subiu ao que mais caiu, comparando o mês passado com este mês (até ontem). A sua loja aparece em destaque."},
  {find:cardT("CMV por período"),title:"CMV por período",text:"Cada período entre duas contagens seguidas, com o CMV e o percentual sobre o faturamento. Clique para abrir o cálculo."},
  {find:cardT("Notas pendentes"),title:"Notas pendentes de entrada",text:"Notas lançadas que ainda não entraram no estoque, das mais novas para as mais antigas. Enquanto pendentes, ficam fora do CMV. Clique para abrir a nota."}
 ],
 "loja:faturamento":[
  {title:"Faturamento",text:"Vendas do caixa (Degust), importadas automaticamente todo dia às 6h."},
  {find:()=>$("#content [data-q]")?.closest(".card"),title:"Período",text:"Escolha as datas ou use os atalhos (este mês, mês passado, últimos 7 dias)."},
  {sel:btn("import"),title:"Importar vendas",text:"Busca de novo as vendas do período no Degust. Use se algum dia ficou faltando."},
  {find:cardT("Resumo do período"),title:"Resumo do período",text:"Vendas, bruto, descontos, líquido e ticket médio. O líquido é o usado no CMV e nos gráficos."},
  {find:cardT("Por dia"),title:"Por dia",text:"Fica fechado: clique no título para abrir. Mostra o faturamento de cada dia do período. Clique em um dia para ver todos os recibos dele, e em um recibo para abri-lo (a partir de 01/10/2026)."},
  {find:cardT("Produtos vendidos"),title:"Produtos vendidos",text:"Clique no título para abrir. O que mais vendeu, com quantidade e participação, e uma busca para achar um produto."},
  {find:cardT("Formas de pagamento"),title:"Formas de pagamento",text:"Clique no título para abrir. Quanto entrou em cada forma de pagamento e bandeira."}
 ],
 "loja:contagem":[
  {title:"Contagem de estoque",text:"O inventário da loja. As contagens são a base do CMV: o estoque inicial e o final de cada período."},
  {sel:btn("new"),title:"Nova contagem",text:"Começa uma contagem na data escolhida. Só pode existir uma contagem por dia."},
  {find:filters,title:"Filtros",text:"Busque pelo número ou observação e filtre por situação e período."},
  {find:tableCard,title:"Contagens",text:"Rascunho ainda pode mudar; finalizada vale para o CMV. Clique para abrir."}
 ],
 "loja:contagem:detalhe":[
  {title:"Contagem",text:"Aqui você lança as quantidades contadas de cada item."},
  {find:head,title:"Cabeçalho",text:"Código da contagem, situação e as ações. Enquanto estiver em rascunho, tudo pode ser corrigido."},
  {sel:btn("via-list"),title:"Adicionar via lista",text:"Traz para a contagem todos os itens de uma lista pronta (ex.: lista da câmara fria)."},
  {sel:inContent("#q"),title:"Buscar item",text:"Encontre rápido um item na contagem."},
  {find:tableCard,title:"Itens contados",text:"Informe a quantidade em cada unidade (caixa, pacote, kg...): o sistema converte para a unidade padrão e calcula o valor pelo custo da última compra (sem compra, o custo padrão)."},
  {sel:btn("finalize"),title:"Finalizar contagem",text:"Trava a contagem. Só contagens finalizadas fecham o CMV."},
  {sel:btn("cancel"),title:"Cancelar",text:"Cancela a contagem (ela deixa de valer, mas fica registrada)."}
 ],
 "loja:listas":[
  {title:"Listas",text:"Listas de itens para contar ou pedir sempre do mesmo jeito (ex.: por setor ou fornecedor)."},
  {sel:btn("new"),title:"Nova lista",text:"Cria uma lista e escolhe os itens."},
  {sel:btn("import"),title:"Importar planilha",text:"Cria a lista a partir de uma planilha."},
  {find:tableCard,title:"Suas listas",text:"Clique em uma lista para editar, imprimir ou exportar."}
 ],
 "loja:listas:detalhe":[
  {title:"Lista",text:"Os itens desta lista, na ordem em que aparecem na contagem."},
  {find:head,title:"Ações",text:"Importar ou exportar planilha, imprimir para contar no papel, editar o nome ou excluir a lista."},
  {sel:inContent("#add-item"),find:()=>$("#content #add-item")?.closest(".card-head,.toolbar,div"),title:"Adicionar itens",text:"Digite o nome ou código para incluir um item, ou escolha um tipo para adicionar todos os itens dele de uma vez."},
  {find:tableCard,title:"Itens da lista",text:"A ordem da lista é a ordem da contagem."}
 ],
 "loja:transferencias":[
  {title:"Transferências",text:"Mercadoria que sai desta loja para outra unidade, ou chega de outra. Entra no CMV das duas lojas."},
  {sel:btn("new"),title:"Nova transferência",text:"Escolha a loja de destino e os itens. Ao emitir, sai do estoque desta loja e entra no da outra."},
  {sel:btn("print-form"),title:"Imprimir formulário",text:"Folha em branco para anotar a transferência no papel e lançar depois."},
  {find:filters,title:"Filtros",text:"Veja enviadas ou recebidas e filtre por situação, loja e período."},
  {find:tableCard,title:"Transferências",text:"Rascunho não entra no CMV: só as emitidas. Clique para abrir."}
 ],
 "loja:transferencias:detalhe":[
  {title:"Transferência",text:"Os itens que saíram de uma loja para a outra."},
  {find:head,title:"Cabeçalho",text:"Número, lojas de origem e destino, data e situação."},
  {find:cardT("Itens"),title:"Itens",text:"Quantidade e custo de cada item (custo da última compra na loja que envia). O valor sai do CMV de quem envia e entra no de quem recebe."}
 ],
 "loja:perdas":[
  {title:"Perdas",text:"O que foi descartado (vencido, quebrado, erro de preparo...). Aparece no CMV e em % do faturamento."},
  {sel:btn("new"),title:"Registrar perda",text:"Informe a data, o motivo e os itens perdidos."},
  {sel:btn("print-form"),title:"Imprimir formulário",text:"Folha para anotar as perdas no dia a dia e lançar depois."},
  {find:filters,title:"Filtros",text:"Filtre por motivo, situação e período."},
  {find:tableCard,title:"Perdas",text:"Clique em uma perda para ver os itens."}
 ],
 "loja:perdas:detalhe":[
  {title:"Perda",text:"Os itens perdidos neste registro."},
  {find:head,title:"Cabeçalho",text:"Data, motivo e situação da perda."},
  {find:cardT("Itens perdidos"),title:"Itens perdidos",text:"Quantidade e valor de cada item."}
 ],
 "loja:pedidos":[
  {title:"Pedidos de compra",text:"Pedidos da loja aos fornecedores, com sugestão de quantidade pelo consumo."},
  {sel:btn("new"),title:"Novo pedido",text:"Cria o pedido na hora (entrega em 2 dias, com base na última contagem finalizada) e já sugere quanto pedir de cada item."},
  {find:tableCard,title:"Pedidos",text:"Entrega, quantidade de itens, total e situação. Clique para abrir."}
 ],
 "loja:pedidos:detalhe":[
  {title:"Pedido de compra",text:"Monte o pedido com a ajuda da sugestão."},
  {find:head,title:"Ações",text:"Imprimir, enviar ou cancelar o pedido."},
  {find:()=>$("#content [data-head]")?.closest(".card"),title:"Dados do pedido",text:"Data de entrega, a contagem usada como base da sugestão e observações."},
  {sel:btn("recalc"),title:"Recalcular sugestões",text:"Refaz a sugestão com os dados atuais: o que foi contado, o consumo médio e o que já está pedido e não chegou."},
  {sel:btn("apply"),title:"Solicitado = sugerido",text:"Copia a sugestão para a quantidade pedida de todos os itens. Depois é só ajustar o que quiser."},
  {sel:inContent("#add-item"),title:"Incluir item",text:"Adiciona um item que não está no pedido."},
  {find:tableCard,title:"Itens do pedido",text:"Contado, média de consumo em 10 dias (entre as duas últimas contagens finalizadas), em aberto, sugerido e solicitado, com custo e fornecedor."}
 ],
 "loja:notas":[
  {title:"Notas fiscais",text:"As compras da loja. Ao dar entrada, a nota passa a contar no estoque e no CMV (pela data de entrada)."},
  {sel:btn("new"),title:"Lançar nota",text:"Lança uma nota nova da loja."},
  {find:filters,title:"Filtros",text:"Busque por número ou fornecedor e filtre pela situação."},
  {find:tableCard,title:"Notas",text:"Emissão, entrada, valor, pagamento e situação. Clique para abrir."}
 ],
 "loja:notas:detalhe":[
  {title:"Nota fiscal",text:"Confira a nota antes de dar entrada no estoque."},
  {find:head,title:"Ações",text:"Editar os dados, cancelar ou dar entrada no estoque."},
  {sel:inContent(".doc-meta"),title:"Dados da nota",text:"Fornecedor, emissão, data de entrada e valores. A data de entrada é a que vale no CMV."},
  {find:cardT("Itens da nota"),title:"Itens da nota",text:"Cada produto da nota ligado ao nosso item pelo de-para, já convertido para a nossa unidade."},
  {find:cardT("Outros custos"),title:"Outros custos",text:"Frete, descontos, ICMS ST e outras diferenças que entram no custo da nota."},
  {find:cardT("Pagamentos"),title:"Pagamentos",text:"Parcelas e vencimentos. \"Gerar parcelas\" divide o valor automaticamente."},
  {find:cardT("Anexos"),title:"Anexos",text:"Guarde aqui o XML, o PDF ou a foto da nota."},
  {sel:btn("receive"),title:"Dar entrada no estoque",text:"Depois de conferir tudo, a nota entra no estoque e passa a contar no CMV."}
 ],
 "loja:cmv":[
  {title:"CMV",text:"Custo da mercadoria vendida entre duas contagens: estoque inicial + compras + transferências recebidas − enviadas − estoque final."},
  {sel:inContent("[data-open]"),find:()=>$("#content [data-open]")?.closest(".card"),title:"Escolha o período",text:"Abra o calendário: só os dias com contagem podem ser escolhidos. A 1ª data é o estoque inicial e a 2ª o final (contagens em rascunho também aparecem)."},
  {sel:btn("go"),title:"Calcular CMV",text:"Mostra o cálculo com a memória de cada item."}
 ],
 "loja:cmv:detalhe":[
  {title:"Resultado do CMV",text:"O cálculo completo do período, item por item."},
  {sel:btn("analise"),title:"Análise completa",text:"Aponta o que merece atenção: notas pendentes, custos fora do padrão, itens com CMV negativo e mais."},
  {find:cardT("Resumo do período"),title:"Resumo do período",text:"Estoque inicial, compras, transferências, perdas, estoque final, CMV e o percentual sobre o faturamento líquido. Clique em \"Compras recebidas\" para ver as notas."},
  {find:cardT("Memória de cálculo"),title:"Memória de cálculo",text:"Clique no nome do item para ver todas as movimentações dele, ou em um número para ver o detalhe. Em contagem de rascunho, clicar no estoque permite corrigir a quantidade."}
 ]
};

// ---------------------------------------------------------------- Tour geral do sistema
const grp=name=>'.sb-group[data-group="'+name+'"]';
function generalSteps(area){
 const common=[
  {title:"Bem-vindo à Retaguarda",text:"A Retaguarda junta estoque, compras, faturamento e CMV das lojas em um só lugar. Este tour mostra onde fica cada coisa."},
  {sel:".sb",side:"right",title:"Menu",text:"Aqui ficam os módulos, separados por grupo. Você só vê o que foi liberado para o seu usuário. O botão ☰ no topo recolhe ou abre o menu."},
  {sel:".sb-search",side:"right",title:"Pesquisar no menu",text:"Digite o nome de uma tela (ex.: \"notas\") e aperte Enter para ir direto a ela."},
  {sel:"[data-env-field]:not([hidden])",title:"Ambiente",text:"Matriz é a visão central: cadastros e acompanhamento de todas as lojas. Loja é a rotina do dia a dia de uma unidade."},
  {sel:"#store-combo",title:"Loja",text:"Troque de loja por aqui, buscando pelo nome ou código. Atalho: Ctrl+K. Ao trocar, você continua na mesma tela."}
 ];
 const loja=[
  {sel:'#nav a[href$="/inicio"]',side:"right",title:"Início",text:"Resumo da loja: faturamento do mês com a projeção, comparação com o ano anterior e CMV de cada período."},
  {sel:grp("Financeiro"),side:"right",title:"Financeiro · Faturamento",text:"Vendas do caixa (Degust), importadas automaticamente todo dia às 6h: por dia, produtos e formas de pagamento."},
  {sel:grp("Estoque"),side:"right",title:"Estoque",text:"Contagem (inventário por listas), Listas, Transferências entre lojas e Perdas."},
  {sel:grp("Compras"),side:"right",title:"Compras",text:"Pedidos de compra com sugestão pelo consumo e Notas fiscais, que ao dar entrada contam no estoque e no CMV."},
  {sel:grp("Análise"),side:"right",title:"Análise · CMV",text:"Escolha duas contagens e veja o CMV com a memória de cálculo e a Análise completa."}
 ];
 const matriz=[
  {sel:'#nav a[href$="/painel"]',side:"right",title:"Painel",text:"Faturamento de todas as lojas, dia a dia, agrupadas por marca."},
  {sel:'#nav a[href$="/pedidos"]',side:"right",title:"Pedidos das lojas",text:"Todos os pedidos de compra das lojas, com filtro por loja, fornecedor e situação."},
  {sel:'#nav a[href$="/notas"]',side:"right",title:"Notas fiscais",text:"Notas de todas as lojas que você acessa, para acompanhar o que está pendente de entrada."},
  {sel:grp("Cadastros"),side:"right",title:"Cadastros",text:"Itens, marcas, fornecedores e de-para valem para todas as lojas. Em Usuários e acessos você libera lojas e módulos; o Log mostra quem mudou o quê."}
 ];
 const end=[{sel:"[data-tour]",title:"Pronto!",text:"Em cada tela, o botão Tour explica aquela tela. Clique sempre que precisar."}];
 return [...common,...(area==="matriz"?matriz:loja),...end];
}

/** Tela atual pela rota: #/matriz/<mod>[/...] ou #/loja/<loja>/<mod>[/...]. */
function screenKey(){
 const p=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);
 if(p[0]==="matriz")return {area:"matriz",key:"matriz:"+(p[1]||"painel")+(p[2]?":detalhe":"")};
 if(p[0]==="loja")return {area:"loja",key:"loja:"+(p[2]||"inicio")+(p[3]?":detalhe":"")};
 return {area:null,key:null};
}

let active=null;

/** Botão Tour: tour da tela atual; sem tour próprio, o geral. */
export function startTour(root){
 const {key}=screenKey();
 const screen=key&&SCREENS[key];
 if(screen&&runTour(root,screen,{general:true}))return;
 startGeneralTour(root);
}
export function startGeneralTour(root){
 const shell=root.querySelector("#shell");
 runTour(root,generalSteps(shell?.dataset.area||screenKey().area),{});
}

function runTour(root,all,{general=false}){
 if(active)active.close();
 const shell=root.querySelector("#shell");
 const mobile=()=>window.matchMedia("(max-width:960px)").matches;
 const target=s=>s.find?s.find():s.sel?root.querySelector(s.sel):null;
 const list=all.filter(s=>(!s.sel&&!s.find)||visible(target(s)));
 if(list.length<2&&general)return false;   // tela sem nada para mostrar: usa o geral
 if(!list.length)return false;
 const wasCollapsed=shell?.classList.contains("collapsed");
 const ov=document.createElement("div");
 ov.className="tour";ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-label","Tour");
 ov.innerHTML='<div class="tour-hole" hidden></div><div class="tour-card" role="document"><div class="tour-step"></div><h3></h3><p></p>'+
  '<div class="tour-actions"><button type="button" class="btn btn-ghost" data-tour-skip>Sair do tour</button><span class="tour-sp"></span>'+
  '<button type="button" class="btn btn-ghost" data-tour-prev>Voltar</button><button type="button" class="btn btn-primary" data-tour-next>Próximo</button></div>'+
  (general?'<button type="button" class="tour-general" data-tour-general hidden>Ver o tour geral do sistema →</button>':'')+'</div>';
 document.body.appendChild(ov);
 const hole=ov.querySelector(".tour-hole"),card=ov.querySelector(".tour-card");
 let i=0;
 function place(){
  const s=list[i],el=target(s);
  const vw=window.innerWidth,vh=window.innerHeight,cw=Math.min(360,vw-32);
  card.style.width=cw+"px";
  ov.classList.toggle("tour-dim",!el);
  if(!el){hole.hidden=true;card.style.left=Math.round((vw-cw)/2)+"px";card.style.top=Math.round(Math.max(16,(vh-card.offsetHeight)/2))+"px";return}
  const r=el.getBoundingClientRect(),pad=6;
  // Destaque limitado à parte visível da tela (tabelas longas).
  const top0=Math.max(r.top-pad,4),bot0=Math.min(r.bottom+pad,vh-4);
  Object.assign(hole.style,{left:(r.left-pad)+"px",top:top0+"px",width:(r.width+pad*2)+"px",height:Math.max(0,bot0-top0)+"px"});hole.hidden=false;
  const ch=card.offsetHeight;let left,top;
  if(s.side==="right"&&r.right+16+cw<=vw){left=r.right+16;top=r.top}
  else if(r.bottom+14+ch<=vh-16){left=r.left;top=r.bottom+14}
  else if(r.top-14-ch>=16){left=r.left;top=r.top-ch-14}
  else{left=vw-cw-24;top=vh-ch-24}               // elemento grande: balão no canto
  left=Math.max(16,Math.min(left,vw-cw-16));top=Math.max(16,Math.min(top,vh-ch-16));
  card.style.left=Math.round(left)+"px";card.style.top=Math.round(top)+"px";
 }
 function show(n){
  i=Math.max(0,Math.min(list.length-1,n));
  const s=list[i],el=target(s);
  // Passos do menu: abre o menu (recolhido no computador ou escondido no celular).
  const inMenu=!!el?.closest(".sb");
  if(shell){
   if(mobile())shell.classList.toggle("nav-open",inMenu);
   else shell.classList.toggle("collapsed",inMenu?false:!!wasCollapsed);
   if(inMenu&&el.classList.contains("sb-group"))el.classList.add("open");
  }
  const last=i===list.length-1;
  ov.querySelector(".tour-step").textContent=(i+1)+" de "+list.length;
  ov.querySelector("h3").textContent=s.title;
  ov.querySelector("p").innerHTML=e(s.text);
  ov.querySelector("[data-tour-prev]").hidden=i===0;
  ov.querySelector("[data-tour-next]").textContent=last?"Concluir":"Próximo";
  const g=ov.querySelector("[data-tour-general]");if(g)g.hidden=!last;
  if(el){const r=el.getBoundingClientRect();if(r.top<70||r.bottom>window.innerHeight)el.scrollIntoView({block:r.height>window.innerHeight*0.6?"start":"center"});}
  requestAnimationFrame(place);
  ov.querySelector("[data-tour-next]").focus();
 }
 const onKey=ev=>{
  if(ev.key==="Escape"){ev.preventDefault();close()}
  else if(ev.key==="ArrowRight"){ev.preventDefault();next()}
  else if(ev.key==="ArrowLeft"){ev.preventDefault();show(i-1)}
 };
 const next=()=>i===list.length-1?close():show(i+1);
 function close(){
  ov.remove();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("keydown",onKey,true);
  if(shell){shell.classList.remove("nav-open");shell.classList.toggle("collapsed",!!wasCollapsed)}
  active=null;root.querySelector("[data-tour]")?.focus();
 }
 ov.querySelector("[data-tour-next]").onclick=next;
 ov.querySelector("[data-tour-prev]").onclick=()=>show(i-1);
 ov.querySelector("[data-tour-skip]").onclick=close;
 const g=ov.querySelector("[data-tour-general]");if(g)g.onclick=()=>{close();startGeneralTour(root)};
 ov.addEventListener("click",ev=>{if(ev.target===ov)close()});
 window.addEventListener("resize",place);window.addEventListener("scroll",place,true);document.addEventListener("keydown",onKey,true);
 active={close};
 show(0);
 return true;
}

// O passo só entra se o elemento existe e aparece (o menu conta mesmo recolhido ou escondido no celular: o tour abre).
function visible(el){
 if(!el||el.closest("[hidden]"))return false;
 if(el.closest(".sb"))return true;
 return el.getClientRects().length>0;
}
