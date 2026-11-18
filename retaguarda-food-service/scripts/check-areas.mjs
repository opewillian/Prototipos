import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {renderAreaChoice,renderStoreChoice} from "../src/areas/selection.js";
import {renderEntry} from "../src/components/entry.js";
import {matrixModules,matrixIds} from "../src/areas/matriz/config.js";
import {storeModules,storeIds} from "../src/areas/loja/config.js";
import {matrixLayout} from "../src/areas/matriz/layout.js";
import {storeLayout} from "../src/areas/loja/layout.js";
import {accessBody} from "../src/areas/shared.js";
import {renderList} from "../src/components/table.js";
import {models} from "../src/core/models.js";
import {featureByModule} from "../src/core/feature-map.js";
import lojas from "../src/modules/lojas/index.js";

const stores=[
 {id:"matriz",name:"Matriz",code:"MATRIZ",store_type:"matrix"},
 {id:"teste",name:"Teste",code:"TESTE",store_type:"operational"}
];
const session={user:{id:"usuario-admin",email:"usuario@exemplo.invalid"}};
const state={area:"matriz",mode:"live",session,stores,storeId:"",moduleId:"inicio-matriz",
  error:"",loading:false,matrixAuthorized:true,features:{counts:true,notes:true,orders:true,lists:true,cmv:true}};

const entry=renderEntry();
assert.match(entry,/id="prototype-enter"/);
assert.doesNotMatch(entry,/demonstração|dados fictícios|02|03/i);

const choice=renderAreaChoice();
assert.match(choice,/data-area="matriz"/);
assert.match(choice,/data-area="loja"/);
assert.doesNotMatch(choice,/demonstração/i);

const matrix=matrixLayout(state,"<p>Conteúdo da Matriz</p>");
assert.match(matrix,/mat-shell/);
assert.match(matrix,/data-module="lojas"/);
assert.match(matrix,/data-module="usuarios"/);
assert.doesNotMatch(matrix,/data-module="contagem"/);
assert.doesNotMatch(matrix,/data-mode=/);

const store=storeLayout({...state,area:"loja",storeId:"teste",moduleId:"dashboard"},"<p>Conteúdo da Loja</p>");
assert.match(store,/loja-shell/);
assert.match(store,/data-module="contagem"/);
assert.match(store,/data-module="notas"/);
assert.doesNotMatch(store,/data-module="usuarios"/);
assert.doesNotMatch(store,/data-mode=/);
assert.match(store,/id="store"/);

const picker=renderStoreChoice(stores);
assert.match(picker,/data-choose-store="teste"/);
assert.doesNotMatch(picker,/data-choose-store="matriz"/);
assert.doesNotMatch(picker,/Novo cadastro|Cadastrar loja/);

const login=accessBody({...state,session:null},"Conteúdo protegido");
assert.match(login,/id="login-form"/);
assert.doesNotMatch(login,/Conteúdo protegido/);
const denied=accessBody({...state,matrixAuthorized:false},"Conteúdo protegido");
assert.match(denied,/Acesso negado/);
assert.doesNotMatch(denied,/Conteúdo protegido/);

assert.equal(models.lojas,undefined,"A criação e edição de unidades devem estar removidas.");
assert.equal(featureByModule.contagem,"counts");
assert.equal(featureByModule.notas,"notes");
const lockedStore=storeLayout({...state,area:"loja",storeId:"teste",moduleId:"contagem",features:{}},"Conteúdo");
assert.match(lockedStore,/Aguardando liberação/);
assert.equal(lojas.readOnly,true);
const storesList=renderList(lojas,stores,"live",false);
assert.doesNotMatch(storesList,/data-new-record|data-edit-record/);
assert.equal(matrixIds.has("contagem"),false);
assert.equal(storeIds.has("lojas"),false);
const srcMain=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
assert.doesNotMatch(srcMain,/state\.mode\s*=\s*["']demo["']|data-mode|demo-data\.js|core\/store\.js/);
console.log("OK: Supabase exclusivo, seleção Teste, isolamento visual, autenticação e lojas somente leitura.");
