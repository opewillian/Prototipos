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

console.log("OK: regras de quantidade, totais, loja do documento, datas e rótulos.");
