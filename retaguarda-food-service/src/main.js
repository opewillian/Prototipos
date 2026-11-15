import {supabase} from "./core/supabase.js";
import {getStores,getRows,getDashboard,getSetup} from "./core/api.js";
import {getLines,getLookupRows,saveRow,removeRow,changeStatus} from "./core/write-api.js";
import {normalize,models} from "./core/models.js";
import {modules,moduleById} from "./modules/index.js";
import {layout,accountButton} from "./components/layout.js";
import {renderList} from "./components/table.js";
import {renderEditor} from "./components/editor.js";
import {renderDashboard} from "./modules/dashboard/index.js";
import {renderSetup} from "./modules/configuracao/index.js";

const state={mode:"demo",moduleId:"dashboard",storeId:"",stores:[],session:null,rows:[],dashboard:{},
 loading:false,error:"",toast:"",editor:null,lines:[],lookups:{},setup:{}};
const root=document.getElementById("app");
let requestId=0;
async function initialize(){
 try{
  const {data,error}=await supabase.auth.getSession();
  if(error)throw error;
  state.session=data.session;
 }catch(error){state.error="Sessão indisponível: "+error.message}
 supabase.auth.onAuthStateChange((_event,session)=>{
  state.session=session;
  if(state.mode==="live")Promise.resolve().then(refreshStores);
 });
 await refreshStores();
}
async function refreshStores(){
 const id=++requestId;state.loading=true;state.editor=null;state.error="";render();
 if(state.mode==="live"&&!state.session){state.stores=[];state.storeId="";state.loading=false;render();return}
 try{
  const stores=await getStores(state.mode);
  if(id!==requestId)return;
  state.stores=stores;
  if(!stores.some(s=>s.id===state.storeId))state.storeId=stores.find(s=>s.store_type==="operational")?.id||stores[0]?.id||"";
  await loadModule();
 }catch(error){if(id!==requestId)return;state.error=error.message;state.loading=false;render()}
}
async function loadModule(){
 const id=++requestId;state.loading=true;state.editor=null;state.error="";render();
 try{
  if(state.moduleId==="dashboard")state.dashboard=await getDashboard(state.mode,state.storeId);
  else if(state.moduleId==="configuracao")state.setup=await getSetup(state.mode,state.storeId);
  else state.rows=await getRows(moduleById[state.moduleId],state.mode,state.storeId);
  if(id!==requestId)return;
  state.loading=false;render();
 }catch(error){if(id!==requestId)return;state.error="Consulta: "+error.message;state.loading=false;render()}
}
async function openEditor(row=null){
 const model=models[state.moduleId];if(!model||model.readOnly)return;
 state.loading=true;state.error="";render();
 try{
  const lookupTypes=[...new Set(model.fields.concat(model.line?.fields||[]).filter(f=>f.type==="lookup").map(f=>f.lookup))];
  const looked=await Promise.all(lookupTypes.map(t=>getLookupRows(t,state.mode,state.storeId)));
  state.lookups=Object.fromEntries(lookupTypes.map((t,i)=>[t,looked[i]]));
  state.lines=row&&model.line?await getLines(model,row.id,state.storeId,state.mode):[];
  state.editor={record:row,lineEditor:false};
 }catch(error){state.error="Carregamento do formulário: "+error.message}
 state.loading=false;render();
}
async function refreshEditor(id){
 const model=models[state.moduleId];
 const row=state.rows.find(x=>x.id===id)||null;
 if(!row){await loadModule();return}
 await openEditor(row);
}
function render(){
 let content=state.moduleId==="dashboard"?renderDashboard(state.dashboard,state.mode):
  state.moduleId==="configuracao"?renderSetup(state.setup,state.mode,state.stores.find(s=>s.id===state.storeId)):
  renderList(moduleById[state.moduleId],state.rows,state.mode);
 if(state.editor)content=renderEditor(state)+content;
 if(state.toast)content='<div class="success-box" role="status">'+state.toast+'</div>'+content;
 root.innerHTML=layout(state,content);
 const bar=root.querySelector(".top-actions");
 if(bar)bar.insertAdjacentHTML("beforeend",accountButton(state));
 root.querySelectorAll("[data-module]").forEach(button=>button.addEventListener("click",()=>{state.moduleId=button.dataset.module;state.toast="";loadModule()}));
 root.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.mode===state.mode)return;state.mode=button.dataset.mode;state.toast="";refreshStores()}));
 const store=root.querySelector("#store");
 if(store)store.addEventListener("change",()=>{state.storeId=store.value;loadModule()});
 root.querySelectorAll("[data-new-record]").forEach(b=>b.addEventListener("click",()=>openEditor()));
 root.querySelectorAll("[data-edit-record]").forEach(b=>b.addEventListener("click",()=>{
  const row=state.rows.find(x=>String(x.id)===b.dataset.editRecord);
  if(row)openEditor(row);
 }));
 root.querySelectorAll("[data-close-editor]").forEach(b=>b.addEventListener("click",()=>{state.editor=null;render()}));
 const mainform=root.querySelector("#record-form");
 if(mainform)mainform.addEventListener("submit",async event=>{
  event.preventDefault();const model=models[state.moduleId],row=state.editor?.record||{};
  if(model.locked?.includes(row.status))return;
  try{
   const payload=normalize(model,mainform,row,{storeId:state.storeId,userId:state.session?.user?.id});
   const saved=await saveRow(model,payload,row[model.id],state.mode);
   state.toast="Registro salvo com sucesso.";
   if(model.table==="stores")await refreshStores();
   else await loadModule();
   // Mantém formulário aberto para adicionar itens após a inclusão.
   const found=state.rows.find(x=>x.id===saved.id);
   if(found)await openEditor(found);
   render();
  }catch(error){state.error="Não foi possível salvar: "+error.message;render()}
 });
 root.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",async()=>{
  const model=models[state.moduleId],row=state.editor?.record;
  if(!row)return;
  const status=b.dataset.status;
  if(!confirm("Alterar situação para "+status+"? Em algumas situações o banco gera movimentações de estoque irreversíveis."))return;
  try{
   if(model.line&&!state.lines.length&&status!=="cancelled")throw Error("Inclua os itens antes de finalizar.");
   await changeStatus(model,row,status,state.mode);
   state.toast="Situação atualizada.";await loadModule();
  }catch(error){state.error="Não foi possível mudar a situação: "+error.message;render()}
 }));
 const addLine=root.querySelector("[data-new-line]");
 if(addLine)addLine.addEventListener("click",()=>{state.editor.lineEditor=true;render()});
 const cancelLine=root.querySelector("[data-cancel-line]");
 if(cancelLine)cancelLine.addEventListener("click",()=>{state.editor.lineEditor=false;render()});
 const lineForm=root.querySelector("#line-form");
 if(lineForm)lineForm.addEventListener("submit",async event=>{
  event.preventDefault();const model=models[state.moduleId],row=state.editor.record;
  try{
   const payload=normalize(model,lineForm,row,{storeId:state.storeId,userId:state.session?.user?.id,child:true,parentId:row.id});
   if(model.line.table==="purchase_list_items" && state.lines.some(line=>line.item_id===payload.item_id))throw Error("Este item já faz parte da lista.");
   await saveRow(model,payload,null,state.mode,{child:true});
   state.lines=await getLines(model,row.id,state.storeId,state.mode);
   state.editor.lineEditor=false;state.toast="Item incluído.";render();
  }catch(error){state.error="Não foi possível incluir o item: "+error.message;render()}
 });
 const delLine=root.querySelector("[data-remove-line]");
 if(delLine)delLine.addEventListener("click",async()=>{
  const id=root.querySelector("#line-remove-id")?.value;
  if(!id||!confirm("Excluir este item?"))return;
  try{
   const model=models[state.moduleId];
   await removeRow(model,id,state.mode,{child:true});
   state.lines=await getLines(model,state.editor.record.id,state.storeId,state.mode);
   state.toast="Item excluído.";render();
  }catch(error){state.error="Não foi possível excluir o item: "+error.message;render()}
 });
 const form=root.querySelector("#login-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();const button=form.querySelector("button[type=submit]");
  button.disabled=true;button.textContent="Autenticando...";
  const {error}=await supabase.auth.signInWithPassword({email:form.querySelector("#email").value.trim(),password:form.querySelector("#password").value});
  if(error){state.error="Login: "+error.message;render()}
 });
 const signout=root.querySelector("#signout");
 if(signout)signout.addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();if(error){state.error=error.message;render()}});
}
initialize();
