/**
 * Entrada visual do protótipo. Não autentica o usuário nem concede permissões.
 * Os dados reais continuam protegidos pelo Supabase Auth + políticas RLS.
 */
export function renderEntry() {
  return `
    <main class="entry-screen">
      <section class="entry-panel" aria-labelledby="entry-title">
        <div class="entry-logo" aria-hidden="true">FS</div>
        <div class="entry-tag"><span class="entry-tag-dot"></span> Protótipo de retaguarda</div>
        <h1 id="entry-title">Bem-vindo à <span>Retaguarda</span></h1>
        <p class="entry-subtitle">A gestão das suas lojas em um só lugar. Acesse o ambiente para conhecer a estrutura do sistema.</p>
        <button type="button" class="entry-button" id="prototype-enter">
          <span>Entrar</span><span aria-hidden="true" class="entry-arrow">→</span>
        </button>
        <p class="entry-explanation">Acesso imediato, sem e-mail ou senha.</p>
        <div class="entry-bottom">
          <span class="entry-bottom-icon" aria-hidden="true">i</span>
          <span>Esta entrada abre apenas o <strong>modo demonstração</strong>, com dados fictícios. Para consultar ou alterar dados reais, é necessário autenticar-se no Supabase dentro do sistema.</span>
        </div>
      </section>
      <aside class="entry-art" aria-hidden="true">
        <div class="entry-art-heading">RET<span>AGUARDA</span><small>FOOD SERVICE</small></div>
        <div class="entry-art-card">
          <div class="entry-art-card-header"><span>Visão da operação</span><i></i></div>
          <div class="entry-art-grid">
            <div><small>Unidades</small><strong>02</strong><em>Visão consolidada</em></div>
            <div><small>Contagens</small><strong>03</strong><em>Inventários</em></div>
          </div>
          <div class="entry-art-chart"><span style="--bar:42%"></span><span style="--bar:62%"></span><span style="--bar:51%"></span><span style="--bar:78%"></span><span style="--bar:69%"></span><span style="--bar:91%"></span><span style="--bar:74%"></span></div>
          <div class="entry-art-lines"><i></i><i></i><i></i></div>
        </div>
        <div class="entry-art-foot">Uma plataforma. Todas as suas operações.</div>
      </aside>
    </main>`;
}
