// Itens da NF-e (invoice_nfe_items) + De-para (supplier_item_map) na nota fiscal.
// - Cada linha da NF-e vem do XML/Everest do jeito que o fornecedor mandou.
// - Se o fornecedor já tem de-para para aquele código, a linha vira automaticamente um item da nota (invoice_items):
//     quantidade = quantidade da nota × fator; valor = total da linha; custo unitário = total ÷ quantidade convertida.
// - Sem de-para, a linha fica marcada "Falta de-para"; clicando nela abre o cadastro do de-para
//   (dados do fornecedor travados; só escolhe nosso item, unidade e conversão).
import {list,insert,update,remove} from "../../core/db.js";
import {e,money,num,parseNum,round2} from "../../core/format.js";
import {openDrawer,field,toast,errorMessage,card,alertBox} from "../../core/ui.js";
import {icon} from "../../core/icons.js";

const UNITS=["un","kg","l"];
const round4=v=>Math.round(Number(v||0)*10000)/10000;
export const codeKey=c=>String(c||"").trim().toLowerCase();
const itemLabel=i=>i.name+(i.code?" · "+i.code:"");

/** De-paras ativos do fornecedor. */
export async function loadMaps(supplierId){
 if(!supplierId)return [];
 return list("supplier_item_map",{eq:{supplier_id:supplierId}});
}
const activeMap=(maps,code)=>maps.find(m=>m.active!==false&&codeKey(m.supplier_item_code)===codeKey(code))||null;

/** Gera/atualiza/remove os itens da nota (invoice_items) a partir das linhas da NF-e e dos de-paras. Só para nota pendente. */
export async function syncNfe({inv,nfe,lines,maps,storeId}){
 const byId=new Map(lines.map(l=>[l.id,l]));
 let changed=false;
 for(const l of nfe){
  const m=activeMap(maps,l.supplier_item_code);
  let cur=l.invoice_item_id?byId.get(l.invoice_item_id):null;
  if(l.invoice_item_id&&!cur){await update("invoice_nfe_items",l.id,{invoice_item_id:null});l.invoice_item_id=null;changed=true}
  if(!m){
   if(cur){await update("invoice_nfe_items",l.id,{invoice_item_id:null});await remove("invoice_items",cur.id);byId.delete(cur.id);l.invoice_item_id=null;changed=true}
   continue;
  }
  const qty=round4(Number(l.quantity)*Number(m.factor));if(!(qty>0))continue;
  const total=round2(Number(l.total||0));const row={item_id:m.item_id,quantity:qty,unit_cost:round4(total/qty),line_total:total};
  if(cur){
   if(cur.item_id!==row.item_id||Math.abs(Number(cur.quantity)-qty)>1e-6||Math.abs(Number(cur.line_total)-total)>0.004){Object.assign(cur,await update("invoice_items",cur.id,row));changed=true}
  }else{
   const n=await insert("invoice_items",{...row,invoice_id:inv.id,store_id:storeId});byId.set(n.id,n);
   await update("invoice_nfe_items",l.id,{invoice_item_id:n.id});l.invoice_item_id=n.id;changed=true;
  }
 }
 return {lines:[...byId.values()],changed};
}

