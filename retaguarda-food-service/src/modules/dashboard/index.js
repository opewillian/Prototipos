import { money, escapeHtml } from "../../core/format.js";
import { renderTable } from "../../components/table.js";

function metric(title, value, detail) {
  return '<article class="metric"><span>' + escapeHtml(title) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></article>';
}
export function renderDashboard(data, mode) {
  const counts = data?.stock_counts || [];
  const orders = data?.purchase_orders || [];
  const invoices = data?.invoices || [];
  const cmv = data?.cmv_closings || [];
  const recent = cmv.slice().sort((a,b) => String(b.end_date).localeCompare(String(a.end_date)))[0];
  return '<div class="section-head"><div><span class="eyebrow">PAINEL EXECUTIVO</span><h2>Visão da operação</h2><p>Indicadores dos registros disponíveis para a unidade selecionada.</p></div><span class="number-chip">' +
    (mode === "demo" ? 'Demonstração' : 'Dados autorizados') + '</span></div>' +
    '<div class="metrics">' +
    metric('Contagens', String(counts.length), 'Últimos registros consultados') +
    metric('Pedidos de compra', String(orders.length), 'Últimos registros consultados') +
    metric('Notas fiscais', String(invoices.length), 'Últimos registros consultados') +
    metric('Último CMV calculado', recent ? money(recent.cmv_value) : '—', recent ? 'Fechamento ' + recent.end_date : 'Sem fechamento disponível') +
    '</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><strong>Pedidos recentes</strong><small>Visão rápida</small></div>' +
    renderTable(orders.slice(0,5),[{key:"number",label:"Pedido"},{key:"delivery_date",label:"Entrega",kind:"date"},{key:"status",label:"Status",kind:"status"}]) +
    '</section><section class="panel"><div class="panel-head"><strong>Contagens recentes</strong><small>Inventário</small></div>' +
    renderTable(counts.slice(0,5),[{key:"display_id",label:"ID"},{key:"count_date",label:"Data",kind:"date"},{key:"status",label:"Status",kind:"status"}]) +
    '</section></div><div class="note">O painel apresenta contagens de registros consultados, não totais históricos do banco. Os módulos serão aprofundados nas próximas versões.</div>';
}
