import {escapeHtml as e} from "../core/format.js";
export function renderAreaChoice(){
 return '<main class="area-choice"><header class="choice-header"><div class="choice-logo"><span>FS</span><strong>Retaguarda</strong></div><button id="return-to-entry" class="choice-back">Voltar</button></header>'+
 '<section class="choice-center"><div class="choice-intro"><span class="choice-kicker">ESCOLHA SEU AMBIENTE</span><h1>Como deseja <em>acessar</em>?</h1>'+
 '<p>Matriz e Loja são ambientes independentes. As informações são carregadas exclusivamente do Supabase.</p></div>'+
 '<div class="choice-options">'+
 '<button class="choice-card matrix-choice" data-area="matriz"><span class="choice-symbol">▦</span><span class="choice-arrow">↗</span>'+
 '<strong>Matriz</strong><small>Gestão centralizada de itens, fornecedores, usuários e acompanhamento das unidades.</small><b>Acessar administração →</b></button>'+
 '<button class="choice-card store-choice" data-area="loja"><span class="choice-symbol">▣</span><span class="choice-arrow">↗</span>'+
 '<strong>Loja</strong><small>Contagens, listas, notas fiscais, compras, transferências, perdas e CMV.</small><b>Acessar operação →</b></button></div>'+
 '<p class="choice-note">Dados reais exigem login no Supabase e permissões apropriadas.</p></section></main>';
}
export function renderStoreChoice(stores=[],error=""){
 const operational=stores.filter(s=>s.store_type==="operational");
 return '<main class="store-picker"><div class="picker-top"><button class="choice-back" id="change-area">← Trocar ambiente</button><strong>Retaguarda / Loja</strong></div>'+
 '<section class="picker-center"><span class="choice-kicker">AMBIENTE OPERACIONAL</span><h1>Escolha sua <em>loja</em></h1>'+
 '<p>Todos os registros operacionais pertencem à unidade selecionada.</p>'+
 (error?'<div class="error-box" role="alert">'+e(error)+'</div>':"")+
 (operational.length?'<div class="picker-grid">'+operational.map(s=>'<button class="picker-card" data-choose-store="'+e(s.id)+'">'+
 '<span class="picker-icon">▣</span><span><strong>'+e(s.name)+'</strong><small>'+e(s.code||"Unidade")+'</small></span><b>→</b></button>').join("")+'</div>':
 '<div class="picker-empty"><strong>Nenhuma unidade autorizada</strong><p>O cadastro de lojas é realizado fora da retaguarda.</p></div>')+
 '<p class="picker-caption">Supabase · Somente lojas autorizadas</p></section></main>';
}
