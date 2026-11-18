import {supabase} from "./core/supabase.js";
import {getStores,getRows,getDashboard,getSetup} from "./core/api.js";
import {getLines,getLookupRows,saveRow,removeRow,changeStatus} from "./core/write-api.js";
import {normalize,models} from "./core/models.js";
import {moduleById} from "./modules/index.js";
import {renderList} from "./components/table.js";
import {renderEditor} from "./components/editor.js";
import {renderEntry} from "./components/entry.js";
import {renderAreaChoice,renderStoreChoice} from "./areas/selection.js";
import {matrixLayout} from "./areas/matriz/layout.js";
import {storeLayout} from "./areas/loja/layout.js";
import {matrixIds} from "./areas/matriz/config.js";
import {storeIds} from "./areas/loja/config.js";
import {isMatrixAdmin,getMatrixHome,getMatrixOrders} from "./areas/matriz/data.js";
import {matrixHome,matrixOrders} from "./areas/matriz/home.js";
import {storeHome} from "./areas/loja/home.js";
import {renderSetup} from "./modules/configuracao/index.js";
import {getStoreFeatures,canEditModule} from "./core/features.js";

const ENTRY_KEY="retaguarda_food_service_entry_v1";
const AREA_KEY="retaguarda_food_service_area_v1";
const STORE_KEY="retaguarda_food_service_selected_store_v1";
function getSaved(key){try{return sessionStorage.getItem(key)}catch{return null}}
function setSaved(key,value){try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key)}catch{}}
const entered=getSaved(ENTRY_KEY)==="yes";
const savedArea=entered?getSaved(AREA_KEY):null;
const area=["matriz","loja"].includes(savedArea)?savedArea:null;
const storedStore=area==="loja"?(getSaved(STORE_KEY)||""):"";
const state={
 entered,area,needsStoreChoice:area==="loja"&&!storedStore,
 mode:"live",moduleId:area==="matriz"?"inicio-matriz":"dashboard",
 storeId:storedStore,stores:[],session:null,matrixAuthorized:true,
 rows:[],dashboard:{},matrixDashboard:{},matrixOrderRows:[],setup:{},
 loading:false,error:"",toast:"",editor:null,lines:[],lookups:{},features:{}
};
const root=document.getElementById("app");
let requestId=0;
function operationalStores(){
 return state.stores.filter(s=>s.store_type==="operational");
}
function stopRequests(){requestId++;state.loading=false;state.editor=null}

