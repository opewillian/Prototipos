// Loja · Listas: listas reutilizáveis de contagem e compra da unidade.
import {list,get,insert,insertMany,update,remove} from "../../core/db.js";
import {e,dateBR} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,searchBox,openDrawer,field,input,select,toggle,toast,confirmDialog,bindSearch,searchKey,emptyState,backLink,errorMessage,card} from "../../core/ui.js";
import {loadItems,byId} from "../shared/catalog.js";
import {importListDrawer,exportList} from "./listas-planilha.js";

export const LIST_TYPES=[["both","Contagem e compra"],["count","Contagem"],["order","Compra"]];
const typeLabel=t=>(LIST_TYPES.find(x=>x[0]===t)||[,t])[1];

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [lists,links]=await Promise.all([
  list("purchase_lists",{eq:{store_id:ctx.storeId},order:"name",asc:true}),
  list("purchase_list_items",{select:"list_id",eq:{store_id:ctx.storeId}})
 ]);
 if(!ctx.isCurrent())return;
 const n=id=>links.filter(l=>l.list_id===id).length;
 ctx.el.innerHTML=pageHead("Listas","Monte listas de itens para agilizar contagens e pedidos.",btn("Importar planilha",{variant:"secondary",icon:"upload",attrs:"data-import"})+btn("Nova lista",{icon:"plus",attrs:"data-new"}))+
  card("",lists.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Buscar lista")+'</div>'+dataTable([
   {label:"Lista",render:l=>'<span class="strong">'+e(l.name)+'</span>'},
   {label:"Uso",render:l=>'<span class="tag">'+e(typeLabel(l.list_type))+'</span>'},
   {label:"Itens",cls:"num",render:l=>String(n(l.id))},
   {label:"Criada em",render:l=>dateBR(l.created_at)},
   {label:"Situação",render:l=>l.active!==false?'<span class="pill pill-ok">Ativa</span>':'<span class="pill pill-muted">Inativa</span>'}
  ],lists,{rowHref:l=>ctx.base+"/listas/"+l.id,rowAttrs:l=>'data-search="'+e(searchKey(l.name))+'"'})
  :emptyState("list","Nenhuma lista criada","Crie uma lista com os itens que a loja conta ou compra com frequência.",btn("Criar lista",{icon:"plus",attrs:"data-new"})),{flush:true});
 bindSearch(ctx.el,"q");
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href.slice(1)));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>editList(ctx,null));
 ctx.el.querySelector("[data-import]").onclick=async()=>{
  try{importListDrawer(ctx,{items:await loadItems({store:ctx.store}),types:LIST_TYPES})}catch(error){toast(errorMessage(error),"danger")}
 };
}

function editList(ctx,row){
 const l=row||{list_type:"both",active:true};
 openDrawer({title:row?"Editar lista":"Nova lista",body:'<div class="form-grid">'+
  '<div class="span-2">'+field("Nome da lista",input("name",l.name,{required:true,placeholder:"Ex.: Contagem semanal – câmara fria"}))+'</div>'+
  '<div class="span-2">'+field("Usar em",select("list_type",LIST_TYPES,l.list_type,{placeholder:false}))+'</div>'+
  '<div class="span-2">'+toggle("active",l.active!==false,"Lista ativa")+'</div></div>',
  submitLabel:row?"Salvar":"Criar lista",onSubmit:async form=>{
   const f=form.elements;if(!f.name.value.trim())throw Error("Informe o nome da lista.");
   const data={name:f.name.value.trim(),list_type:f.list_type.value,active:f.active.checked};
   if(row){await update("purchase_lists",row.id,data);toast("Lista atualizada.");ctx.reload();}
   else{const s=await insert("purchase_lists",{...data,store_id:ctx.storeId,created_by:ctx.userId});toast("Lista criada. Agora inclua os itens.");ctx.go(ctx.base.slice(1)+"/listas/"+s.id);}
  }});
}

