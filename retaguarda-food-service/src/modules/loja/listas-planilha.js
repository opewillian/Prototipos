// Loja · Listas: importar lista de planilha (.xlsx, .xls, .csv) e exportar lista para .xlsx.
// A biblioteca de planilha (SheetJS) só é baixada quando a pessoa usa uma dessas funções.
import {insert,insertMany} from "../../core/db.js";
import {e,normalizeText} from "../../core/format.js";
import {openDrawer,field,input,alertBox,toast} from "../../core/ui.js";

const XLSX_URL="https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
let xlsxLib=null;
async function xlsx(){
 if(!xlsxLib)try{xlsxLib=await import(XLSX_URL)}catch{throw Error("Não foi possível carregar o leitor de planilhas. Verifique a internet e tente de novo.")}
 return xlsxLib;
}

// Código como texto, sem espaços e sem zeros à esquerda (Excel costuma transformar "0414" em 414).
const normCode=v=>{let s=String(v??"").trim();if(/^\d+(\.0+)?$/.test(s))s=String(parseInt(s,10));return s.toLowerCase()};
const normName=v=>normalizeText(v).replace(/\s+/g," ").trim();
const CODE_HEAD=["codigo","cod","cod.","cod item","codigo do item","codigo item","item","sku","code"];
const NAME_HEAD=["nome","descricao","descricao item","descricao do item","produto","nome do item","item descricao","name"];

/** Lê a planilha e separa: itens encontrados (na ordem), não encontrados, repetidos e fora da loja. */
function matchRows(rows,items){
 // Cabeçalho: primeira linha com uma coluna de código ou de nome reconhecida.
 let head=-1,codeCol=-1,nameCol=-1;
 for(let r=0;r<Math.min(rows.length,10)&&head<0;r++){
  const cells=(rows[r]||[]).map(normName);
  const c=cells.findIndex(x=>CODE_HEAD.includes(x)),n=cells.findIndex(x=>NAME_HEAD.includes(x));
  if(c>=0||n>=0){head=r;codeCol=c;nameCol=n===c?-1:n}
 }
 if(head<0){codeCol=0;nameCol=-1} // sem cabeçalho: 1ª coluna = código
 // Itens liberados para a loja e itens que existem mas estão bloqueados (outra marca ou inativos).
 const ok={code:new Map(),name:new Map()},off={code:new Map(),name:new Map()};
 for(const i of items){const t=i.active!==false?ok:off;if(i.code)t.code.set(normCode(i.code),i);t.name.set(normName(i.name),i)}
 const look=(t,code,name)=>(String(code??"").trim()!==""&&t.code.get(normCode(code)))||(name&&t.name.get(normName(name)))||(codeCol===0&&head<0&&t.name.get(normName(code)))||null;
 const found=[],missing=[],blocked=[],seen=new Set(),seenOther=new Set();let dup=0;
 for(const row of rows.slice(head+1)){
  const code=codeCol>=0?row?.[codeCol]:"",name=nameCol>=0?row?.[nameCol]:"";
  if(String(code??"").trim()===""&&String(name??"").trim()==="")continue;
  const it=look(ok,code,name);
  if(it){if(seen.has(it.id)){dup++;continue}seen.add(it.id);found.push(it);continue}
  const other=look(off,code,name);
  const key=other?"i:"+other.id:"t:"+normCode(code)+"|"+normName(name);
  if(seenOther.has(key)){dup++;continue}seenOther.add(key);
  if(other)blocked.push([other.code,other.name].filter(Boolean).join(" · "));
  else missing.push([String(code??"").trim(),String(name??"").trim()].filter(Boolean).join(" · "));
 }
 return {found,missing,blocked,dup,hasHeader:head>=0};
}

/**
 * Importa uma planilha. Sem `list`: cria uma lista nova. Com `list`: acrescenta os itens que ainda não estão nela.
 * `items` = itens da loja (já filtrados pela marca: os de fora vêm inativos). `existing` = ids já na lista.
 */
