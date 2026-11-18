import {escapeHtml as e} from "../core/format.js";
export function commonActions(state){
 return '<div class="area-actions">'+(state.session?.user?.email?'<span>'+e(state.session.user.email)+'</span>':"")+
 '<button id="change-area">Trocar ambiente</button><button id="return-to-entry">Sair</button>'+
 (state.session?'<button id="signout">Sair do Supabase</button>':"")+'</div>';
}
export function accessBody(state,content){
 if(!state.session)return '<section class="panel real-login"><span class="eyebrow">ACESSO PROTEGIDO</span><h2>Entrar no Supabase</h2>'+
 '<p>Para acessar os dados da retaguarda, entre com e-mail e senha de um usuário autorizado.</p>'+
 '<form id="login-form"><label>E-mail<input id="email" type="email" required autocomplete="username"></label>'+
 '<label>Senha<input id="password" type="password" required autocomplete="current-password"></label>'+
 '<button class="primary-btn" type="submit">Entrar com segurança</button></form></section>';
 if(state.area==="matriz"&&state.matrixAuthorized===false)return '<section class="panel real-login"><h2>Acesso negado</h2>'+
 '<p>Esta conta não possui permissão administrativa da Matriz.</p><button id="change-area" class="secondary-btn">Trocar ambiente</button></section>';
 return state.loading?'<div class="loading" role="status">Consultando o Supabase...</div>':content;
}
export function modeNote(state){
 return '<div class="area-mode-note live">'+(state.area==="loja"?"Registros exclusivos da unidade selecionada.":"Cadastros e relatórios centrais.")+
 ' Dados consultados diretamente no Supabase, com controle de acesso por usuário e unidade.</div>';
}
export function sourceControl(){return "";}
