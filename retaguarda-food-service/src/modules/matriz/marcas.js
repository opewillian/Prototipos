// Matriz · Marcas: cadastro central (tabela brands). Cada loja tem uma marca (stores.brand_id, definida fora da tela)
// e só usa os itens da marca dela + os da marca global (is_global, no máximo uma).
import {list,insert,update} from "../../core/db.js";
import {e} from "../../core/format.js";
import {pageHead,btn,dataTable,searchBox,openDrawer,field,input,toggle,toast,bindSearch,searchKey,emptyState,kpi} from "../../core/ui.js";
import {loadItems} from "../shared/catalog.js";

export async function loadBrands(){return list("brands",{order:"name",asc:true})}
const dupMsg=err=>{const m=String(err?.message||err);return /brands_one_global/i.test(m)?Error("Já existe uma marca global. Desmarque a outra antes."):/brands_name_key|duplicate key/i.test(m)?Error("Já existe uma marca com esse nome."):err};

export async function render(ctx){
 const [brands,items]=await Promise.all([loadBrands(),loadItems()]);
 if(!ctx.isCurrent())return;
 const nItems=id=>items.filter(i=>i.brand_id===id).length;
 const shops=ctx.app.stores.filter(s=>s.store_type==="operational");
 const storesOf=b=>b.is_global?"Todas as lojas":shops.filter(s=>s.brand_id===b.id).map(s=>s.name).join(", ")||"—";
 const active=brands.filter(b=>b.active!==false);
 ctx.el.innerHTML=pageHead("Marcas","Cada loja usa só os itens da marca dela e os da marca global.",btn("Nova marca",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Marcas ativas",active.length,"",{icon:"list"})+kpi("Itens com marca",items.filter(i=>i.brand_id).length,"de "+items.length,{icon:"box",tone:"info"})+
  kpi("Itens sem marca",items.filter(i=>!i.brand_id).length,"",{icon:"alert",tone:"warn"})+kpi("Inativas",brands.length-active.length,"",{icon:"archive",tone:"ok"})+'</div>'+
  '<section class="card">'+(brands.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar marca")+'</div>'+dataTable([
   {label:"Marca",render:b=>'<span class="strong">'+e(b.name)+'</span>'+(b.is_global?' <span class="pill pill-info">Global</span>':'')},
   {label:"Lojas",render:b=>e(storesOf(b))},
   {label:"Itens",cls:"num",render:b=>String(nItems(b.id))},
   {label:"Situação",render:b=>b.active!==false?'<span class="pill pill-ok">Ativa</span>':'<span class="pill pill-muted">Inativa</span>'},
   {label:"",cls:"act",render:b=>btn("Editar",{variant:"secondary",sm:true,icon:"edit",attrs:'data-edit="'+e(b.id)+'"'})}
  ],brands,{rowAttrs:b=>'data-search="'+e(searchKey(b.name))+'"'}).replace('class="table"','class="table stack"')
  :emptyState("list","Nenhuma marca cadastrada","Cadastre as marcas e depois escolha a marca de cada item.",btn("Cadastrar marca",{icon:"plus",attrs:"data-new"})))+'</section>';
 bindSearch(ctx.el,"q");
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>edit(ctx,null));
 ctx.el.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(ctx,brands.find(x=>x.id===b.dataset.edit)));
}

/** Também usado pela tela de Itens ("Nova marca" dentro do item). onSaved recebe a marca gravada. */
export function edit(ctx,brand,onSaved){
 const v=brand||{active:true};
 openDrawer({title:brand?"Editar marca":"Nova marca",body:'<div class="form-grid">'+
  '<div class="span-2">'+field("Nome da marca",input("name",v.name,{required:true,placeholder:"Ex.: Italac"}))+'</div>'+
  '<div class="span-2">'+toggle("is_global",v.is_global===true,"Marca global (itens aparecem em todas as lojas)")+'</div>'+
  '<div class="span-2">'+toggle("active",v.active!==false,"Marca ativa")+'</div>'+
  '<p class="muted span-2" style="margin:0">A marca de cada loja é definida pela equipe técnica no cadastro da loja.</p></div>',
  onSubmit:async form=>{const f=form.elements;const name=f.name.value.trim().replace(/\s+/g," ");
   if(!name)throw Error("Informe o nome da marca.");
   const row={name,is_global:f.is_global.checked,active:f.active.checked};
   let saved;
   try{saved=brand?await update("brands",brand.id,{...row,updated_at:new Date().toISOString()}):await insert("brands",row)}catch(err){throw dupMsg(err)}
   toast(brand?"Marca atualizada.":"Marca cadastrada.");
   if(onSaved)onSaved(saved);else ctx.reload();
  }});
}