export function importListDrawer(ctx,{items,list=null,existing=new Set(),startOrder=0}){
 let parsed=null,book=null;
 const body='<div class="form-grid">'+
  '<div class="span-2">'+field("Planilha",'<input class="control" type="file" name="file" accept=".xlsx,.xls,.csv" required>',
   "Uma linha por item, na ordem da lista. Coluna \"Código\" (ou \"Nome\"); sem cabeçalho, a 1ª coluna é lida como código.")+'</div>'+
  '<div class="span-2" data-sheet-wrap hidden>'+field("Aba",'<select class="control" name="sheet"></select>')+'</div>'+
  (list?'':'<div class="span-2">'+field("Nome da lista",input("name","",{required:true,placeholder:"Ex.: Contagem semanal"}))+'</div>')+
  '<div class="span-2" data-preview></div></div>';
 const drawer=openDrawer({title:list?"Importar itens para a lista":"Importar lista de planilha",body,submitLabel:list?"Adicionar itens":"Criar lista",
  onSubmit:async form=>{
   if(!parsed)throw Error("Escolha a planilha.");
   const ids=parsed.found.map(i=>i.id).filter(id=>!existing.has(id));
   if(!ids.length)throw Error(list?"Nenhum item novo para adicionar.":"Nenhum item da planilha foi encontrado no cadastro desta loja.");
   let listId=list?.id;
   if(!list){
    const f=form.elements;if(!f.name.value.trim())throw Error("Informe o nome da lista.");
    listId=(await insert("purchase_lists",{name:f.name.value.trim(),list_type:"count",active:true,store_id:ctx.storeId,created_by:ctx.userId})).id;
   }
   await insertMany("purchase_list_items",ids.map((item_id,i)=>({list_id:listId,store_id:ctx.storeId,item_id,sort_order:startOrder+i+1})));
   toast(ids.length+" item(ns) importado(s)."+(parsed.missing.length+parsed.blocked.length?" "+(parsed.missing.length+parsed.blocked.length)+" linha(s) não entraram.":""));
   if(list)ctx.reload();else ctx.go(ctx.base.slice(1)+"/listas/"+listId);
  }});
 const form=drawer.el,prev=form.querySelector("[data-preview]"),sheetSel=form.elements.sheet;
 const show=()=>{
  const X=xlsxLib,ws=book.Sheets[sheetSel.value||book.SheetNames[0]];
  parsed=matchRows(X.utils.sheet_to_json(ws,{header:1,raw:false,defval:""}),items);
  const already=parsed.found.filter(i=>existing.has(i.id)).length;
  const lines=[alertBox(parsed.found.length+" item(ns) encontrado(s)"+(already?" ("+already+" já estão na lista)":"")+".",parsed.found.length?"ok":"warn")];
  if(parsed.dup)lines.push(alertBox(parsed.dup+" linha(s) repetida(s) ignorada(s).","info"));
  if(parsed.blocked.length)lines.push(alertBox(parsed.blocked.length+" item(ns) existem, mas não estão liberados para esta loja (marca ou inativo): "+parsed.blocked.slice(0,15).join("; ")+(parsed.blocked.length>15?"…":""),"warn"));
  if(parsed.missing.length)lines.push(alertBox(parsed.missing.length+" linha(s) sem item correspondente no cadastro: "+parsed.missing.slice(0,15).join("; ")+(parsed.missing.length>15?"…":""),"warn"));
  if(!parsed.hasHeader)lines.push('<small class="muted">Sem cabeçalho reconhecido: a 1ª coluna foi lida como código.</small>');
  prev.innerHTML='<div style="display:grid;gap:8px">'+lines.join("")+'</div>';
 };
 form.elements.file.addEventListener("change",async ev=>{
  const file=ev.target.files?.[0];parsed=null;prev.innerHTML="";if(!file)return;
  try{
   prev.innerHTML='<small class="muted">Lendo planilha…</small>';
   const X=await xlsx();book=X.read(await file.arrayBuffer(),{type:"array"});
   sheetSel.innerHTML=book.SheetNames.map(n=>'<option>'+e(n)+'</option>').join("");
   form.querySelector("[data-sheet-wrap]").hidden=book.SheetNames.length<2;
   if(!list&&!form.elements.name.value.trim())form.elements.name.value=file.name.replace(/\.(xlsx|xls|csv)$/i,"");
   show();
  }catch(error){prev.innerHTML=alertBox(error.message||"Não foi possível ler a planilha.")}
 });
 sheetSel.addEventListener("change",()=>book&&show());
}

/** Exporta a lista para .xlsx (mesmo formato que a importação aceita). */
export async function exportList(lst,rows,storeName){
 const X=await xlsx();
 const data=[["Ordem","Código","Nome","Tipo","Unidade"],...rows.map((r,i)=>[i+1,r.item.code||"",r.item.name||"",r.item.item_type||r.item.category||"",r.item.base_unit||""])];
 const ws=X.utils.aoa_to_sheet(data);ws["!cols"]=[{wch:7},{wch:12},{wch:48},{wch:18},{wch:9}];
 const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,"Lista");
 const safe=s=>String(s||"").replace(/[\\/:*?"<>|]+/g," ").trim();
 X.writeFile(wb,safe(lst.name)+" - "+safe(storeName)+".xlsx");
}