async function initialize(){
 render();
 try{
  const {data,error}=await supabase.auth.getSession();
  if(error)throw error;
  state.session=data.session;
 }catch(error){state.error="Sessão Supabase: "+error.message}
 supabase.auth.onAuthStateChange((_event,session)=>{
  // Renovação de token (TOKEN_REFRESHED) e INITIAL_SESSION não trocam o usuário:
  // recarregar aqui fecharia formulários abertos e duplicaria consultas.
  const changedUser=(state.session?.user?.id||null)!==(session?.user?.id||null);
  state.session=session;
  // setTimeout evita chamar o Supabase dentro do callback de autenticação (risco de bloqueio).
  if(changedUser&&state.area)setTimeout(refreshStores,0);
 });
 if(state.entered&&state.area)await refreshStores();
 else render();
}
async function chooseArea(next){
 if(!["matriz","loja"].includes(next))return;
 stopRequests();
 state.area=next;state.moduleId=next==="matriz"?"inicio-matriz":"dashboard";
 state.storeId="";state.needsStoreChoice=next==="loja";
 state.matrixAuthorized=true;state.error="";state.toast="";
 setSaved(AREA_KEY,next);setSaved(STORE_KEY,null);
 await refreshStores();
}
function changeArea(){
 stopRequests();
 state.area=null;state.storeId="";state.needsStoreChoice=false;
 state.error="";state.toast="";state.matrixAuthorized=true;
 setSaved(AREA_KEY,null);setSaved(STORE_KEY,null);render();
}
async function exitApp(){
 if(state.session){
  const {error}=await supabase.auth.signOut();
  if(error){state.error="Não foi possível sair do Supabase: "+error.message;render();return}
 }
 stopRequests();setSaved(ENTRY_KEY,null);setSaved(AREA_KEY,null);setSaved(STORE_KEY,null);
 state.entered=false;state.area=null;state.storeId="";state.mode="live";
 state.session=null;state.error="";state.toast="";state.moduleId="dashboard";render();
}
async function refreshStores(){
 if(!state.area){render();return}
 const id=++requestId;
 state.loading=true;state.error="";state.editor=null;render();
 if(!state.session){
  state.stores=[];state.storeId="";state.loading=false;
  if(state.area==="loja")state.needsStoreChoice=true;
  render();return;
 }
 try{
  const stores=await getStores(state.mode);
  if(id!==requestId)return;
  state.stores=stores;
  if(state.area==="matriz"){
   state.storeId="";state.features={};
   state.matrixAuthorized=await isMatrixAdmin(state.mode,state.session?.user?.id);
   if(id!==requestId)return;
   if(!state.matrixAuthorized){state.loading=false;render();return}
  }else{
   if(!operationalStores().some(s=>s.id===state.storeId)){
    state.storeId="";state.needsStoreChoice=true;setSaved(STORE_KEY,null);
   }
   if(state.needsStoreChoice){state.features={};state.loading=false;render();return}
   state.features=await getStoreFeatures(state.storeId);
   if(id!==requestId)return;
  }
  await loadModule();
 }catch(error){
  if(id!==requestId)return;
  state.loading=false;state.error="Carregamento de unidades: "+error.message;render();
 }
}
async function loadModule(){
 if(!state.area)return;
 if(state.area==="loja"&&state.needsStoreChoice){render();return}
 if(state.area==="matriz"&&!matrixIds.has(state.moduleId))state.moduleId="inicio-matriz";
 if(state.area==="loja"&&!storeIds.has(state.moduleId))state.moduleId="dashboard";
 if(!state.session||(state.area==="matriz"&&!state.matrixAuthorized)){
  state.loading=false;render();return;
 }
 const id=++requestId;state.loading=true;state.error="";state.editor=null;render();
 try{
  if(state.area==="matriz"&&state.moduleId==="inicio-matriz")state.matrixDashboard=await getMatrixHome(state.mode,state.stores);
  else if(state.area==="matriz"&&state.moduleId==="pedidos-matriz")state.matrixOrderRows=await getMatrixOrders(state.mode);
  else if(state.area==="loja"&&state.moduleId==="dashboard")state.dashboard=await getDashboard(state.mode,state.storeId);
  else if(state.moduleId==="configuracao")state.setup=await getSetup(state.mode,null);
  else{
   const module=moduleById[state.moduleId];
   if(!module)throw Error("Módulo não encontrado.");
   state.rows=await getRows(module,state.mode,state.area==="loja"?state.storeId:null);
  }
  if(id!==requestId)return;
  state.loading=false;render();
 }catch(error){
  if(id!==requestId)return;
  state.rows=[];state.loading=false;state.error="Consulta: "+error.message;render();
 }
}
async function openEditor(row=null){
 const model=models[state.moduleId];
 if(!model||model.readOnly)return;
 if(!(state.area==="matriz"?matrixIds:storeIds).has(state.moduleId))return;
 if(!canEditModule(state.area,state.moduleId,state.features)){state.error="Funcionalidade ainda não liberada para gravação nesta loja.";render();return}
 state.loading=true;state.error="";render();
 try{
  const types=[...new Set(model.fields.concat(model.line?.fields||[]).filter(f=>f.type==="lookup").map(f=>f.lookup))];
  const data=await Promise.all(types.map(t=>getLookupRows(t,state.mode,state.storeId)));
  state.lookups=Object.fromEntries(types.map((t,i)=>[t,data[i]]));
  state.lines=row&&model.line?await getLines(model,row.id,state.storeId,state.mode):[];
  state.editor={record:row,lineEditor:false};
 }catch(error){state.error="Formulário: "+error.message}
 state.loading=false;render();
}
function moduleContent(){
 if(state.area==="matriz"){
  if(state.moduleId==="inicio-matriz")return matrixHome(state.matrixDashboard,state.mode);
  if(state.moduleId==="pedidos-matriz")return matrixOrders(state.matrixOrderRows,state.stores);
  if(state.moduleId==="configuracao")return renderSetup(state.setup,state.mode,null);
 }else if(state.area==="loja"&&state.moduleId==="dashboard"){
  return storeHome(state.dashboard,operationalStores().find(s=>s.id===state.storeId));
 }
 const descriptor=moduleById[state.moduleId];
 return descriptor?renderList(descriptor,state.rows,"live",canEditModule(state.area,state.moduleId,state.features)):"";
}
function bindAreaButtons(){
 root.querySelectorAll("[data-area]").forEach(b=>b.addEventListener("click",()=>chooseArea(b.dataset.area)));
}
function bindChangeArea(){
 root.querySelectorAll("#change-area").forEach(b=>b.addEventListener("click",changeArea));
}
function bindExit(){
 root.querySelectorAll("#return-to-entry").forEach(b=>b.addEventListener("click",exitApp));
}
function render(){
 if(!state.entered){
  root.innerHTML=renderEntry();
  root.querySelector("#prototype-enter")?.addEventListener("click",()=>{
   setSaved(ENTRY_KEY,"yes");
   state.entered=true;state.area=null;state.mode="live";state.error="";state.toast="";
   setSaved(AREA_KEY,null);setSaved(STORE_KEY,null);render();
  });
  return;
 }
 if(!state.area){
  root.innerHTML=renderAreaChoice();bindAreaButtons();bindExit();return;
 }
 if(state.area==="loja"&&state.needsStoreChoice&&!state.loading&&!(state.mode==="live"&&!state.session)){
  root.innerHTML=renderStoreChoice(state.stores,state.error);
  bindAreaButtons();bindChangeArea();
  root.querySelectorAll("[data-choose-store]").forEach(b=>b.addEventListener("click",async()=>{
   const id=b.dataset.chooseStore;
   if(!operationalStores().some(s=>s.id===id))return;
   state.storeId=id;state.needsStoreChoice=false;setSaved(STORE_KEY,id);
   state.loading=true;render();
   try{state.features=await getStoreFeatures(id);await loadModule()}
   catch(error){state.loading=false;state.error="Funcionalidades: "+error.message;render()}
  }));
  return;
 }
 let content=moduleContent();
 if(state.editor)content=renderEditor(state)+content;
 if(state.toast)content='<div class="success-box" role="status">'+state.toast+'</div>'+content;
 root.innerHTML=state.area==="matriz"?matrixLayout(state,content):storeLayout(state,content);
 bindExit();bindChangeArea();
 root.querySelectorAll("[data-module]").forEach(b=>b.addEventListener("click",()=>{
  const target=b.dataset.module;
  if(!(state.area==="matriz"?matrixIds:storeIds).has(target))return;
  state.moduleId=target;state.toast="";loadModule();
 }));
 root.querySelector("#store")?.addEventListener("change",event=>{
  const id=event.target.value;
  if(!operationalStores().some(s=>s.id===id))return;
  state.storeId=id;setSaved(STORE_KEY,id);getStoreFeatures(id).then(f=>{state.features=f;loadModule()}).catch(error=>{state.error=error.message;render()});
 });
 root.querySelector("#choose-store")?.addEventListener("click",()=>{
  stopRequests();state.needsStoreChoice=true;render();
 });
 bindForms();
}
function bindForms(){
 root.querySelectorAll("[data-new-record]").forEach(b=>b.addEventListener("click",()=>openEditor()));
 root.querySelectorAll("[data-edit-record]").forEach(b=>b.addEventListener("click",()=>{
  const row=state.rows.find(x=>String(x.id)===b.dataset.editRecord);if(row)openEditor(row);
 }));
 root.querySelectorAll("[data-close-editor]").forEach(b=>b.addEventListener("click",()=>{state.editor=null;render()}));
 const form=root.querySelector("#record-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();
  const model=models[state.moduleId],row=state.editor?.record||{};
  if(!model||model.locked?.includes(row.status))return;
  if(!canEditModule(state.area,state.moduleId,state.features)){state.error="Função não liberada nesta loja.";render();return}
  try{
   const payload=normalize(model,form,row,{storeId:state.storeId,userId:state.session?.user?.id});
   const saved=await saveRow(model,payload,row[model.id],state.mode);
   state.toast="Registro salvo.";
   await loadModule();
   const found=state.rows.find(x=>x.id===saved.id);
   if(found)await openEditor(found);
   render();
  }catch(error){state.error="Não foi possível salvar: "+error.message;render()}
 });
 root.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",async()=>{
  const model=models[state.moduleId],row=state.editor?.record,status=b.dataset.status;
  if(!model||!row)return;
  if(!canEditModule(state.area,state.moduleId,state.features)){state.error="Função não liberada nesta loja.";render();return}
  if(!confirm("Alterar status? Esta operação pode gerar movimentações de estoque."))return;
  try{
   if(model.line&&!state.lines.length&&status!=="cancelled")throw Error("Inclua itens antes de finalizar.");
   await changeStatus(model,row,status,state.mode);
   state.toast="Status atualizado.";await loadModule();
  }catch(error){state.error=error.message;render()}
 }));
 root.querySelector("[data-new-line]")?.addEventListener("click",()=>{state.editor.lineEditor=true;render()});
 root.querySelector("[data-cancel-line]")?.addEventListener("click",()=>{state.editor.lineEditor=false;render()});
 const lf=root.querySelector("#line-form");
 if(lf)lf.addEventListener("submit",async event=>{
  event.preventDefault();const model=models[state.moduleId],row=state.editor.record;
  try{
   const payload=normalize(model,lf,row,{storeId:state.storeId,userId:state.session?.user?.id,child:true,parentId:row.id});
   if(model.line.table==="purchase_list_items"&&state.lines.some(line=>line.item_id===payload.item_id))throw Error("Este item já está na lista.");
   await saveRow(model,payload,null,state.mode,{child:true});
   state.lines=await getLines(model,row.id,state.storeId,state.mode);
   state.editor.lineEditor=false;state.toast="Item adicionado.";render();
  }catch(error){state.error=error.message;render()}
 });
 root.querySelector("[data-remove-line]")?.addEventListener("click",async()=>{
  const id=root.querySelector("#line-remove-id")?.value;if(!id||!confirm("Remover item?"))return;
  try{
   const model=models[state.moduleId];await removeRow(model,id,state.mode,{child:true});
   state.lines=await getLines(model,state.editor.record.id,state.storeId,state.mode);
   state.toast="Item removido.";render();
  }catch(error){state.error=error.message;render()}
 });
 root.querySelectorAll("[data-area-target]").forEach(b=>b.addEventListener("click",()=>chooseArea(b.dataset.areaTarget)));
 const login=root.querySelector("#login-form");
 if(login)login.addEventListener("submit",async event=>{
  event.preventDefault();
  const b=login.querySelector("button[type=submit]");b.disabled=true;b.textContent="Autenticando...";
  const {error}=await supabase.auth.signInWithPassword({email:login.querySelector("#email").value.trim(),password:login.querySelector("#password").value});
  if(error){state.error="Login: "+error.message;render();}
 });
 root.querySelector("#signout")?.addEventListener("click",async()=>{
  const {error}=await supabase.auth.signOut();
  if(error){state.error="Falha ao sair do Supabase: "+error.message;render();}
 });
}
initialize();
