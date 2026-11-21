// Matriz · De-para de itens do fornecedor (tabela supplier_item_map).
// Código do produto na nota do fornecedor -> nosso item interno + conversão (fator).
// fator = quantas unidades do nosso item (un, kg ou l) vêm em 1 unidade do fornecedor.
// Na entrada da nota: qtd interna = qtd da nota × fator; custo unitário interno = valor unitário da nota ÷ fator.
import {list,insert,update,remove} from "../../core/db.js";
import {e,money,num,parseNum,round2} from "../../core/format.js";
import {pageHead,btn,dataTable,openDrawer,field,input,toggle,toast,searchKey,emptyState,errorMessage,confirmDialog} from "../../core/ui.js";
import {loadItems,loadSuppliers,byId} from "../shared/catalog.js";
import {filterBar,bindFilters} from "../../core/filters.js";

export const SUPPLIER_UNITS=["CX","UN","PCT","FD","DZ","KG","G","L","ML","GL","BD","SC","FR","LT","BL","RL","PC"];
const itemLabel=i=>i.name+(i.code?" · "+i.code:"");
const supLabel=s=>s.name+(s.code?" · "+s.code:"");
const dupMsg=err=>/supplier_item_map_code_key|duplicate key/i.test(String(err?.message||err))?Error("Este fornecedor já tem um de-para com esse código. Edite o existente."):err;

export async function render(ctx){
 const [rows,suppliers,items]=await Promise.all([list("supplier_item_map",{order:"supplier_item_code",asc:true}),loadSuppliers(),loadItems()]);
 if(!ctx.isCurrent())return;
 const sMap=byId(suppliers),iMap=byId(items);
 const sName=id=>sMap.get(id)?.name||"Fornecedor removido";
 rows.sort((a,b)=>sName(a.supplier_id).localeCompare(sName(b.supplier_id),"pt-BR")||String(a.supplier_item_code).localeCompare(String(b.supplier_item_code),"pt-BR",{numeric:true}));
 const usedSup=[...new Set(rows.map(r=>r.supplier_id))].map(id=>[id,sName(id)]).sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"));
 ctx.el.innerHTML=pageHead("De-para de fornecedores","Liga o código do produto na nota do fornecedor ao nosso item, com a conversão de embalagem.",btn("Novo de-para",{icon:"plus",attrs:"data-new"}))+
  (rows.length?filterBar({search:"Código, descrição ou item",selects:[
   {key:"sup",all:"Todos os fornecedores",options:usedSup},
   {key:"st",all:"Ativos e inativos",options:[["on","Ativos"],["off","Inativos"]]}],noun:["de-para","de-paras"]}):'')+
  '<section class="card">'+(rows.length?dataTable([
   {label:"Fornecedor",render:r=>'<span class="strong">'+e(sName(r.supplier_id))+'</span><small class="sub">'+e(sMap.get(r.supplier_id)?.code||"")+'</small>'},
   {label:"Produto na nota",render:r=>'<span class="strong">'+e(r.supplier_item_code)+'</span>'+(r.supplier_description?'<small class="sub">'+e(r.supplier_description)+'</small>':'')},
   {label:"Nosso item",render:r=>{const it=iMap.get(r.item_id);return '<span class="strong">'+e(it?.name||"Item removido")+'</span><small class="sub">'+e(it?.code||"")+'</small>'}},
   {label:"Conversão",render:r=>e(convText(r,iMap.get(r.item_id)))},
   {label:"Situação",render:r=>r.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>'},
   {label:"",cls:"act",render:r=>btn("Editar",{variant:"secondary",sm:true,icon:"edit",attrs:'data-edit="'+e(r.id)+'"'})}
  ],rows,{rowAttrs:r=>{const it=iMap.get(r.item_id)||{};return 'data-search="'+e(searchKey(r.supplier_item_code,r.supplier_description||"",it.name||"",it.code||"",sName(r.supplier_id)))+'" data-sup="'+e(r.supplier_id)+'" data-st="'+(r.active!==false?"on":"off")+'"'}}).replace('class="table"','class="table stack"')
  :emptyState("swap","Nenhum de-para cadastrado","Cadastre, para cada fornecedor, o código do produto na nota, o nosso item e quantas unidades vêm na embalagem. A entrada de notas usa isso para converter sozinha.",btn("Cadastrar de-para",{icon:"plus",attrs:"data-new"})))+'</section>';
 if(rows.length){
  bindFilters(ctx.el,{noun:["de-para","de-paras"]});
  // #/matriz/depara/<fornecedor> já abre filtrado (link vindo da tela do fornecedor).
  const pre=ctx.params[0];const sel=ctx.el.querySelector('[data-fkey="sup"]');
  if(pre&&sel&&usedSup.some(([id])=>id===pre)){sel.value=pre;sel.dispatchEvent(new Event("input"))}
 }
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>editMap(ctx,null,{suppliers,items,presetSupplier:ctx.params[0]}));
 ctx.el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editMap(ctx,rows.find(r=>r.id===b.dataset.edit),{suppliers,items}));
}

/** "1 CX = 12 un" */
export function convText(r,item){
 return "1 "+(r.supplier_unit||"un. fornecedor")+" = "+num(r.factor,6)+" "+(item?.base_unit||"");
}

