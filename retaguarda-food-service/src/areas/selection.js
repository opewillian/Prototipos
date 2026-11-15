import {escapeHtml as e} from "../core/format.js";
export function renderAreaChoice(){
 return `<main class="area-choice"><header class="choice-header"><div class="choice-logo"><span>FS</span><strong>Retaguarda</strong></div><button id="return-to-entry" class="choice-back">Voltar</button></header>
 <section class="choice-center"><div class="choice-intro"><span class="choice-kicker">ESCOLHA SEU AMBIENTE</span><h1>Como deseja <em>acessar</em>?</h1><p>A Matriz e as Lojas são ambientes independentes. Selecione aquele em que deseja trabalhar.</p></div>
 <div class="choice-options">
 <button class="choice-card matrix-choice" data-area="matriz"><span class="choice-symbol">▦</span><span class="choice-arrow">↗</span><strong>Matriz</strong><small>Gestão centralizada de lojas, itens, fornecedores, usuários e acompanhamento de compras.</small><b>Acessar administração →</b></button>
 <button class="choice-card store-choice" data-area="loja"><span class="choice-symbol">▣</span><span class="choice-arrow">↗</span><strong>Loja</strong><small>Rotina operacional de uma unidade: contagens, listas, compras, notas fiscais, transferências, perdas e CMV.</small><b>Acessar operação →</b></button>
 </div><p class="choice-note">A escolha é apenas de interface. Dados reais continuam protegidos pelo Supabase Auth e pelas políticas de acesso do banco.</p></section>
 </main>`;
}
export function renderStoreChoice(stores=[],mode="demo",error=""){
 const operational=stores.filter(s=>s.store_type==="operational"||String(s.id||"").startsWith("demo-"));
 return `<main class="store-picker"><div class="picker-top"><button class="choice-back" id="change-area">← Trocar ambiente</button><strong>Retaguarda / Loja</strong></div>
 <section class="picker-center"><span class="choice-kicker">AMBIENTE OPERACIONAL</span><h1>Escolha sua <em>loja</em></h1><p>As operações e documentos ficam separados por unidade.</p>
 ${error?'<div class="error-box" role="alert">'+e(error)+'</div>':""}
 ${operational.length?'<div class="picker-grid">'+operational.map(s=>'<button class="picker-card" data-choose-store="'+e(s.id)+'"><span class="picker-icon">▣</span><span><strong>'+e(s.name)+'</strong><small>'+e(s.code||"Unidade operacional")+'</small></span><b>→</b></button>').join("")+'</div>':'<div class="picker-empty"><strong>Nenhuma loja operacional disponível</strong><p>Cadastre uma loja pelo ambiente Matriz.</p><button class="secondary-btn" data-area="matriz">Abrir Matriz</button></div>'}
 <p class="picker-caption">${mode==="demo"?"Modo demonstração · lojas fictícias":"Supabase · apenas lojas autorizadas"}</p></section></main>`;
}
