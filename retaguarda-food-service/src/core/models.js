// Schema dos formulários por módulo. Campos restritos são controlados pelo servidor (RLS).
const txt = (key,label,required=false) => ({key,label,type:"text",required});
const num = (key,label,required=false) => ({key,label,type:"number",required,min:0,step:"0.001"});
const date = (key,label,required=false) => ({key,label,type:"date",required});
const sel = (key,label,options,required=true) => ({key,label,type:"select",options,required});
const ref = (key,label,lookup,required=false) => ({key,label,type:"lookup",lookup,required});
const bool = (key,label) => ({key,label,type:"checkbox"});
export const statusLabels = {
 draft:"Rascunho", finalized:"Finalizada", cancelled:"Cancelada", pending:"Pendente",
 received:"Recebida", sent:"Enviado", realizing:"Realizando", realized:"Realizado",
 issued:"Emitida", recorded:"Registrada"
};
export const models = {
 matriz:{table:"items",id:"id",scope:false,fields:[
  txt("code","Código",true),txt("name","Nome do item",true),txt("category","Categoria"),
  txt("base_unit","Unidade de medida",true),num("default_unit_cost","Custo padrão",true),
  num("minimum_stock","Estoque mínimo"),bool("composes_cmv"),bool("active")]},
 fornecedores:{table:"suppliers",id:"id",scope:false,fields:[
  txt("code","Código"),txt("name","Razão social ou nome",true),
  txt("tax_id","Documento"),txt("email","E-mail"),txt("phone","Telefone"),bool("active")]},
 contagem:{table:"stock_counts",id:"id",scope:true,fields:[
  txt("display_id","Identificador",true),date("count_date","Data da contagem",true),
  txt("notes","Observações")],status:{field:"status",allowed:["draft","finalized","cancelled"]},
  locked:["finalized","cancelled"],line:{table:"stock_count_items",fk:"count_id",fields:[
   ref("item_id","Item","items",true),num("counted_quantity","Quantidade contada",true),
   num("unit_cost","Custo unitário",true)]}},
 notas:{table:"invoices",id:"id",scope:true,fields:[
  txt("invoice_number","Número da nota",true),ref("supplier_id","Fornecedor","suppliers"),
  date("issue_date","Emissão",true),date("entry_date","Entrada",true),
  txt("access_key","Chave de acesso"),txt("notes","Observações")],
  status:{field:"status",allowed:["pending","received","cancelled"]},locked:["received","cancelled"],
  line:{table:"invoice_items",fk:"invoice_id",fields:[
   ref("item_id","Item","items",true),num("quantity","Quantidade",true),
   num("unit_cost","Custo unitário",true)]}},
 compras:{table:"purchase_orders",id:"id",scope:true,fields:[
  txt("number","Número do pedido",true),date("delivery_date","Data de entrega",true),
  ref("list_id","Lista de compras","purchase_lists"),ref("count_id","Contagem","stock_counts"),
  txt("observation","Observação")],
  status:{field:"status",allowed:["draft","sent","realizing","realized","cancelled"]},
  locked:["realized","cancelled"],line:{table:"purchase_order_items",fk:"order_id",fields:[
   ref("item_id","Item","items",true),num("counted_quantity","Quantidade contada"),
   num("average_sold_10_days","Média vendida em 10 dias"),num("open_quantity_after_count","Pedidos em aberto"),
   num("suggested_quantity","Quantidade sugerida"),num("requested_quantity","Quantidade solicitada",true),
   num("unit_cost","Custo unitário",true)]}},
 transferencias:{table:"transfers",id:"id",scope:true,fields:[
  txt("number","Número da transferência",true),ref("to_store_id","Loja destino","stores",true),
  txt("observation","Observações")],
  status:{field:"status",allowed:["draft","issued","cancelled"]},locked:["issued","cancelled"],
  line:{table:"transfer_items",fk:"transfer_id",fields:[
   ref("item_id","Item","items",true),num("quantity","Quantidade",true),
   num("unit_cost","Custo unitário",true)]}},
 cmv:{table:"cmv_closings",id:"id",scope:true,fields:[
  ref("start_count_id","Contagem inicial","stock_counts",true),
  ref("end_count_id","Contagem final","stock_counts",true)],
  readOnly:true},
 usuarios:{table:"user_profiles",id:"user_id",scope:false,readOnly:true,fields:[]},
 listas:{table:"purchase_lists",id:"id",scope:true,fields:[
  txt("name","Nome da lista",true),sel("list_type","Utilização",[
    ["both","Contagem e compra"],["count","Contagem"],["order","Compra"]]),bool("active")],
  line:{table:"purchase_list_items",fk:"list_id",fields:[ref("item_id","Item","items",true)]}},
 perdas:{table:"losses",id:"id",scope:true,fields:[
  txt("reason","Motivo",true),date("loss_date","Data da perda",true)],
  status:{field:"status",allowed:["draft","recorded","cancelled"]},locked:["recorded","cancelled"],
  line:{table:"loss_items",fk:"loss_id",fields:[
   ref("item_id","Item","items",true),num("quantity","Quantidade",true),num("unit_cost","Custo unitário",true)]}},
 lojas:{table:"stores",id:"id",scope:false,fields:[
  txt("id","Identificador",true),txt("code","Código",true),txt("name","Nome",true),
  sel("store_type","Tipo",[["operational","Operacional"],["matrix","Matriz"]]),bool("active")]}
};
export const TODAY = () => new Date().toLocaleDateString("en-CA");
export function normalize(model, form, row={}, {storeId,userId,child=false,parentId}={}) {
  const schema = child ? model.line : model;
  const result={};
  for(const field of schema.fields) {
    const el=form.elements.namedItem(field.key);
    if(!el) continue;
    let value=field.type==="checkbox" ? el.checked : el.value.trim();
    if(field.type==="number") value=value===""?null:Number(value.replace(",","." ));
    if((field.type==="lookup" || field.type==="select") && value==="") value=null;
    if(field.required && (value===null || value==="" || Number.isNaN(value))) throw Error("Preencha: "+field.label);
    if(field.type==="number" && value!==null && (!Number.isFinite(value) || value<0)) throw Error(field.label+" deve ser um número válido e não negativo.");
    result[field.key]=value;
  }
  if(child) {
    if(!parentId) throw Error("Salve o registro principal antes de adicionar itens.");
    result[schema.fk]=parentId;
    if(storeId) {
      if(model.table==="transfers") {result.from_store_id=row.from_store_id||storeId;result.to_store_id=row.to_store_id;}
      else result.store_id=storeId;
    }
    const qty=Number(result.quantity??result.counted_quantity??result.requested_quantity??0);
    if(["invoice_items","transfer_items","loss_items"].includes(schema.table) && qty<=0) throw Error("A quantidade precisa ser maior que zero.");
    if(["stock_count_items","invoice_items","transfer_items","loss_items","purchase_order_items"].includes(schema.table)){
      result.line_total=Math.round(qty*Number(result.unit_cost||0)*100)/100;
    }
  } else if(model.scope){
    if(model.table==="transfers") result.from_store_id=storeId;
    else result.store_id=storeId;
    if(!storeId) throw Error("Selecione uma unidade.");
    if(storeId==="matriz") throw Error("Cadastros operacionais pertencem a uma loja. Selecione uma unidade operacional.");
  }
  if(!child && !row[model.id] && model.status) result[model.status.field]=model.status.allowed[0];
  if(!child && !row[model.id] && userId && ["contagem","notas","compras","transferencias","listas","perdas"].some(k=>models[k]===model)) result.created_by=userId;
  if(model.table==="invoices" && !child && result.entry_date && result.issue_date && result.entry_date < result.issue_date) throw Error("A entrada não pode anteceder a emissão.");
  if(model.table==="transfers" && !child && result.from_store_id===result.to_store_id) throw Error("A loja de destino deve ser diferente da origem.");
  return result;
}
export const labels = {code:"Código",name:"Nome",active:"Ativo",composes_cmv:"Compõe CMV"};