function editMap(ctx,row,{suppliers,items,presetSupplier}){
 const v=row||{active:true,supplier_id:presetSupplier||"",factor:1};
 const sups=suppliers.filter(s=>s.active!==false||s.id===v.supplier_id);
 const its=items.filter(i=>i.active!==false||i.id===v.item_id);
 const cur=its.find(i=>i.id===v.item_id);
 const d=openDrawer({title:row?"Editar de-para":"Novo de-para",submitLabel:row?"Salvar":"Cadastrar",body:'<div class="form-grid">'+
  '<div class="span-2">'+field("Fornecedor",'<select class="control" name="supplier_id" required><option value="">Selecione</option>'+sups.map(s=>'<option value="'+e(s.id)+'"'+(s.id===v.supplier_id?" selected":"")+'>'+e(supLabel(s))+'</option>').join("")+'</select>')+'</div>'+
  field("Código do produto na nota",input("supplier_item_code",v.supplier_item_code,{required:true,placeholder:"Ex.: 110"}),"Como vem no XML/DANFE do fornecedor.")+
  field("Unidade do fornecedor",'<input class="control" name="supplier_unit" list="dl-units" value="'+e(v.supplier_unit||"")+'" placeholder="Ex.: CX" autocomplete="off"><datalist id="dl-units">'+SUPPLIER_UNITS.map(u=>'<option value="'+u+'">').join("")+'</datalist>')+
  '<div class="span-2">'+field("Descrição na nota (opcional)",input("supplier_description",v.supplier_description,{placeholder:"Ex.: AGUA MIN S/GAS 500ML CX C/12"}))+'</div>'+
  '<div class="span-2">'+field("Nosso item",'<input class="control" name="item" list="dl-dp-items" value="'+e(cur?itemLabel(cur):"")+'" placeholder="Digite o nome ou código" autocomplete="off" required><datalist id="dl-dp-items">'+its.map(i=>'<option value="'+e(itemLabel(i))+'">').join("")+'</datalist>')+'</div>'+
  '<div class="span-2"><div class="field"><span class="field-label">Conversão</span><div class="dp-conv">1 <b data-u1>'+e(v.supplier_unit||"un. fornecedor")+'</b> = '+
   '<input class="control dp-factor" name="factor" inputmode="decimal" value="'+e(String(v.factor??"").replace(".",","))+'" required> <b data-u2>'+e(cur?.base_unit||"")+'</b> <span data-iname class="muted">'+e(cur?.name||"do nosso item")+'</span></div>'+
   '<small class="field-hint" data-example></small></div></div>'+
  '<div class="span-2">'+field("Observação (opcional)",input("notes",v.notes))+'</div>'+
  '<div class="span-2">'+toggle("active",v.active!==false,"De-para ativo")+'</div>'+
  (row?'<div class="span-2">'+btn("Excluir este de-para",{variant:"ghost",sm:true,icon:"trash",attrs:"data-del"})+'</div>':'')+
  '</div>',
  onSubmit:async form=>{const f=form.elements;
   if(!f.supplier_id.value)throw Error("Escolha o fornecedor.");
   const code=f.supplier_item_code.value.trim();if(!code)throw Error("Informe o código do produto na nota do fornecedor.");
   const it=findItem(its,f.item.value);if(!it)throw Error("Escolha o nosso item na lista.");
   const factor=parseNum(f.factor.value);if(!(factor>0))throw Error("Informe a conversão: quantas "+(it.base_unit||"unidades")+" vêm em 1 unidade do fornecedor.");
   const data={supplier_id:f.supplier_id.value,supplier_item_code:code,supplier_unit:f.supplier_unit.value.trim().toUpperCase()||null,
    supplier_description:f.supplier_description.value.trim()||null,item_id:it.id,factor,notes:f.notes.value.trim()||null,active:f.active.checked};
   try{
    if(row)await update("supplier_item_map",row.id,{...data,updated_at:new Date().toISOString()});
    else await insert("supplier_item_map",data);
   }catch(err){throw dupMsg(err)}
   toast(row?"De-para atualizado.":"De-para cadastrado.");ctx.reload();
  }});
 const f=d.el.elements;
 // Frase da conversão e exemplo ao vivo: "Nota com 2 CX a R$ 30,00 -> entram 24 un a R$ 2,50".
 const refresh=()=>{
  const it=findItem(its,f.item.value);const u=f.supplier_unit.value.trim().toUpperCase()||"un. fornecedor";const fac=parseNum(f.factor.value);
  d.el.querySelector("[data-u1]").textContent=u;
  d.el.querySelector("[data-u2]").textContent=it?.base_unit||"";
  d.el.querySelector("[data-iname]").textContent=it?.name||"do nosso item";
  d.el.querySelector("[data-example]").textContent=it&&fac>0?"Exemplo: nota com 2 "+u+" a "+money(30)+" cada → entram "+num(round2(2*fac),3)+" "+it.base_unit+" de "+it.name+" a "+money(30/fac)+" cada.":"Quantas unidades do nosso item (na unidade dele) vêm em 1 unidade do fornecedor.";
 };
 ["item","supplier_unit","factor"].forEach(n=>{f[n].addEventListener("input",refresh);f[n].addEventListener("change",refresh)});
 refresh();
 d.el.querySelector("[data-del]")?.addEventListener("click",async()=>{
  if(!await confirmDialog({title:"Excluir de-para?",text:"O código "+row.supplier_item_code+" deste fornecedor deixará de ser convertido automaticamente. Para só parar de usar, prefira desativar.",confirmLabel:"Excluir",danger:true}))return;
  try{await remove("supplier_item_map",row.id);d.close();toast("De-para excluído.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 });
}

function findItem(items,v){
 v=String(v||"").trim();if(!v)return null;
 return items.find(i=>itemLabel(i)===v)||items.find(i=>i.code&&i.code.toLowerCase()===v.toLowerCase())||items.find(i=>i.name.toLowerCase()===v.toLowerCase())||null;
}
