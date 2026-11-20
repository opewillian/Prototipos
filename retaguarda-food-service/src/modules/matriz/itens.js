// Matriz · Itens: catálogo central (compartilhado por todas as lojas).
import {insert,update} from "../../core/db.js";
import {e,money,num,inputNum,parseNum} from "../../core/format.js";
import {pageHead,btn,dataTable,searchBox,openDrawer,field,input,toggle,select,toast,bindSearch,searchKey,emptyState,kpi} from "../../core/ui.js";
import {loadItems} from "../shared/catalog.js";
import {loadBrands,edit as editBrand} from "./marcas.js";

const UNITS=[["un","un (unidade)"],["kg","kg"],["g","g"],["l","l (litro)"],["ml","ml"],["cx","cx (caixa)"],["pct","pct (pacote)"],["fd","fd (fardo)"],["dz","dz (dúzia)"],["pc","pc (peça)"],["par","par"]];
// Mesmos valores aceitos pela coluna items.item_type (docs/sql/04-itens-marca-tipo.sql).
export const ITEM_TYPES=["Matéria-prima","Revenda","Embalagem","Produto acabado","Uso e consumo","Outras","Ativo imobilizado"];

export async function render(ctx){
 const [items,brands]=await Promise.all([loadItems(),loadBrands()]);
 const brandName=new Map(brands.map(b=>[b.id,b.name]));
 items.forEach(i=>{i._brand=brandName.get(i.brand_id)||""});
 if(!ctx.isCurrent())return;
 const cats=ITEM_TYPES.filter(t=>items.some(i=>i.item_type===t));
 const active=items.filter(i=>i.active!==false);
 ctx.el.innerHTML=pageHead("Itens","Cadastro central de itens, usado por todas as lojas.",btn("Novo item",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Itens ativos",active.length,"",{icon:"box"})+kpi("Compõem CMV",active.filter(i=>i.composes_cmv).length,"",{icon:"chart",tone:"info"})+
  kpi("Tipos",cats.length,"",{icon:"layers",tone:"ok"})+kpi("Inativos",items.length-active.length,"",{icon:"archive",tone:"warn"})+'</div>'+
  '<section class="card"><div class="card-body" style="padding-bottom:0"><div class="toolbar">'+searchBox("q","Buscar por nome, código ou marca")+
  '<select class="control" id="f-cat"><option value="">Todos os tipos</option>'+cats.map(c=>'<option>'+e(c)+'</option>').join("")+'</select>'+
  '<select class="control" id="f-brand"><option value="">Todas as marcas</option><option value="-">Sem marca</option>'+brands.map(b=>'<option value="'+e(b.id)+'">'+e(b.name)+'</option>').join("")+'</select>'+
  '<select class="control" id="f-status"><option value="active">Ativos</option><option value="">Todos</option><option value="inactive">Inativos</option></select>'+
  '<span class="grow"></span><span class="muted"><b data-search-count>0</b> itens</span></div></div>'+
  (items.length?dataTable([
   {label:"Item",render:i=>'<span class="strong">'+e(i.name)+'</span><small class="sub">'+e(i.code||"")+'</small>'},
   {label:"Tipo",render:i=>i.item_type?'<span class="tag">'+e(i.item_type)+'</span>':'<span class="muted">—</span>'},
   {label:"Marca",render:i=>i._brand?e(i._brand):'<span class="muted">—</span>'},
   {label:"Unidade",render:i=>e(i.base_unit||"")},
   {label:"Custo padrão",cls:"num",render:i=>money(i.default_unit_cost)},
   {label:"Estoque mín.",cls:"num",render:i=>num(i.minimum_stock)},
   {label:"CMV",render:i=>i.composes_cmv?'<span class="pill pill-info">Compõe</span>':'<span class="pill pill-muted">Não</span>'},
   {label:"Situação",render:i=>i.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>'},
   {label:"",cls:"act",render:i=>btn("Editar",{variant:"secondary",sm:true,icon:"edit",attrs:'data-edit="'+e(i.id)+'"'})}
  ],items,{rowAttrs:i=>'data-search="'+e(searchKey(i.name,i.code,i._brand,i.item_type))+'" data-cat="'+e(i.item_type||"")+'" data-brand="'+e(i.brand_id||"-")+'" data-active="'+(i.active!==false)+'"'}).replace('class="table"','class="table stack"')
  :emptyState("box","Nenhum item cadastrado","Cadastre os insumos e embalagens que as lojas vão contar e comprar.",btn("Cadastrar primeiro item",{icon:"plus",attrs:"data-new"})))+'</section>';
 const filter=()=>{
  const q=searchKey(ctx.el.querySelector("#q")?.value||"").trim(),cat=ctx.el.querySelector("#f-cat")?.value,br=ctx.el.querySelector("#f-brand")?.value,st=ctx.el.querySelector("#f-status")?.value;
  let shown=0;
  ctx.el.querySelectorAll("tr[data-search]").forEach(r=>{
   const ok=(!q||r.dataset.search.includes(q))&&(!cat||r.dataset.cat===cat)&&(!br||r.dataset.brand===br)&&(!st||(st==="active")===(r.dataset.active==="true"));
   r.hidden=!ok;if(ok)shown++;
  });
  const c=ctx.el.querySelector("[data-search-count]");if(c)c.textContent=shown;
 };
 ["#q","#f-cat","#f-brand","#f-status"].forEach(s=>ctx.el.querySelector(s)?.addEventListener("input",filter));filter();
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>edit(ctx,null,brands));
 ctx.el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(ctx,items.find(i=>i.id===b.dataset.edit),brands));
}

function edit(ctx,item,brands){
 const i=item||{active:true,composes_cmv:true,base_unit:"un"};
 const body='<div class="form-grid">'+
  field("Código",input("code",i.code,{required:true,placeholder:"Ex.: INS-001"}))+
  field("Unidade de medida",select("base_unit",UNITS.some(u=>u[0]===i.base_unit)?UNITS:UNITS.concat([[i.base_unit,i.base_unit]]),i.base_unit,{required:true,placeholder:false}))+
  '<div class="span-2">'+field("Nome do item",input("name",i.name,{required:true,placeholder:"Ex.: Arroz agulhinha tipo 1"}))+'</div>'+
  field("Tipo",select("item_type",ITEM_TYPES.map(t=>[t,t]),i.item_type,{required:true}))+
  field("Marca",'<div style="display:flex;gap:8px">'+brandSelect(brands,i.brand_id)+btn("Nova",{variant:"secondary",sm:true,icon:"plus",attrs:'data-new-brand'})+'</div>')+
  field("Custo padrão (R$)",input("default_unit_cost",inputNum(i.default_unit_cost,4),{inputmode:"decimal",placeholder:"0,00"}),"Usado quando a loja ainda não tem nota recebida do item.")+
  field("Estoque mínimo",input("minimum_stock",inputNum(i.minimum_stock),{inputmode:"decimal",placeholder:"0"}))+'<div></div>'+
  '<div class="span-2">'+toggle("composes_cmv",i.composes_cmv!==false,"Compõe o CMV")+'</div>'+
  '<div class="span-2">'+toggle("active",i.active!==false,"Item ativo")+'</div></div>';
 const drawer=openDrawer({title:item?"Editar item":"Novo item",body,onSubmit:async form=>{
  const f=form.elements;
  const cost=parseNum(f.default_unit_cost.value),min=parseNum(f.minimum_stock.value);
  if(!f.code.value.trim()||!f.name.value.trim())throw Error("Preencha código e nome.");
  if(Number.isNaN(cost)||Number.isNaN(min))throw Error("Custo e estoque mínimo devem ser números não negativos.");
  if(!f.item_type.value)throw Error("Escolha o tipo do item.");
  const row={code:f.code.value.trim(),name:f.name.value.trim(),item_type:f.item_type.value,brand_id:f.brand_id.value||null,base_unit:f.base_unit.value,
   default_unit_cost:cost??0,minimum_stock:min,composes_cmv:f.composes_cmv.checked,active:f.active.checked};
  if(item)await update("items",item.id,row);else await insert("items",row);
  toast(item?"Item atualizado.":"Item cadastrado.");ctx.reload();
 }});
 // "Nova" marca sem sair do item: grava a marca e já deixa selecionada.
 drawer.el.querySelector("[data-new-brand]").onclick=()=>editBrand(ctx,null,saved=>{
  const sel=drawer.el.elements.brand_id;if(!saved||!sel)return;
  brands.push(saved);sel.insertAdjacentHTML("beforeend",'<option value="'+e(saved.id)+'">'+e(saved.name)+'</option>');sel.value=saved.id;
 });
}

// Marcas ativas + a marca atual do item (mesmo se inativa), para não perder o vínculo ao editar.
function brandSelect(brands,current){
 const opts=brands.filter(b=>b.active!==false||b.id===current);
 return '<select class="control" name="brand_id" style="flex:1;min-width:0"><option value="">Sem marca</option>'+opts.map(b=>'<option value="'+e(b.id)+'"'+(b.id===current?" selected":"")+'>'+e(b.name)+(b.active===false?" (inativa)":"")+'</option>').join("")+'</select>';
}
