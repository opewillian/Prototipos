// Matriz · Fornecedores e vínculos item × loja × fornecedor (com preferencial por loja).
import {list,get,insert,insertMany,update,remove} from "../../core/db.js";
import {e} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {pageHead,btn,dataTable,searchBox,openDrawer,field,input,toggle,select,toast,bindSearch,searchKey,emptyState,backLink,card,errorMessage,confirmDialog,kpi} from "../../core/ui.js";
import {loadItems,loadSuppliers,byId} from "../shared/catalog.js";

function fmtDoc(v){const d=String(v||"").replace(/\D/g,"");if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,"$1.$2.$3-$4");return v||""}

export async function render(ctx){
 if(ctx.params[0])return detail(ctx,ctx.params[0]);
 const [suppliers,links]=await Promise.all([loadSuppliers(),list("store_item_suppliers",{select:"supplier_id,item_id,active",eq:{active:true}})]);
 if(!ctx.isCurrent())return;
 const nItems=id=>new Set(links.filter(l=>l.supplier_id===id).map(l=>l.item_id)).size;
 ctx.el.innerHTML=pageHead("Fornecedores","Cadastro central e itens fornecidos para cada loja.",btn("Novo fornecedor",{icon:"plus",attrs:"data-new"}))+
  '<div class="kpis">'+kpi("Fornecedores ativos",suppliers.filter(s=>s.active!==false).length,"",{icon:"truck"})+kpi("Vínculos ativos",links.length,"item × loja",{icon:"layers",tone:"info"})+
  kpi("Sem itens vinculados",suppliers.filter(s=>s.active!==false&&!nItems(s.id)).length,"",{icon:"alert",tone:"warn"})+kpi("Inativos",suppliers.filter(s=>s.active===false).length,"",{icon:"x",tone:"ok"})+'</div>'+
  '<section class="card">'+(suppliers.length?'<div class="toolbar" style="padding:14px 18px 0">'+searchBox("q","Nome, código ou CNPJ")+'</div>'+dataTable([
   {label:"Fornecedor",render:s=>'<span class="strong">'+e(s.name)+'</span><small class="sub">'+e(s.code||"")+'</small>'},
   {label:"CNPJ/CPF",render:s=>e(fmtDoc(s.tax_id)||"—")},{label:"Contato",render:s=>e(s.phone||"")+(s.email?'<small class="sub">'+e(s.email)+'</small>':'')},
   {label:"Itens vinculados",cls:"num",render:s=>String(nItems(s.id))},
   {label:"Situação",render:s=>s.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>'}
  ],suppliers,{rowHref:s=>"#/matriz/fornecedores/"+s.id,rowAttrs:s=>'data-search="'+e(searchKey(s.name,s.code,s.tax_id,String(s.tax_id||"").replace(/\D/g,"")))+'"'}).replace('class="table"','class="table stack"')
  :emptyState("truck","Nenhum fornecedor cadastrado","Cadastre os fornecedores e depois vincule os itens que cada um entrega em cada loja.",btn("Cadastrar fornecedor",{icon:"plus",attrs:"data-new"})))+'</section>';
 bindSearch(ctx.el,"q");
 ctx.el.querySelectorAll("tr[data-href]").forEach(tr=>tr.onclick=()=>ctx.go(tr.dataset.href));
 ctx.el.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>editSupplier(ctx,null));
}

function editSupplier(ctx,s){
 const v=s||{active:true};
 openDrawer({title:s?"Editar fornecedor":"Novo fornecedor",body:'<div class="form-grid">'+
  '<div class="span-2">'+field("Razão social ou nome",input("name",v.name,{required:true}))+'</div>'+
  field("Código",input("code",v.code,{placeholder:"Opcional"}))+field("CNPJ/CPF",input("tax_id",fmtDoc(v.tax_id),{inputmode:"numeric"}))+
  field("Telefone",input("phone",v.phone,{type:"tel"}))+field("E-mail",input("email",v.email,{type:"email"}))+
  '<div class="span-2">'+toggle("active",v.active!==false,"Fornecedor ativo")+'</div></div>',
  onSubmit:async form=>{const f=form.elements;
   if(!f.name.value.trim())throw Error("Informe o nome do fornecedor.");
   const doc=f.tax_id.value.replace(/\D/g,"");if(doc&&![11,14].includes(doc.length))throw Error("CNPJ deve ter 14 dígitos (ou CPF 11).");
   if(f.email.value&&!/^\S+@\S+\.\S+$/.test(f.email.value))throw Error("E-mail inválido.");
   const row={name:f.name.value.trim(),code:f.code.value.trim()||null,tax_id:doc||null,phone:f.phone.value.trim()||null,email:f.email.value.trim()||null,active:f.active.checked};
   if(s){await update("suppliers",s.id,row);toast("Fornecedor atualizado.");ctx.reload()}
   else{const n=await insert("suppliers",row);toast("Fornecedor cadastrado. Vincule os itens.");ctx.go("#/matriz/fornecedores/"+n.id)}
  }});
}

