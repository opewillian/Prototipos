// Estorno de nota fiscal recebida (só administrador da Matriz).
// Chama public.reverse_invoice (docs/sql/27-estorno-de-nota.sql): tira do estoque a entrada da nota,
// guarda o histórico em invoice_reversals e devolve a nota para PENDENTE, para ser corrigida e receber de novo.
import {supabase} from "../../core/db.js";
import {e,money} from "../../core/format.js";
import {openDrawer,field,textarea,alertBox,toast,errorMessage} from "../../core/ui.js";

export const canReverse=app=>!!app?.isAdmin;

/** Abre o formulário de estorno. onDone(resultado) é chamado depois de estornar. */
export function reverseInvoiceDialog({inv,storeName="",supplierName="",onDone}){
 openDrawer({title:"Estornar nota nº "+inv.invoice_number,submitLabel:"Estornar nota",body:'<div class="form-grid">'+
  '<div class="span-2">'+alertBox("A entrada desta nota sai do estoque"+(storeName?" de "+storeName:"")+" e a nota volta para pendente, para ser corrigida e receber de novo. Fica registrado quem estornou, quando e o motivo.","warn")+'</div>'+
  '<p class="muted span-2" style="margin:0">'+e(supplierName||"")+(inv.total_amount!=null?' · '+money(inv.total_amount):'')+(inv.entry_date?' · entrada '+e(String(inv.entry_date).split("-").reverse().join("/")):'')+'</p>'+
  '<div class="span-2">'+field("Motivo do estorno",textarea("reason","",{rows:3,placeholder:"Ex.: quantidade lançada errada no item X; conversão errada; nota lançada na loja errada"}),"Obrigatório.")+'</div></div>',
  onSubmit:async form=>{
   const reason=form.elements.reason.value.trim();
   if(reason.length<3)throw Error("Informe o motivo do estorno.");
   const {data,error}=await supabase.rpc("reverse_invoice",{p_invoice_id:inv.id,p_reason:reason});
   if(error)throw Error(errorMessage(error));
   toast("Nota nº "+inv.invoice_number+" estornada: voltou para pendente.");
   if(onDone)await onDone(data);
  }});
}
