import {escapeHtml as e} from "../../core/format.js";
import {renderTable} from "../../components/table.js";
export function matrixHome(data={},mode="demo"){
 const shops=data.stores||[],orders=data.orders||[];
 const kpis=[["Lojas operacionais",shops.length,"Unidades ativas"],["Itens cadastrados",data.items||0,"Catálogo da matriz"],["Fornecedores",data.suppliers||0,"Cadastro central"],["Pedidos consultados",orders.length,"Até 200 recentes"]];
 return '<section class="mat-hero"><div><small>GESTÃO CENTRALIZADA</small><h2>Uma visão de todas as unidades.</h2><p>Administre cadastros e acompanhe a operação por uma interface exclusiva da Matriz.</p></div><button data-module="configuracao">Iniciar configuração →</button></section>'+
 '<div class="mat-kpis">'+kpis.map(([title,val,detail])=>'<article><small>'+e(title)+'</small><strong>'+e(val)+'</strong><span>'+e(detail)+'</span></article>').join("")+'</div>'+
 '<div class="mat-home-cols"><section class="panel"><div class="panel-head"><strong>Unidades</strong><button class="mat-inline-button" data-module="lojas">Gerenciar →</button></div>'+
 (shops.length?shops.map(s=>'<div class="mat-store-row"><b>L</b><span>'+e(s.name)+'<small>'+e(s.code||"")+'</small></span></div>').join(""):'<div class="empty"><strong>Sem lojas</strong><p>Cadastre a primeira unidade.</p></div>')+
 '</section><section class="panel"><div class="panel-head"><strong>Pedidos recentes</strong><button class="mat-inline-button" data-module="pedidos-matriz">Ver pedidos →</button></div>'+
 renderTable(orders.slice(0,5),[{key:"number",label:"Pedido"},{key:"delivery_date",label:"Entrega",kind:"date"},{key:"status",label:"Situação",kind:"status"}])+'</section></div>'+
 '<div class="note">'+(mode==="demo"?"Indicadores de demonstração, sem dados reais.":"Indicadores dos dados autorizados pela Matriz.")+'</div>';
}
export function matrixOrders(rows=[],stores=[]){
 const storeNames=new Map(stores.map(s=>[s.id,s.name]));
 return '<div class="section-head"><div><span class="eyebrow">ADMINISTRAÇÃO / COMPRAS</span><h2>Pedidos de todas as lojas</h2><p>Consulta central dos pedidos. Nesta versão, as mudanças de status continuam dentro da operação da loja.</p></div><span class="number-chip">'+rows.length+' registros</span></div>'+
 '<section class="panel"><div class="panel-head"><strong>Pedidos recebidos</strong><small>Até 200 registros recentes</small></div>'+
 renderTable(rows.map(r=>({...r,store_name:storeNames.get(r.store_id)||r.store_id})),[
 {key:"number",label:"Número"},{key:"store_name",label:"Unidade"},{key:"delivery_date",label:"Entrega",kind:"date"},{key:"status",label:"Situação",kind:"status"}])+'</section>';
}
