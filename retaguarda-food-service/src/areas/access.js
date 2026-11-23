// Telas de acesso: login (Supabase Auth) e escolha de ambiente/unidade.
import {e,initials} from "../core/format.js";
import {icon} from "../core/icons.js";
import {btn,field,input,alertBox} from "../core/ui.js";
import {hasMatrix,storeAllowed} from "../core/access.js";

export const LOGO="./assets/brand/logo-mft.png";

export function loginView({email="",error="",busy=false,recovery=false}={}){
 return '<main class="auth"><section class="auth-main">'+
  '<img class="auth-logo" src="'+LOGO+'" alt="MFT Gestão de Franquias">'+
  '<h1>'+(recovery?"Recuperar acesso":"Bem-vindo à Retaguarda")+'</h1>'+
  '<p>'+(recovery?"Informe seu e-mail. Enviaremos um link para você definir uma nova senha.":"Entre com sua conta para acessar a Matriz ou a operação das suas lojas.")+'</p>'+
  (error?alertBox(error):'')+
  '<form class="auth-form" id="auth-form" novalidate>'+
  field("E-mail",input("email",email,{type:"email",required:true,attrs:'autocomplete="username" autofocus'}))+
  (recovery?'':field("Senha",input("password","",{type:"password",required:true,attrs:'autocomplete="current-password"'})))+
  btn(busy?"Aguarde...":recovery?"Enviar link":"Entrar",{type:"submit",disabled:busy})+
  '<button type="button" class="btn btn-ghost" id="toggle-recovery">'+(recovery?"Voltar ao login":"Esqueci minha senha")+'</button>'+
  '</form><div class="auth-foot">MFT Gestão de Franquias · Retaguarda Food Service</div></section>'+
  '<aside class="auth-side" aria-hidden="true"><h2>Gestão de estoque, compras e CMV em um só lugar.</h2>'+
  '<div class="auth-points"><div><strong>Contagem</strong><span>Inventário rápido por listas</span></div><div><strong>Compras</strong><span>Sugestão por consumo</span></div><div><strong>CMV</strong><span>Fechamento com memória de cálculo</span></div></div></aside></main>';
}

export function passwordResetView({error="",busy=false}={}){
 return '<main class="auth"><section class="auth-main"><img class="auth-logo" src="'+LOGO+'" alt="MFT Gestão de Franquias">'+
  '<h1>Definir nova senha</h1><p>Escolha uma senha com pelo menos 8 caracteres.</p>'+(error?alertBox(error):'')+
  '<form class="auth-form" id="reset-form" novalidate>'+field("Nova senha",input("password","",{type:"password",required:true,attrs:'autocomplete="new-password" minlength="8"'}))+
  field("Confirmar senha",input("confirm","",{type:"password",required:true,attrs:'autocomplete="new-password"'}))+
  btn(busy?"Salvando...":"Salvar senha",{type:"submit",disabled:busy})+'</form></section><aside class="auth-side" aria-hidden="true"><h2>Acesso seguro.</h2></aside></main>';
}

export function userChip(app){
 const name=app.profile?.display_name||app.session?.user?.email||"";
 return '<span class="user-chip"><span class="avatar">'+e(initials(name))+'</span><span>'+e(name)+'</span></span>';
}

export function chooseView(app,message=""){
 const shops=app.stores.filter(s=>s.store_type==="operational"&&s.active!==false&&storeAllowed(app,s.id));
 let html='<main class="choose"><header class="choose-top"><img src="'+LOGO+'" alt="MFT"><div class="user-chip">'+userChip(app)+
  btn("Sair",{variant:"ghost",icon:"logout",attrs:'data-signout'})+'</div></header><section class="choose-body">'+
  '<h1>Olá, '+e((app.profile?.display_name||"").split(" ")[0]||"bem-vindo")+'</h1><p>Escolha onde deseja trabalhar agora.</p>'+(message?alertBox(message,"warn"):"");
 if(hasMatrix(app)){
  html+='<div class="choose-section"><h2>Administração</h2><div class="choose-grid"><a class="choose-card matriz" href="#/matriz">'+
   '<span class="kpi-icon">'+icon("grid",22)+'</span><strong>Matriz</strong><span>Itens, fornecedores, usuários e acompanhamento de todas as lojas.</span></a></div></div>';
 }
 html+='<div class="choose-section"><h2>Lojas</h2>';
 if(shops.length){
  html+='<div class="choose-grid">'+shops.map(s=>'<a class="choose-card" href="#/loja/'+encodeURIComponent(s.id)+'"><span class="kpi-icon">'+icon("store",22)+'</span><strong>'+e(s.name)+'</strong><span>'+e(s.code||"")+' · Operação da loja</span></a>').join("")+'</div>';
 }else html+='<div class="card"><div class="card-body muted">Nenhuma loja vinculada ao seu usuário. Solicite acesso ao administrador da Matriz.</div></div>';
 return html+'</div></section></main>';
}
