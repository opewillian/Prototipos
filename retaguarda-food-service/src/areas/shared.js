import {escapeHtml as e} from "../core/format.js";
export function sourceControl(state){
 return '<div class="area-source"><label>Fonte de dados</label><div><button data-mode="demo" class="'+(state.mode==="demo"?"active":"")+'">Demonstração</button><button data-mode="live" class="'+(state.mode==="live"?"active":"")+'">Supabase</button></div></div>';
}
export function commonActions(state){
 return '<div class="area-actions">'+(state.mode==="live"&&state.session?.user?.email?'<span>'+e(state.session.user.email)+'</span>':"")+
 '<button id="change-area">Trocar ambiente</button><button id="return-to-entry">Sair</button>'+
 (state.mode==="live"&&state.session?'<button id="signout">Sair do Supabase</button>':"")+'</div>';
}
export function accessBody(state,content){
 if(state.mode==="live"&&!state.session)return '<section class="panel real-login"><h2>Entrar no Supabase</h2><p>O acesso ao protótipo é livre, mas os dados reais exigem autenticação.</p><form id="login-form"><label>E-mail<input id="email" type="email" required autocomplete="username"></label><label>Senha<input id="password" type="password" required autocomplete="current-password"></label><button class="primary-btn" type="submit">Entrar no Supabase</button></form></section>';
 if(state.mode==="live"&&state.area==="matriz"&&state.matrixAuthorized===false)return '<section class="panel real-login"><h2>Acesso não autorizado</h2><p>O usuário não possui o perfil administrativo ativo da Matriz.</p><button id="change-area" class="secondary-btn">Escolher outro ambiente</button></section>';
 return state.loading?'<div class="loading" role="status">Carregando...</div>':content;
}
export function modeNote(state){
 return '<div class="area-mode-note '+(state.mode==="live"?"live":"")+'">'+(state.mode==="live"?"Supabase: acesso real sujeito às permissões por usuário e unidade.":"Demonstração: todos os registros são fictícios e armazenados somente no navegador.")+'</div>';
}