/** Card "Itens da nota" quando a nota veio de NF-e: lista do fornecedor com o símbolo do de-para. */
export function nfeItemsCard({inv,nfe,lines,items,maps}){
 const lineBy=new Map(lines.map(l=>[l.id,l]));
 const done=nfe.filter(l=>l.invoice_item_id&&lineBy.get(l.invoice_item_id)).length;
 const sum=round2(nfe.reduce((s,l)=>s+Number(l.total||0),0));
 const diff=inv.total_amount!=null?round2(Number(inv.total_amount)-sum):0;
 const received=inv.status!=="pending";
 return card("Itens da nota ("+nfe.length+")",
  '<div class="nfe-sum"><span class="nfe-badge '+(done===nfe.length?"ok":"warn")+'">'+icon(done===nfe.length?"check":"alert",14)+' '+done+' de '+nfe.length+' com de-para</span>'+
  '<span class="muted">Itens vindos da NF-e do fornecedor. '+(received?'Clique em um item para ver o de-para.':'Clique em um item para fazer ou conferir o de-para.')+'</span></div>'+
  (Math.abs(diff)>=0.01?'<div style="padding:0 18px 10px">'+alertBox("A soma dos itens ("+money(sum)+") difere do valor da nota ("+money(inv.total_amount)+") em "+money(Math.abs(diff))+(diff<0?" — provável desconto no total da nota.":"."),"warn")+'</div>':'')+
  '<div class="table-wrap"><table class="table nfe-table"><thead><tr><th class="nfe-st"></th><th class="num">#</th><th>Produto do fornecedor</th><th class="num">Qtd na nota</th><th class="num">Total</th><th>Nosso item</th></tr></thead><tbody>'+
  nfe.map(l=>{const il=l.invoice_item_id?lineBy.get(l.invoice_item_id):null;const it=il?items.get(il.item_id):null;const m=activeMap(maps,l.supplier_item_code);
   const ok=!!il;
   return '<tr class="row-click" data-nfe="'+e(l.id)+'" tabindex="0" title="'+(ok?"De-para feito — clique para conferir":"Falta de-para — clique para cadastrar")+'">'+
    '<td class="nfe-st"><span class="nfe-dot '+(ok?"ok":"warn")+'" aria-label="'+(ok?"De-para feito":"Falta de-para")+'">'+icon(ok?"check":"alert",14)+'</span></td>'+
    '<td class="num">'+l.seq+'</td>'+
    '<td><span class="strong">'+e(l.description||"")+'</span><small class="sub">Cód. '+e(l.supplier_item_code||"—")+' · '+e(l.supplier_unit||"")+(l.package_desc?' ('+e(l.package_desc)+')':'')+'</small></td>'+
    '<td class="num">'+num(l.quantity,4)+' '+e(l.supplier_unit||"")+'</td><td class="num">'+money(l.total)+'</td>'+
    '<td>'+(ok?'<span class="strong">'+e(it?.name||"Item")+'</span><small class="sub">'+num(il.quantity,4)+' '+e(m?.item_unit||it?.base_unit||"")+' · '+money(il.unit_cost)+' cada</small>'
     :'<span class="nfe-todo">Fazer de-para</span>')+'</td></tr>'}).join("")+
  '</tbody></table></div>',{flush:true});
}

