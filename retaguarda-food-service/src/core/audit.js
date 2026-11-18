// Log de alterações (tabela audit_events). Registros não podem ser apagados pelo app.
import {supabase} from "./supabase.js";

let currentUser=null;
export function setAuditUser(id){currentUser=id}

// Tabelas cujas gravações entram no log automaticamente (linhas de documento ficam de fora).
export const TRACKED={
 items:"Item",suppliers:"Fornecedor",store_item_suppliers:"Vínculo de fornecedor",purchase_lists:"Lista",
 stock_counts:"Contagem",purchase_orders:"Pedido de compra",invoices:"Nota fiscal",invoice_payments:"Parcela",
 losses:"Perda",transfers:"Transferência",cmv_closings:"Fechamento de CMV",user_access:"Acessos de usuário"
};
const NAME_KEYS=["name","number","display_id","invoice_number","reason","code"];

export async function logEvent({action,entity_type,entity_id=null,store_id=null,details={}}){
 if(!currentUser)return;
 const {error}=await supabase.from("audit_events").insert({user_id:currentUser,action,entity_type,entity_id,store_id:store_id||"matriz",details});
 if(error)console.warn("Log de alterações não gravado:",error.message);
}
function storeOf(row){return row?.store_id||row?.from_store_id||"matriz"}
function nameOf(row){for(const k of NAME_KEYS)if(row?.[k])return String(row[k]);return ""}

/** Chamado pelo acesso a dados após inserir/alterar/excluir. Não interrompe a operação se falhar. */
export function trackWrite(op,table,row,patch){
 if(!TRACKED[table]||!row?.id)return;
 const details={registro:nameOf(row)};
 if(op==="update"){
  details.campos=Object.keys(patch||{}).filter(k=>!/_at$|_by$/.test(k));
  if(patch?.status)details.status=patch.status;
 }
 logEvent({action:op,entity_type:table,entity_id:row.id,store_id:storeOf(row),details}).catch(()=>{});
}
