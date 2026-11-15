// Base de exemplo inteiramente FICTÍCIA: nenhuma destas linhas é enviada ao banco.
export const demoStores = [
  {id:"demo-centro",code:"CTR",name:"Loja Centro",active:true},
  {id:"demo-parque",code:"PRQ",name:"Loja Parque",active:true}
];
const ds = "2026-11-15";
export const demoTables = {
  items: [
    {id:"i1",code:"IT-001",name:"Muçarela",category:"Laticínios",base_unit:"kg",default_unit_cost:33.50,minimum_stock:12,composes_cmv:true,active:true},
    {id:"i2",code:"IT-002",name:"Molho de tomate",category:"Insumos",base_unit:"kg",default_unit_cost:9.80,minimum_stock:18,composes_cmv:true,active:true},
    {id:"i3",code:"IT-003",name:"Caixa para pizza",category:"Embalagens",base_unit:"un",default_unit_cost:1.65,minimum_stock:120,composes_cmv:true,active:true},
    {id:"i4",code:"IT-004",name:"Detergente",category:"Limpeza",base_unit:"un",default_unit_cost:4.90,minimum_stock:6,composes_cmv:false,active:true}
  ],
  suppliers: [
    {id:"f1",code:"FOR-001",name:"Distribuidora Exemplo",email:"contato@exemplo.invalid",active:true},
    {id:"f2",code:"FOR-002",name:"Hortifruti Modelo",email:"compras@exemplo.invalid",active:true}
  ],
  stock_counts: [
    {id:"c1",display_id:"CT-001",store_id:"demo-centro",count_date:ds,status:"finalized",notes:"Conferência mensal"},
    {id:"c2",display_id:"CT-002",store_id:"demo-centro",count_date:"2026-11-12",status:"draft",notes:"Parcial"},
    {id:"c3",display_id:"CT-003",store_id:"demo-parque",count_date:"2026-11-14",status:"finalized",notes:"Inventário"}
  ],
  invoices: [
    {id:"n1",store_id:"demo-centro",invoice_number:"000142",issue_date:"2026-11-13",entry_date:"2026-11-14",status:"received"},
    {id:"n2",store_id:"demo-parque",invoice_number:"000143",issue_date:"2026-11-12",entry_date:"2026-11-13",status:"received"}
  ],
  purchase_orders: [
    {id:"p1",number:"PC-001",store_id:"demo-centro",delivery_date:"2026-11-18",status:"realizing",observation:"Reposição semanal"},
    {id:"p2",number:"PC-002",store_id:"demo-centro",delivery_date:"2026-11-19",status:"draft",observation:"Itens de embalagem"},
    {id:"p3",number:"PC-003",store_id:"demo-parque",delivery_date:"2026-11-17",status:"realized",observation:"Compra finalizada"}
  ],
  transfers: [
    {id:"t1",number:"TR-001",from_store_id:"demo-centro",to_store_id:"demo-parque",status:"issued",observation:"Reposição"},
    {id:"t2",number:"TR-002",from_store_id:"demo-parque",to_store_id:"demo-centro",status:"draft",observation:"Solicitação"}
  ],
  cmv_closings: [
    {id:"cm1",store_id:"demo-centro",start_date:"2026-10-01",end_date:"2026-10-31",opening_stock:18000,eligible_purchases:42000,eligible_losses:450,closing_stock:15100,cmv_value:45350},
    {id:"cm2",store_id:"demo-parque",start_date:"2026-10-01",end_date:"2026-10-31",opening_stock:11000,eligible_purchases:27000,eligible_losses:300,closing_stock:9600,cmv_value:28700}
  ],
  purchase_lists: [
    {id:"list1",name:"Lista semanal",store_id:"demo-centro",list_type:"both",active:true},
    {id:"list2",name:"Lista de reposição",store_id:"demo-parque",list_type:"order",active:true}
  ],
  purchase_list_items: [
    {id:"pli1",list_id:"list1",store_id:"demo-centro",item_id:"i1"},
    {id:"pli2",list_id:"list1",store_id:"demo-centro",item_id:"i2"}
  ],
  stock_count_items: [
    {id:"sci1",count_id:"c1",store_id:"demo-centro",item_id:"i1",counted_quantity:8,unit_cost:33.50,line_total:268},
    {id:"sci2",count_id:"c2",store_id:"demo-centro",item_id:"i2",counted_quantity:10,unit_cost:9.80,line_total:98}
  ],
  invoice_items: [
    {id:"ii1",invoice_id:"n1",store_id:"demo-centro",item_id:"i1",quantity:10,unit_cost:33.50,line_total:335}
  ],
  purchase_order_items: [
    {id:"poi1",order_id:"p1",store_id:"demo-centro",item_id:"i1",requested_quantity:15,unit_cost:33.50,line_total:502.5}
  ],
  transfer_items: [
    {id:"ti1",transfer_id:"t1",from_store_id:"demo-centro",to_store_id:"demo-parque",item_id:"i2",quantity:5,unit_cost:9.8,line_total:49}
  ],
  losses: [
    {id:"loss1",store_id:"demo-centro",loss_date:"2026-11-14",reason:"Produto vencido",status:"recorded"}
  ],
  loss_items: [
    {id:"li1",loss_id:"loss1",store_id:"demo-centro",item_id:"i2",quantity:2,unit_cost:9.8,line_total:19.6}
  ],
  user_profiles: [
    {user_id:"demo-1",display_name:"Gestor Exemplo",active:true,created_at:ds},
    {user_id:"demo-2",display_name:"Operador Exemplo",active:true,created_at:ds}
  ]
};
export function getDemoRows(table, storeId, storeColumn) {
  const rows = demoTables[table] || [];
  if (table === "transfers") return rows.filter((row) => row.from_store_id === storeId || row.to_store_id === storeId);
  return storeColumn ? rows.filter((row) => row[storeColumn] === storeId) : rows.slice();
}
