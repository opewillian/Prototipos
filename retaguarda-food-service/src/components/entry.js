/**
 * Entrada visual do sistema. Não autentica nem concede permissões.
 * Os dados reais continuam protegidos pelo Supabase Auth + políticas RLS.
 */
export function renderEntry() {
  return `
    <main class="entry-screen">
      <section class="entry-panel" aria-labelledby="entry-title">
        <div class="entry-logo" aria-hidden="true">FS</div>
        <div class="entry-tag"><span class="entry-tag-dot"></span> Gestão de operações</div>
        <h1 id="entry-title">Bem-vindo à <span>Retaguarda</span></h1>
        <p class="entry-subtitle">A gestão das suas lojas em um só lugar. Acesse a plataforma para gerenciar as unidades autorizadas.</p>
        <button type="button" class="entry-button" id="prototype-enter">
          <span>Entrar</span><span aria-hidden="true" class="entry-arrow">→</span>
        </button>
        <p class="entry-explanation">Selecione seu ambiente para continuar.</p>
        <div class="entry-bottom">
          <span class="entry-bottom-icon" aria-hidden="true">i</span>
          <span>Os dados vêm exclusivamente do Supabase. Para consultar ou alterar registros, entre com uma conta autorizada.</span>
        </div>
      </section>
      <aside class="entry-art" aria-hidden="true">
        <div class="entry-art-heading">RET<span>AGUARDA</span><small>FOOD SERVICE</small></div>
        <div class="entry-art-card">
          <div class="entry-art-card-header"><span>Ambientes independentes</span><i></i></div>
          <div class="entry-art-grid">
            <div><small>Administração</small><strong>Matriz</strong><em>Cadastros centrais</em></div>
            <div><small>Operação</small><strong>Loja</strong><em>Dados por unidade</em></div>
          </div>
          <div class="entry-art-lines"><i></i><i></i><i></i></div>
        </div>
        <div class="entry-art-foot">Dois ambientes, uma operação conectada.</div>
      </aside>
    </main>`;
}
