import assert from "node:assert/strict";
import {renderAreaChoice,renderStoreChoice} from "../src/areas/selection.js";
import {matrixModules,matrixIds} from "../src/areas/matriz/config.js";
import {storeModules,storeIds} from "../src/areas/loja/config.js";
import {matrixLayout} from "../src/areas/matriz/layout.js";
import {storeLayout} from "../src/areas/loja/layout.js";
import {accessBody} from "../src/areas/shared.js";

const stores=[
 {id:"matriz",name:"Matriz",code:"MTZ",store_type:"matrix"},
 {id:"loja-1",name:"Loja Exemplo",code:"001",store_type:"operational"}
];
const state={area:"matriz",mode:"demo",session:null,stores,storeId:"",moduleId:"inicio-matriz",error:"",loading:false,matrixAuthorized:true};

const choice=renderAreaChoice();
assert.match(choice,/data-area="matriz"/,"Seleção da Matriz deve existir");
assert.match(choice,/data-area="loja"/,"Seleção de Loja deve existir");
assert.ok(!choice.includes("input type=\"password\""),"Seleção de ambiente não pede credenciais");

assert.ok(matrixModules.length>=5);
assert.ok(storeModules.length>=5);
assert.equal(new Set(matrixModules.map(m=>m.id)).size,matrixModules.length);
assert.equal(new Set(storeModules.map(m=>m.id)).size,storeModules.length);
for(const key of matrixIds)assert.equal(storeIds.has(key),false,"Os módulos devem ter menus independentes");

const matrix=matrixLayout(state,"<p>Conteúdo da Matriz</p>");
assert.match(matrix,/mat-shell/);
assert.match(matrix,/data-module="lojas"/);
assert.match(matrix,/data-module="usuarios"/);
assert.match(matrix,/data-module="pedidos-matriz"/);
assert.doesNotMatch(matrix,/data-module="contagem"/);
assert.doesNotMatch(matrix,/data-module="cmv"/);
assert.doesNotMatch(matrix,/id="store"/,"Matriz não seleciona unidade operacional");

const loja=storeLayout({...state,area:"loja",storeId:"loja-1",moduleId:"dashboard"},"<p>Conteúdo Loja</p>");
assert.match(loja,/loja-shell/);
assert.match(loja,/data-module="contagem"/);
assert.match(loja,/data-module="notas"/);
assert.match(loja,/data-module="cmv"/);
assert.doesNotMatch(loja,/data-module="usuarios"/);
assert.doesNotMatch(loja,/data-module="lojas"/);
assert.match(loja,/id="store"/);

const picker=renderStoreChoice(stores);
assert.match(picker,/data-choose-store="loja-1"/);
assert.doesNotMatch(picker,/data-choose-store="matriz"/);

const login=accessBody({...state,mode:"live",session:null},"Conteúdo protegido");
assert.match(login,/id="login-form"/);
assert.doesNotMatch(login,/Conteúdo protegido/);

const denied=accessBody({...state,mode:"live",session:{user:{id:"exemplo"}},matrixAuthorized:false},"Conteúdo protegido");
assert.match(denied,/Acesso não autorizado/);
assert.doesNotMatch(denied,/Conteúdo protegido/);

console.log("OK: seleção, menus independentes, filtro de lojas e proteção visual por autenticação.");
