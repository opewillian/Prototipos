import {escapeHtml as e,money} from "../../core/format.js";
import {renderTable} from "../../components/table.js";
export function storeHome(data={},store){
 const counts=data.stock_counts||[],orders=data.purchase_orders||[],invoices=data.invoices||[],cmv=data.cmv_closings||[];
 const recent=cmv.slice().sort((a,b)=>String(b.end_date).localeCompare(String(a.end_date)))[0];
 const cards=[["Contagens",counts.length,"contagem"],["Pedidos de compra",orders.length,"compras"],["Notas fiscais",invoices.length,"notas"],["CMV realizado",recent?money(recent.cmv_value):"—","cmv"]];
 return '<section class="loja-hero"><div><small>VISÃO DA UNIDADE</small><h2>'+e(store?.name||"Sua loja")+'</h2><p>Dados e atividades do seu dia a dia.</p></div><span>OPERAÇÃO FOOD SERVICE</span></section>'+
 '<div class="loja-kpis">'+cards.map(([title,value,module])=>'<button data-module="'+module+'"><small>'+e(title)+'</small><strong>'+e(value)+'</strong><span>Abrir módulo →</span></button>').join("")+'</div>'+
 '<div class="loja-home-cols"><section class="panel"><div class="panel-head"><strong>Compras recentes</strong><button data-module="compras" class="mat-inline-button">Abrir →</button></div>'+
 renderTable(orders.slice(0,5),[{key:"number",label:"Pedido"},{key:"delivery_date",label:"Entrega",kind:"date"},{key:"status",label:"Status",kind:"status"}])+
 '</section><section class="panel"><div class="panel-head"><strong>Inventários recentes</strong><button data-module="contagem" class="mat-inline-button">Abrir →</button></div>'+
 renderTable(counts.slice(0,5),[{key:"display_id",label:"ID"},{key:"count_date",label:"Data",kind:"date"},{key:"status",label:"Status",kind:"status"}])+
 '</section></div>';
}
