// Retaguarda MFT — inicialização, sessão e rotas (#/matriz/... e #/loja/<loja>/...).
import {supabase} from "./core/supabase.js";
import {list} from "./core/db.js";
import {loading,alertBox,errorMessage,toast} from "./core/ui.js";
import {loginView,chooseView,passwordResetView} from "./areas/access.js";
import {matrizShell,matrizModules,setMatrizActive,bindMatrizShell} from "./areas/matriz/shell.js";
import {lojaShell,enabledModules,setLojaActive} from "./areas/loja/shell.js";

const root=document.getElementById("app");
const app={session:null,profile:null,memberships:[],stores:[],flags:{},isAdmin:false,loaded:false};
let shellKey="";let renderSeq=0;let recoveryMode=false;

async function loadContext(){
 const uid=app.session.user.id;
 const [profiles,memberships,stores,flags]=await Promise.all([
  list("user_profiles",{eq:{user_id:uid}}),
  list("store_memberships",{eq:{user_id:uid}}),
  list("stores",{eq:{active:true},order:"name",asc:true}),
  list("store_feature_flags",{select:"store_id,feature_code,enabled"})
 ]);
 app.profile=profiles[0]||null;app.memberships=memberships;app.stores=stores;
 app.isAdmin=memberships.some(m=>m.store_id==="matriz"&&m.role==="matrix_admin"&&m.active);
 app.flags={};
 for(const f of flags)(app.flags[f.store_id]||(app.flags[f.store_id]={}))[f.feature_code]=f.enabled===true;
 app.loaded=true;
}

function parseRoute(){
 const parts=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean).map(decodeURIComponent);
 return {area:parts[0]||"",parts};
}
function go(path){location.hash=path.startsWith("#")?path:"#"+path}

async function route(){
 const seq=++renderSeq;
 if(recoveryMode)return renderReset();
 if(!app.session){shellKey="";return renderLogin()}
 if(!app.loaded){
  root.innerHTML=loading("Preparando seu ambiente...");
  try{await loadContext()}catch(error){root.innerHTML='<div class="content">'+alertBox(errorMessage(error))+'</div>';return}
  if(seq!==renderSeq)return;
 }
 const {area,parts}=parseRoute();
 const shops=app.stores.filter(s=>s.store_type==="operational");
 if(area==="matriz"){
  if(!app.isAdmin)return renderChoose("Seu usuário não tem acesso administrativo à Matriz.");
  const id=matrizModules.some(m=>m.id===parts[1])?parts[1]:"painel";
  if("matriz"!==shellKey){root.innerHTML=matrizShell(app,id);shellKey="matriz";bindShell();bindMatrizShell(root)}
  setMatrizActive(root,id);
  const mod=matrizModules.find(m=>m.id===id).mod;
  return runModule(seq,mod,{area:"matriz",params:parts.slice(2),storeId:null,store:null});
 }
 if(area==="loja"){
  const storeId=parts[1];
  const store=shops.find(s=>s.id===storeId);
  if(!store)return renderChoose(storeId?"Loja não encontrada ou sem acesso.":"");
  const mods=enabledModules(app,storeId);
  const id=mods.some(m=>m.id===parts[2])?parts[2]:"inicio";
  const key="loja:"+storeId;
  if(key!==shellKey){root.innerHTML=lojaShell(app,storeId,id);shellKey=key;bindShell()}
  setLojaActive(root,id);
  const mod=mods.find(m=>m.id===id).mod;
  return runModule(seq,mod,{area:"loja",params:parts.slice(3),storeId,store});
 }
 // Sem rota: se só há um destino possível, entra direto.
 if(!app.isAdmin&&shops.length===1)return go("/loja/"+shops[0].id);
 renderChoose();
}

async function runModule(seq,mod,info){
 const el=root.querySelector("#content");
 el.innerHTML=loading();
 window.scrollTo(0,0);
 const ctx={...info,app,el,userId:app.session.user.id,go,
  base:info.area==="matriz"?"#/matriz":"#/loja/"+encodeURIComponent(info.storeId),
  isCurrent:()=>seq===renderSeq,
  reload:()=>route()};
 try{await mod.render(ctx)}
 catch(error){if(seq===renderSeq)el.innerHTML=alertBox(errorMessage(error))}
}

function bindShell(){
 root.querySelectorAll("[data-signout]").forEach(b=>b.addEventListener("click",signOut));
 root.querySelector("#store-switch")?.addEventListener("change",ev=>{
  const mod=parseRoute().parts[2]||"";go("/loja/"+encodeURIComponent(ev.target.value)+(mod?"/"+mod:""));
 });
}
async function signOut(){
 await supabase.auth.signOut();
 app.loaded=false;shellKey="";history.replaceState(null,"",location.pathname);route();
}

function renderLogin(state={}){
 root.innerHTML=loginView(state);
 const form=root.querySelector("#auth-form");
 root.querySelector("#toggle-recovery").onclick=()=>renderLogin({email:form.elements.email.value,recovery:!state.recovery});
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();
  const email=form.elements.email.value.trim();
  if(!email)return renderLogin({...state,error:"Informe o e-mail."});
  if(state.recovery){
   renderLogin({...state,email,busy:true});
   const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   if(error)return renderLogin({recovery:true,email,error:errorMessage(error)});
   renderLogin({email});toast("Se o e-mail estiver cadastrado, você receberá o link em instantes.","info");return;
  }
  const password=form.elements.password.value;
  if(!password)return renderLogin({email,error:"Informe a senha."});
  renderLogin({email,busy:true});
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error)renderLogin({email,error:/invalid login/i.test(error.message)?"E-mail ou senha incorretos.":/not confirmed/i.test(error.message)?"Confirme seu e-mail antes de entrar.":errorMessage(error)});
 });
}
function renderReset(state={}){
 root.innerHTML=passwordResetView(state);
 const form=root.querySelector("#reset-form");
 form.addEventListener("submit",async ev=>{
  ev.preventDefault();
  const p=form.elements.password.value,c=form.elements.confirm.value;
  if(p.length<8)return renderReset({error:"A senha precisa ter ao menos 8 caracteres."});
  if(p!==c)return renderReset({error:"As senhas não conferem."});
  renderReset({busy:true});
  const {error}=await supabase.auth.updateUser({password:p});
  if(error)return renderReset({error:errorMessage(error)});
  recoveryMode=false;toast("Senha atualizada.");route();
 });
}
function renderChoose(message=""){
 shellKey="";
 root.innerHTML=chooseView(app,message);
 root.querySelectorAll("[data-signout]").forEach(b=>b.addEventListener("click",signOut));
}

async function start(){
 const {data}=await supabase.auth.getSession();
 app.session=data.session;
 supabase.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY")recoveryMode=true;
  const changed=(app.session?.user?.id||null)!==(session?.user?.id||null);
  app.session=session;
  if(changed){app.loaded=false;shellKey="";setTimeout(route,0)}
  else if(event==="PASSWORD_RECOVERY")setTimeout(route,0);
 });
 window.addEventListener("hashchange",route);
 route();
}
start();
