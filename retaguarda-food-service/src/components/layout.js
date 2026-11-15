import { escapeHtml } from "../core/format.js";
import { modules, moduleById } from "../modules/index.js";

function navigation(state) {
  let lastGroup = "";
  return modules.map((item) => {
    let group = "";
    if (item.group !== lastGroup) { lastGroup = item.group; group = '<div class="nav-caption">' + escapeHtml(item.group) + '</div>'; }
    return group + '<button class="nav-link ' + (state.moduleId === item.id ? "selected" : "") +
      '" type="button" data-module="' + escapeHtml(item.id) + '"><span class="nav-icon">' +
      escapeHtml(item.initials) + '</span><span>' + escapeHtml(item.label) + '</span></button>';
  }).join("");
}
export function layout(state, content) {
  const current = moduleById[state.moduleId];
  const signedIn = !!state.session;
  const live = state.mode === "live";
  const options = state.stores.map((s) => '<option value="' + escapeHtml(s.id) + '"' +
    (s.id === state.storeId ? " selected" : "") + '>' + escapeHtml(s.name) + '</option>').join("");
  const userName = signedIn ? (state.session.user?.email || "Usuário") : "Não autenticado";
  return '<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">FS</div><div><strong>RET<span>AGUARDA</span></strong><small>Food Service Suite</small></div></div>' +
    '<div class="nav-scroll">' + navigation(state) + '</div><div class="sidebar-foot"><div class="identity-dot"></div><div><strong>Protótipo v0.1</strong><small>Ambiente de desenvolvimento</small></div></div></aside>' +
    '<div class="main-shell"><header class="topbar"><div class="crumb"><span>Retaguarda</span><span class="slash">/</span><strong>' +
    escapeHtml(current.label) + '</strong></div><div class="top-actions"><span class="top-seal">' +
    (live ? 'Supabase · acesso protegido' : 'Dados fictícios') + '</span><span class="profile">' +
    escapeHtml(signedIn && live ? userName : "Protótipo") + '</span></div></header>' +
    '<main class="main-content"><div class="welcome"><div><span class="eyebrow">PLATAFORMA DE OPERAÇÕES</span><h1>Retaguarda <em>Food Service</em></h1><p>Controle, consistência e decisões melhores para cada loja.</p></div></div>' +
    '<section class="toolbar"><div class="toolbar-group"><label for="store">Unidade selecionada</label><select id="store" ' +
    (options ? "" : "disabled") + '>' + (options || '<option value="">Sem unidades autorizadas</option>') +
    '</select></div><div class="toolbar-group mode-group"><label>Fonte dos dados</label><div class="switcher">' +
    '<button class="' + (!live ? "active" : "") + '" type="button" data-mode="demo">Demonstração</button>' +
    '<button class="' + (live ? "active" : "") + '" type="button" data-mode="live">Supabase</button></div></div></section>' +
    (live ? '<div class="notice live"><strong>Modo Supabase.</strong> Apenas dados autorizados pelas políticas de acesso existentes serão exibidos.</div>' :
      '<div class="notice"><strong>Modo demonstração.</strong> Todos os registros exibidos são fictícios e não são gravados no Supabase.</div>') +
    (state.error ? '<div class="error-box" role="alert">' + escapeHtml(state.error) + '</div>' : "") +
    (live && !signedIn ? loginPanel() : state.loading ? '<div class="loading">Consultando os dados...</div>' : content) +
    '<footer class="footer">Retaguarda Food Service <span>·</span> Protótipo modular <span>·</span> ' +
    (live ? 'Supabase / Retaguarda MFT' : 'Ambiente demonstrativo') + '</footer></main></div></div>';
}
function loginPanel() {
  return '<section class="panel login-panel"><span class="eyebrow">ACESSO CONTROLADO</span><h2>Entrar no Supabase</h2>' +
    '<p>Entre com um usuário já existente no projeto Retaguarda MFT. O banco exige permissões de acesso por loja e por módulo.</p>' +
    '<form id="login-form"><label>E-mail<input type="email" id="email" required placeholder="seu@email.com" autocomplete="username"></label>' +
    '<label>Senha<input type="password" id="password" required placeholder="Sua senha" autocomplete="current-password"></label>' +
    '<button type="submit" class="primary-btn">Entrar com segurança</button></form>' +
    '<p class="form-hint">Nenhuma conta é criada automaticamente. Você pode continuar explorando o modo demonstração.</p></section>';
}
export function accountButton(state) {
  if (state.mode === "live" && state.session) {
    return '<button type="button" id="signout" class="text-btn">Sair da conta</button>';
  }
  return "";
}