/** Tela do de-para a partir de uma linha da nota. onSaved() recarrega a nota. */
export function openNfeDepara({inv,line,supplier,maps,items,onSaved}){
 const m=maps.find(x=>codeKey(x.supplier_item_code)===codeKey(line.supplier_item_code))||null;
 const its=items.filter(i=>i.active!==false||i.id===m?.item_id);
 // Valores iniciais: de-para existente; senão, a sugestão do vínculo do Everest (item e quantidade em estoque).
 let it=m?its.find(i=>i.id===m.item_id):null,factor=m?Number(m.factor):null,unit=m?.item_unit||null,fromEverest=false;
 if(!m&&line.item_id){it=its.find(i=>i.id===line.item_id)||null;
  if(it&&Number(line.everest_stock_qty)>0&&Number(line.quantity)>0){factor=round4(Number(line.everest_stock_qty)/Number(line.quantity));fromEverest=true}}
 unit=unit||it?.base_unit||"un";
 const su=line.supplier_unit||"un. fornecedor";
 const ro=(label,value)=>'<div class="ro-field"><span class="field-label">'+e(label)+'</span><div class="ro-value">'+(value||"—")+'</div></div>';
 const d=openDrawer({title:m?"De-para do item":"Fazer de-para",submitLabel:m?"Salvar de-para":"Cadastrar de-para",wide:true,body:
  '<div class="nfe-ro"><div class="nfe-ro-title">'+icon("receipt",15)+' Dados do fornecedor (vêm da nota, não editáveis)</div><div class="form-grid">'+
   ro("Fornecedor",e(supplier?.name||"—")+(supplier?.code?' <small class="muted">· cód. '+e(supplier.code)+'</small>':''))+
   ro("Código do produto no fornecedor",'<b>'+e(line.supplier_item_code||"—")+'</b>')+
   '<div class="span-2">'+ro("Descrição na nota",e(line.description||""))+'</div>'+
   ro("Unidade do fornecedor",e(su)+(line.package_desc?' <small class="muted">('+e(line.package_desc)+')</small>':''))+
   ro("Nesta nota",num(line.quantity,4)+' '+e(su)+' · '+money(line.total))+
  '</div></div>'+
  (inv.status!=="pending"?alertBox("Esta nota já deu entrada no estoque: o de-para vale para as próximas notas deste fornecedor.","info"):'')+
  '<div class="form-grid" style="margin-top:14px">'+
   '<div class="span-2">'+field("Nosso item",'<input class="control" name="item_label" list="dl-nfe-items" value="'+e(it?itemLabel(it):"")+'" placeholder="Digite o nome ou código do nosso item" autocomplete="off" required><datalist id="dl-nfe-items">'+its.filter(i=>i.active!==false).map(i=>'<option value="'+e(itemLabel(i))+'">').join("")+'</datalist>',fromEverest?"Sugestão vinda do vínculo que o Everest já tinha. Confira antes de salvar.":"")+'</div>'+
   field("Nossa unidade de medida",'<select class="control" name="unit">'+UNITS.map(u=>'<option value="'+u+'"'+(u===unit?" selected":"")+'>'+u+'</option>').join("")+'</select>')+
   '<div class="field"><span class="field-label">Conversão</span><div class="dp-conv">1 <b>'+e(su)+'</b> = <input class="control dp-factor" name="factor" inputmode="decimal" value="'+e(factor!=null?String(factor).replace(".",","):"")+'" required> <b data-u>'+e(unit)+'</b></div></div>'+
   '<div class="span-2"><small class="field-hint" data-example></small></div>'+
  '</div>',
  onSubmit:async form=>{const f=form.elements;
   const v=f.item_label.value.trim();const item=its.find(i=>itemLabel(i)===v)||its.find(i=>i.code&&i.code.toLowerCase()===v.toLowerCase())||its.find(i=>i.name.toLowerCase()===v.toLowerCase());
   if(!item)throw Error("Escolha o nosso item na lista.");
   const u=f.unit.value;if(item.base_unit&&u!==item.base_unit)throw Error("A unidade de "+item.name+" no cadastro é \""+item.base_unit+"\". Use essa unidade (o estoque é controlado nela) ou ajuste o cadastro do item.");
   const fac=parseNum(f.factor.value);if(!(fac>0))throw Error("Informe a conversão: quantos "+u+" vêm em 1 "+su+".");
   const data={supplier_item_code:String(line.supplier_item_code||"").trim(),supplier_description:line.description||null,supplier_unit:line.supplier_unit||null,item_id:item.id,item_unit:u,factor:fac,active:true};
   try{
    if(m)await update("supplier_item_map",m.id,{...data,updated_at:new Date().toISOString()});
    else await insert("supplier_item_map",{...data,supplier_id:inv.supplier_id});
   }catch(err){throw /duplicate key|supplier_item_map_code_key/i.test(String(err?.message))?Error("Já existe um de-para com este código para este fornecedor. Recarregue a nota."):err}
   toast(m?"De-para atualizado.":"De-para cadastrado. As próximas notas deste fornecedor já virão convertidas.");
   await onSaved?.();
  }});
 const f=d.el.elements;
 const refresh=()=>{
  const v=f.item_label.value.trim();const item=its.find(i=>itemLabel(i)===v);const fac=parseNum(f.factor.value);const u=f.unit.value;
  if(item&&item.base_unit&&f.unit.dataset.auto!=="0"){f.unit.value=item.base_unit}
  d.el.querySelector("[data-u]").textContent=f.unit.value;
  d.el.querySelector("[data-example]").textContent=item&&fac>0
   ?"Nesta nota: "+num(line.quantity,4)+" "+su+" → entram "+num(round4(Number(line.quantity)*fac),4)+" "+f.unit.value+" de "+item.name+", custo "+money(Number(line.total||0)/(Number(line.quantity)*fac))+" cada."
   :"Quantos "+u+" do nosso item vêm em 1 "+su+" do fornecedor.";
 };
 f.unit.addEventListener("change",()=>{f.unit.dataset.auto="0";refresh()});
 ["item_label","factor"].forEach(n=>{f[n].addEventListener("input",refresh);f[n].addEventListener("change",refresh)});
 refresh();
 if(!m&&!f.item_label.value)f.item_label.focus();
}