async function detail(ctx,id){
 const [s,links,items]=await Promise.all([get("suppliers",id),list("store_item_suppliers",{eq:{supplier_id:id}}),loadItems()]);
 if(!ctx.isCurrent())return;
 const map=byId(items);const stores=ctx.app.stores.filter(x=>x.store_type==="operational");
 const storeName=sid=>stores.find(x=>x.id===sid)?.name||sid;
 const rows=links.filter(l=>l.active!==false).sort((a,b)=>storeName(a.store_id).localeCompare(storeName(b.store_id))||String(map.get(a.item_id)?.name).localeCompare(String(map.get(b.item_id)?.name)));
 ctx.el.innerHTML=backLink("#/matriz/fornecedores","Fornecedores")+
  '<div class="doc-head"><div><div class="doc-title"><h1>'+e(s.name)+'</h1>'+(s.active!==false?'<span class="pill pill-ok">Ativo</span>':'<span class="pill pill-muted">Inativo</span>')+'</div>'+
  '<p class="muted" style="margin:6px 0 0">'+[fmtDoc(s.tax_id),s.phone,s.email].filter(Boolean).map(e).join(" · ")+'</p></div><div class="page-actions">'+btn("Editar",{variant:"secondary",icon:"edit",attrs:"data-edit"})+'</div></div>'+
  card("Itens fornecidos por loja",'<div class="add-row">'+
   field("Loja",'<select class="control" id="l-store">'+stores.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+'</option>').join("")+'<option value="*">Todas as lojas</option></select>')+
   field("Item",'<input class="control" id="l-item" list="dl-sup" placeholder="Nome ou código" autocomplete="off"><datalist id="dl-sup">'+items.filter(i=>i.active!==false).map(i=>'<option value="'+e(i.name+(i.code?" · "+i.code:""))+'">').join("")+'</datalist>')+
   '<label class="switch" style="margin-bottom:2px"><input type="checkbox" id="l-pref" checked><span class="switch-track"></span><span>Preferencial</span></label>'+
   btn("Vincular",{icon:"plus",attrs:"data-link"})+'</div>'+
   (rows.length?dataTable([
    {label:"Loja",render:l=>e(storeName(l.store_id))},
    {label:"Item",render:l=>'<span class="strong">'+e(map.get(l.item_id)?.name||"Item")+'</span><small class="sub">'+e(map.get(l.item_id)?.code||"")+'</small>'},
    {label:"Preferencial",render:l=>'<label class="switch"><input type="checkbox" data-pref="'+e(l.id)+'"'+(l.preferred?" checked":"")+'><span class="switch-track"></span></label>'},
    {label:"",cls:"act",render:l=>'<button class="icon-btn danger" data-unlink="'+e(l.id)+'" aria-label="Desvincular">'+icon("x",16)+'</button>'}
   ],rows):emptyState("layers","Nenhum item vinculado","Vincule os itens que este fornecedor entrega. Os pedidos das lojas usam esses vínculos.")),{flush:true});
 ctx.el.querySelector("[data-edit]").onclick=()=>editSupplier(ctx,s);
 ctx.el.querySelector("[data-link]").onclick=async()=>{
  const v=ctx.el.querySelector("#l-item").value.trim();const it=items.find(i=>(i.name+(i.code?" · "+i.code:""))===v||(i.code&&i.code===v));
  if(!it)return toast("Escolha um item da lista.","danger");
  const sid=ctx.el.querySelector("#l-store").value;const pref=ctx.el.querySelector("#l-pref").checked;
  const targets=sid==="*"?stores.map(x=>x.id):[sid];
  try{
   for(const st of targets){
    const ex=links.find(l=>l.store_id===st&&l.item_id===it.id);
    if(pref){for(const o of await list("store_item_suppliers",{eq:{store_id:st,item_id:it.id,preferred:true}}))if(o.supplier_id!==id)await update("store_item_suppliers",o.id,{preferred:false})}
    if(ex)await update("store_item_suppliers",ex.id,{active:true,preferred:pref});
    else await insert("store_item_suppliers",{store_id:st,item_id:it.id,supplier_id:id,preferred:pref,active:true});
   }
   toast("Item vinculado.");ctx.reload();
  }catch(error){toast(errorMessage(error),"danger")}
 };
 ctx.el.querySelectorAll("[data-pref]").forEach(c=>c.addEventListener("change",async()=>{
  const l=links.find(x=>x.id===c.dataset.pref);
  try{
   if(c.checked)for(const o of await list("store_item_suppliers",{eq:{store_id:l.store_id,item_id:l.item_id,preferred:true}}))if(o.id!==l.id)await update("store_item_suppliers",o.id,{preferred:false});
   await update("store_item_suppliers",l.id,{preferred:c.checked});toast(c.checked?"Definido como preferencial nesta loja.":"Preferência removida.");
  }catch(error){c.checked=!c.checked;toast(errorMessage(error),"danger")}
 }));
 ctx.el.querySelectorAll("[data-unlink]").forEach(b=>b.onclick=async()=>{
  if(!await confirmDialog({title:"Desvincular item?",text:"O fornecedor deixará de aparecer para este item nos pedidos da loja.",confirmLabel:"Desvincular",danger:true}))return;
  try{await remove("store_item_suppliers",b.dataset.unlink);toast("Vínculo removido.");ctx.reload()}catch(error){toast(errorMessage(error),"danger")}
 });
 void insertMany;
}
