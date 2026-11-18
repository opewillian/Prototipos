// Testes de regras de negócio dos formulários (sem rede nem Supabase).
import assert from "node:assert/strict";
import {models,normalize} from "../src/core/models.js";
import {renderEditor} from "../src/components/editor.js";

// Simula um <form> com campos de texto/número/checkbox.
function fakeForm(values){
 return {elements:{namedItem:key=>key in values?(typeof values[key]==="boolean"?{checked:values[key],value:""}:{value:String(values[key])}):null}};
}
const ctx={storeId:"teste",userId:"u1",child:true,parentId:"doc-1"};

// Contagem: zero é válido; vazio não é convertido em zero; decimais aceitos.
const zero=normalize(models.contagem,fakeForm({item_id:"i1",counted_quantity:"0",unit_cost:"2.5"}),{id:"doc-1"},ctx);
assert.equal(zero.counted_quantity,0);
assert.equal(zero.line_total,0);
assert.throws(()=>normalize(models.contagem,fakeForm({item_id:"i1",counted_quantity:"",unit_cost:"2.5"}),{id:"doc-1"},ctx),/Preencha: Quantidade contada/);
const dec=normalize(models.contagem,fakeForm({item_id:"i1",counted_quantity:"1,25",unit_cost:"4"}),{id:"doc-1"},ctx);
assert.equal(dec.counted_quantity,1.25);
assert.equal(dec.line_total,5);
assert.equal(dec.store_id,"teste");
assert.throws(()=>normalize(models.contagem,fakeForm({item_id:"i1",counted_quantity:"-1",unit_cost:"4"}),{id:"doc-1"},ctx),/não negativo/);

// Pedido: total usa a quantidade SOLICITADA, não a contada.
const order=normalize(models.compras,fakeForm({item_id:"i1",counted_quantity:"10",requested_quantity:"3",unit_cost:"2"}),{id:"doc-1"},ctx);
assert.equal(order.line_total,6);

// Nota/perda/transferência exigem quantidade > 0.
assert.throws(()=>normalize(models.notas,fakeForm({item_id:"i1",quantity:"0",unit_cost:"1"}),{id:"doc-1"},ctx),/maior que zero/);

// Edição de transferência pela loja destino não troca a origem.
const tr=normalize(models.transferencias,fakeForm({number:"T1",to_store_id:"teste",observation:""}),{id:"t1",from_store_id:"outra",status:"draft"},{storeId:"teste"});
assert.equal(tr.from_store_id,"outra");
assert.throws(()=>normalize(models.transferencias,fakeForm({number:"T1",to_store_id:"teste",observation:""}),{},{storeId:"teste"}),/diferente da origem/);

// Documento operacional nunca pertence à Matriz.
assert.throws(()=>normalize(models.contagem,fakeForm({display_id:"C1",count_date:"2026-11-18",notes:""}),{},{storeId:"matriz"}),/unidade operacional/);
const novo=normalize(models.contagem,fakeForm({display_id:"C1",count_date:"2026-11-18",notes:""}),{},{storeId:"teste",userId:"u1"});
assert.equal(novo.status,"draft");
assert.equal(novo.created_by,"u1");

// Nota: entrada não antecede emissão.
assert.throws(()=>normalize(models.notas,fakeForm({invoice_number:"1",supplier_id:"",issue_date:"2026-11-10",entry_date:"2026-11-09",access_key:"",notes:""}),{},{storeId:"teste"}),/antecede/);

// Checkboxes têm rótulo visível; itens inativos não são oferecidos em novas linhas.
for(const f of Object.values(models).flatMap(m=>m.fields.concat(m.line?.fields||[])))assert.ok(f.label,"Campo sem rótulo: "+f.key);
const html=renderEditor({moduleId:"contagem",editor:{record:{id:"c1",status:"draft"},lineEditor:true},lines:[],
 lookups:{items:[{id:"a",name:"Ativo X",active:true},{id:"b",name:"Inativo Y",active:false}]}});
assert.match(html,/Ativo X/);
assert.doesNotMatch(html,/Inativo Y/);

// ---- Contagem: linhas carregadas de listas ----
import("../src/modules/contagem/lines.js").then(({parseQty,fmtQty,lineTotal,costFor,mergePending,countSummary,renderCountLines})=>{
 assert.equal(parseQty(""),null,"vazio = não contado");
 assert.equal(parseQty("  "),null);
 assert.equal(parseQty("0"),0,"zero é contagem válida");
 assert.equal(parseQty("1,25"),1.25);
 assert.equal(parseQty("2.5"),2.5);
 assert.ok(Number.isNaN(parseQty("-1")));
 assert.ok(Number.isNaN(parseQty("abc")));
 assert.ok(Number.isNaN(parseQty("1.000,50")),"separador de milhar não é aceito");
 assert.equal(fmtQty(2.5),"2,5");
 assert.equal(fmtQty(1000),"1000");
 assert.equal(fmtQty(null),"");
 assert.equal(lineTotal(2.5,8.9),22.25);

 const lines=[{id:"l1",item_id:"a",counted_quantity:0,unit_cost:5,line_total:0},{id:"l2",item_id:"b",counted_quantity:2,unit_cost:3,line_total:6}];
 const m=mergePending(lines,[{item_id:"c"}],["a","c","d","d","e"]);
 assert.deepEqual(m.pending.map(p=>p.item_id),["c","d","e"],"merge não duplica itens gravados, pendentes nem repetidos na lista");
 assert.equal(m.added,2);assert.equal(m.skipped,3);

 const lookups={items:[{id:"a",name:"A",default_unit_cost:4},{id:"b",name:"B",default_unit_cost:9}],
  store_last_purchase_cost:[{store_id:"teste",item_id:"b",unit_cost:7.5}]};
 assert.deepEqual(costFor("b",lookups),{cost:7.5,source:"Última compra da loja"});
 assert.deepEqual(costFor("a",lookups),{cost:4,source:"Custo padrão do cadastro"});

 assert.deepEqual(countSummary(lines,[{item_id:"c"}]),{counted:2,pending:1,total:6});

 const st={lookups,lines,editor:{pending:[{item_id:"a2"}]}};
 const open=renderCountLines(st,false);
 assert.match(open,/data-qty/);assert.match(open,/placeholder="Não contado"/);assert.match(open,/data-load-list/);
 const locked=renderCountLines(st,true);
 assert.doesNotMatch(locked,/<input|data-load-list|data-remove-row/,"contagem finalizada não oferece edição");
 console.log("OK: contagem — vazio x zero, decimais, merge de listas, custo sugerido, resumo e bloqueio.");
}).catch(error=>{console.error(error);process.exit(1)});

console.log("OK: regras de quantidade, totais, loja do documento, datas e rótulos.");