async function detail(ctx,id){
 const [lst,lines,items]=await Promise.all([
  get("purchase_lists",id),
  list("purchase_list_items",{eq:{list_id:id},order:"sort_order",asc:true,order2:"created_at",asc2:true}),
  loadItems({store:ctx.store})
 ]);
 if(!ctx.isCurrent())return;
 if(lst.store_id!==ctx.storeId)throw Error("Esta lista pertence a outra loja.");
 const map=byId(items);
 const inList=new Set(lines.map(l=>l.item_id));
 const available=items.filter(i=>i.active!==false&&!inList.has(i.id));
 const cats=[...new Set(available.map(i=>i.item_type||i.category||"Sem tipo"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const rows=lines.map(l=>({...l,item:map.get(l.item_id)||{name:"Item removido"}}));
 ctx.el.innerHTML=backLink(ctx.base+"/listas","Listas")+
  '<div class="doc-head"><div><div class="doc-title"><h1>'+e(lst.name)+'</h1><span class="tag">'+e(typeLabel(lst.list_type))+'</span>'+(lst.active===false?'<span class="pill pill-muted">Inativa</span>':'')+'</div><p class="muted" style="margin:6px 0 0">'+lines.length+' item(ns) na lista</p></div>'+
  '<div class="page-actions">'+btn("Importar planilha",{variant:"secondary",icon:"upload",attrs:"data-import"})+btn("Exportar planilha",{variant:"secondary",icon:"download",attrs:"data-export"})+btn("Imprimir",{variant:"secondary",icon:"printer",attrs:"data-print"})+btn("Editar",{variant:"secondary",icon:"edit",attrs:"data-edit"})+btn("Excluir",{variant:"ghost",icon:"trash",attrs:"data-delete"})+'</div></div>'+
  '<section class="card"><div class="add-row no-print">'+
   field("Adicionar item",'<input class="control" id="add-item" list="dl-items" placeholder="Digite o nome ou código do item" autocomplete="off"><datalist id="dl-items">'+available.map(i=>'<option value="'+e(i.name+(i.code?" · "+i.code:""))+'">').join("")+'</datalist>')+
   btn("Adicionar",{icon:"plus",attrs:"data-add"})+
   (cats.length?field("Adicionar um tipo inteiro",'<select class="control" id="add-cat"><option value="">Selecione</option>'+cats.map(c=>'<option>'+e(c)+'</option>').join("")+'</select>'):'')+
   (cats.length?btn("Adicionar todos",{variant:"secondary",attrs:"data-add-cat"}):'')+'</div>'+
  '<div class="print-only" style="padding:16px 18px"><h2>'+e(lst.name)+'</h2><p>Loja: '+e(ctx.store.name)+' · Data: ____/____/______ · Responsável: ______________________</p></div>'+
  (rows.length?'<div class="toolbar no-print" style="padding:14px 18px 0">'+searchBox("q","Buscar na lista")+'</div>'+dataTable([
   {label:"#",cls:"num",render:r=>String(rows.indexOf(r)+1)},
   {label:"Item",render:r=>'<span class="strong">'+e(r.item.name)+'</span><small class="sub">'+e(r.item.code||"")+'</small>'},
   {label:"Tipo",render:r=>e(r.item.item_type||r.item.category||"—")},
   {label:"Unidade",render:r=>e(r.item.base_unit||"")},
   {label:"Quantidade",cls:"print-only-col",render:()=>'<span class="print-blank"></span>'},
   {label:"",cls:"act no-print",render:r=>'<button class="icon-btn danger" data-remove="'+e(r.id)+'" aria-label="Remover '+e(r.item.name)+'">'+icon("x",16)+'</button>'}
  ],rows,{rowAttrs:r=>'data-search="'+e(searchKey(r.item.name,r.item.code,r.item.item_type||r.item.category))+'"'})
  :emptyState("list","Lista vazia","Adicione itens pelo campo acima."))+'</section>'+
  '<style>.print-only-col{display:none}@media print{.print-only-col{display:table-cell}.print-blank{display:inline-block;width:120px;border-bottom:1px solid #999;height:18px}}</style>';
 bindSearch(ctx.el,"q");
 const addIds=async ids=>{
  if(!ids.length)return toast("Nenhum item novo para adicionar.","info");
  try{
   const start=lines.reduce((m,l)=>Math.max(m,Number(l.sort_order||0)),0);
   await insertMany("purchase_list_items",ids.map((item_id,i)=>({list_id:id,store_id:ctx.storeId,item_id,sort_order:start+i+1})));
   toast(ids.length+" item(ns) adicionado(s).");ctx.reload();
  }catch(error){toast(errorMessage(error),"danger")}
 };
 const inp=ctx.el.querySelector("#add-item");
 const addOne=()=>{
  const v=inp.value.trim();if(!v)return;
  const it=available.find(i=>(i.name+(i.code?" · "+i.code:""))===v)||available.find(i=>i.code&&i.code.toLowerCase()===v.toLowerCase())||available.find(i=>i.name.toLowerCase()===v.toLowerCase());
  if(!it)return toast(inList.size&&items.some(i=>i.name===v)?"Este item já está na lista.":"Item não encontrado. Escolha uma opção da lista.","danger");
  addIds([it.id]);
 };
 ctx.el.querySelector("[data-add]")?.addEventListener("click",addOne);
 inp?.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();addOne()}});
 ctx.el.querySelector("[data-add-cat]")?.addEventListener("click",()=>{
  const c=ctx.el.querySelector("#add-cat").value;if(!c)return toast("Selecione um tipo.","info");
  addIds(available.filter(i=>(i.item_type||i.category||"Sem tipo")===c).map(i=>i.id));
 });
 ctx.el.querySelectorAll("[data-remove]").forEach(b=>b.onclick=async()=>{
  try{await remove("purchase_list_items",b.dataset.remove);toast("Item removido da lista.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 });
 ctx.el.querySelector("[data-print]").onclick=()=>window.print();
 ctx.el.querySelector("[data-import]").onclick=()=>importListDrawer(ctx,{items,list:lst,existing:inList,startOrder:lines.reduce((m,l)=>Math.max(m,Number(l.sort_order||0)),0)});
 ctx.el.querySelector("[data-export]").onclick=async()=>{
  if(!rows.length)return toast("A lista está vazia.","info");
  try{await exportList(lst,rows,ctx.store.name);toast("Planilha gerada.")}catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelector("[data-edit]").onclick=()=>editList(ctx,lst);
 ctx.el.querySelector("[data-delete]").onclick=async()=>{
  if(!await confirmDialog({title:"Excluir lista?",text:"A lista \""+lst.name+"\" e seus itens serão removidos. Contagens e pedidos já feitos não são afetados.",confirmLabel:"Excluir",danger:true}))return;
  try{
   for(const l of lines)await remove("purchase_list_items",l.id);
   await remove("purchase_lists",id);toast("Lista excluída.");ctx.go(ctx.base.slice(1)+"/listas");
  }catch(error){toast(errorMessage(error),"danger")}
 };
}
