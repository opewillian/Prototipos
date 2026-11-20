// Editor de linhas de documento (nota, perda, transferência): item, quantidade, custo e total.
// Grava cada alteração imediatamente; quantidade precisa ser > 0.
import {insert,update,remove} from "../../core/db.js";
import {e,money,num,inputNum,parseNum,round2} from "../../core/format.js";
import {icon} from "../../core/icons.js";
import {btn,field,toast,errorMessage,emptyState} from "../../core/ui.js";
import {lineTotal} from "./catalog.js";

/**
 * cfg: {el, table, parentKey, parentId, extra (campos fixos da linha), lines, items(Map), editable,
 *       costFor(itemId)->{cost,source}, balances(Map opcional), onChange(lines), emptyText,
 *       fixedCost (true: custo vem só de costFor — última compra da loja ou custo padrão — e não é digitado)}
 */
export function mountLines(cfg){
 let lines=cfg.lines.slice();
 const items=cfg.items;
 const total=()=>round2(lines.reduce((s,l)=>s+Number(l.line_total||0),0));
 const options=()=>[...items.values()].filter(i=>i.active!==false).map(i=>'<option value="'+e(i.name+(i.code?" · "+i.code:""))+'">').join("");
 const draw=()=>{
  const dl="dl-"+cfg.table;
  let html=cfg.editable?'<div class="add-row">'+
   field("Item",'<input class="control" data-new-item list="'+dl+'" placeholder="Nome ou código do item" autocomplete="off"><datalist id="'+dl+'">'+options()+'</datalist>')+
   '<label class="field narrow"><span class="field-label">Quantidade</span><input class="control" data-new-qty inputmode="decimal" placeholder="0"></label>'+
   (cfg.fixedCost?'':'<label class="field narrow"><span class="field-label">Custo unitário</span><input class="control" data-new-cost inputmode="decimal" placeholder="0,00"></label>')+
   btn("Adicionar",{icon:"plus",attrs:"data-add-line"})+'</div>':'';
  if(!lines.length)html+=emptyState("box",cfg.emptyText||"Nenhum item lançado",cfg.editable?"Adicione os itens pelo campo acima.":"");
  else{
   html+='<div class="table-wrap"><table class="table stack"><thead><tr><th>Item</th><th>Unid.</th>'+(cfg.balances?'<th class="num">Em estoque</th>':'')+'<th class="num">Quantidade</th><th class="num">Custo unit.</th><th class="num">Total</th>'+(cfg.editable?'<th></th>':'')+'</tr></thead><tbody>'+
    lines.map(l=>{
     const it=items.get(l.item_id)||{name:"Item"};
     const bal=cfg.balances?cfg.balances.get(l.item_id)??0:null;
     return '<tr data-id="'+e(l.id)+'"><td data-label="Item"><span class="strong">'+e(it.name)+'</span><small class="sub">'+e(it.code||"")+'</small></td><td data-label="Unid.">'+e(it.base_unit||"")+'</td>'+
      (cfg.balances?'<td class="num" data-label="Em estoque">'+(bal<Number(l.quantity)?'<span class="text-warn">'+num(bal)+'</span>':num(bal))+'</td>':'')+
      (cfg.editable?'<td class="num" data-label="Quantidade"><input class="cell-input" data-qty inputmode="decimal" value="'+e(inputNum(l.quantity))+'"></td>'+(cfg.fixedCost?'<td class="num" data-label="Custo unit." title="'+e(cfg.costFor(l.item_id).source)+'">'+money(l.unit_cost)+'</td>':'<td class="num" data-label="Custo unit."><input class="cell-input" data-cost inputmode="decimal" value="'+e(inputNum(l.unit_cost,4))+'"></td>')
       :'<td class="num" data-label="Quantidade">'+num(l.quantity)+'</td><td class="num" data-label="Custo unit.">'+money(l.unit_cost)+'</td>')+
      '<td class="num" data-label="Total" data-total>'+money(l.line_total)+'</td>'+(cfg.editable?'<td class="act"><button class="icon-btn danger" data-del aria-label="Remover">'+icon("x",16)+'</button></td>':'')+'</tr>';
    }).join("")+'</tbody><tfoot><tr><td colspan="'+(cfg.balances?5:4)+'">Total ('+lines.length+' itens)</td><td class="num" data-grand>'+money(total())+'</td>'+(cfg.editable?'<td></td>':'')+'</tr></tfoot></table></div>';
  }
  cfg.el.innerHTML=html;bind();
 };
 const changed=()=>{cfg.onChange?.(lines);const g=cfg.el.querySelector("[data-grand]");if(g)g.textContent=money(total())};
 const findItem=v=>[...items.values()].find(i=>i.active!==false&&((i.name+(i.code?" · "+i.code:""))===v||(i.code&&i.code.toLowerCase()===v.toLowerCase())||i.name.toLowerCase()===v.toLowerCase()));
 const bind=()=>{
  if(!cfg.editable)return;
  const ni=cfg.el.querySelector("[data-new-item]"),nq=cfg.el.querySelector("[data-new-qty]"),nc=cfg.el.querySelector("[data-new-cost]");
  ni.addEventListener("change",()=>{const it=findItem(ni.value.trim());if(it&&nc&&!nc.value){nc.value=inputNum(cfg.costFor(it.id).cost,4)}if(it)nq.focus()});
  const add=async()=>{
   const it=findItem(ni.value.trim());if(!it)return toast("Escolha um item da lista.","danger");
   if(lines.some(l=>l.item_id===it.id))return toast("Este item já foi lançado; ajuste a quantidade na linha.","info");
   const q=parseNum(nq.value),c=cfg.fixedCost||!nc||nc.value===""?Number(cfg.costFor(it.id).cost||0):parseNum(nc.value);
   if(q===null||Number.isNaN(q)||q<=0)return toast("Informe uma quantidade maior que zero.","danger");
   if(c===null||Number.isNaN(c))return toast("Informe um custo válido.","danger");
   try{
    const s=await insert(cfg.table,{...cfg.extra,[cfg.parentKey]:cfg.parentId,item_id:it.id,quantity:q,unit_cost:c,line_total:lineTotal(q,c)});
    lines.push(s);changed();draw();cfg.el.querySelector("[data-new-item]")?.focus();
   }catch(error){toast(errorMessage(error),"danger")}
  };
  cfg.el.querySelector("[data-add-line]").onclick=add;
  [ni,nq,nc].filter(Boolean).forEach(x=>x.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();if(x===ni)nq.focus();else add()}}));
  cfg.el.querySelectorAll("tr[data-id] input").forEach(inp=>inp.addEventListener("change",async()=>{
   const tr=inp.closest("tr");const id=tr.dataset.id;
   const ci=tr.querySelector("[data-cost]");const q=parseNum(tr.querySelector("[data-qty]").value),c=ci?parseNum(ci.value):(cfg.fixedCost?Number(cfg.costFor(lines.find(l=>l.id===id)?.item_id).cost||0):null);
   if(q===null||Number.isNaN(q)||q<=0||c===null||Number.isNaN(c)){inp.classList.add("is-invalid");return toast("Quantidade deve ser maior que zero e custo não negativo.","danger")}
   inp.classList.remove("is-invalid");
   try{const s=await update(cfg.table,id,{quantity:q,unit_cost:c,line_total:lineTotal(q,c)});lines=lines.map(l=>l.id===id?s:l);tr.querySelector("[data-total]").textContent=money(s.line_total);changed()}
   catch(error){toast(errorMessage(error),"danger")}
  }));
  cfg.el.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
   const id=b.closest("tr").dataset.id;
   try{await remove(cfg.table,id);lines=lines.filter(l=>l.id!==id);changed();draw()}catch(error){toast(errorMessage(error),"danger")}
  });
 };
 draw();
 return {get lines(){return lines},total,redraw:draw,
  async addMany(rows){const ins=[];for(const r of rows){if(lines.some(l=>l.item_id===r.item_id))continue;ins.push(await insert(cfg.table,{...cfg.extra,[cfg.parentKey]:cfg.parentId,...r}))}lines=lines.concat(ins);changed();draw();return ins.length}};
}
