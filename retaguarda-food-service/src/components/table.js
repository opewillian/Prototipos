import { escapeHtml, displayValue } from "../core/format.js";

export function renderTable(rows, columns) {
  if (!rows || rows.length === 0) {
    return '<div class="empty"><div class="empty-icon">▤</div><strong>Nenhum registro disponível</strong><p>Confira a unidade selecionada, o cadastro de dados e suas permissões no Supabase.</p></div>';
  }
  const head = columns.map((column) => '<th>' + escapeHtml(column.label) + '</th>').join("");
  const body = rows.map((row) =>
    '<tr>' + columns.map((column) => {
      const value = displayValue(row[column.key], column.kind);
      if (column.kind === "status") return '<td><span class="status-pill">' + escapeHtml(value) + '</span></td>';
      return '<td>' + escapeHtml(value) + '</td>';
    }).join("") + '</tr>'
  ).join("");
  return '<div class="table-scroll"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}
export function renderList(descriptor, rows, mode) {
  return '<div class="section-head"><div><span class="eyebrow">MÓDULO / ' + escapeHtml(descriptor.label.toUpperCase()) +
    '</span><h2>' + escapeHtml(descriptor.title) + '</h2><p>' + escapeHtml(descriptor.description) + '</p></div>' +
    '<span class="number-chip">' + rows.length + ' registros</span></div>' +
    '<section class="panel"><div class="panel-head"><strong>Registros da unidade</strong><small>' +
    (mode === "demo" ? 'Exemplos fictícios' : 'Consulta ao Supabase com RLS') + '</small></div>' +
    renderTable(rows, descriptor.columns) + '</section>' +
    '<div class="note">Esta primeira etapa oferece navegação e leitura. Inclusões, edições e finalizações serão habilitadas posteriormente, módulo por módulo.</div>';
}
