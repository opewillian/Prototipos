import {escapeHtml} from "../../core/format.js";

export const descriptor={
  id:"configuracao",
  label:"Configuração inicial",
  title:"Configuração da operação",
  group:"MATRIZ",
  initials:"CF"
};

const stages=[
  {key:"operationalStores",title:"Unidades operacionais",description:"Cadastre as lojas que utilizarão a retaguarda.",target:"lojas",button:"Gerenciar lojas"},
  {key:"items",title:"Catálogo de itens",description:"Inclua os insumos, embalagens e unidades de medida.",target:"matriz",button:"Gerenciar itens"},
  {key:"suppliers",title:"Fornecedores",description:"Cadastre os fornecedores disponíveis na matriz.",target:"fornecedores",button:"Gerenciar fornecedores"},
  {key:"lists",title:"Listas por loja",description:"Escolha uma loja operacional e prepare suas listas de contagem e compra.",target:"listas",button:"Preparar listas"}
];

export function renderSetup(data={},mode="demo",store=null){
  const counts=Object.fromEntries(stages.map(s=>[s.key,Number(data[s.key]||0)]));
  const selectedOperational=store?.store_type==="operational";
  const done=stages.filter(s=>counts[s.key]>0).length;
  const headline='<div class="section-head"><div><span class="eyebrow">IMPLANTAÇÃO / CADASTROS</span>'+
    '<h2>Configuração inicial</h2>'+
    '<p>Prepare os cadastros centrais e as listas de cada unidade, antes de operar estoque e compras.</p></div>'+
    '<span class="number-chip">'+done+' de 4 etapas iniciadas</span></div>';
  const intro='<section class="setup-intro"><div><span class="eyebrow">MAPA DE IMPLANTAÇÃO</span>'+
    '<h3>Organize a retaguarda em quatro etapas</h3><p>Os números abaixo refletem apenas os registros visíveis para seu usuário no modo selecionado. O acesso real é controlado pelo Supabase.</p></div>'+
    '<div class="setup-counter"><strong>'+done+' / 4</strong><span>Etapas com registros</span></div></section>';
  const cards=stages.map((stage,i)=>{
    const count=counts[stage.key];
    const ready=count>0;
    const label=ready?"Com registros":"Pendente";
    const explanation=(stage.key==="lists"&&!selectedOperational)?
      '<p class="setup-hint">Selecione uma loja operacional no topo antes de cadastrar listas.</p>':"";
    return '<article class="setup-step"><div class="setup-step-top"><span class="setup-step-num">'+String(i+1).padStart(2,"0")+
      '</span><span class="setup-step-state '+(ready?"is-ready":"")+'">'+label+'</span></div>'+
      '<h3>'+escapeHtml(stage.title)+'</h3><p>'+escapeHtml(stage.description)+'</p>'+
      '<div class="setup-step-bottom"><strong>'+count+'</strong><span> registros disponíveis</span></div>'+explanation+
      '<button type="button" class="secondary-btn setup-action" data-module="'+escapeHtml(stage.target)+'">'+escapeHtml(stage.button)+'</button></article>';
  }).join("");
  const detail='<div class="note">A Matriz centraliza cadastros. Cada lista pertence à sua loja e deve reunir itens já existentes no catálogo. Modo atual: '+
    escapeHtml(mode==="demo"?"demonstração — dados fictícios locais":"Supabase — dados protegidos por RLS")+'.</div>';
  return headline+intro+'<div class="setup-grid">'+cards+'</div>'+detail;
}
