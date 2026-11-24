// Vendas da loja (Linx Degust) — guardadas SÓ no Cloudflare R2. As telas pedem o resumo à função "degust" (ação "resumo"),
// que confere se a pessoa vê Faturamento ou CMV da loja. Retorno (mesmos nomes das antigas funções do banco):
//   days:     [{business_date, sales, cancelled, gross, discount, net}]
//   products: [{product_code, product_name, quantity, total, discount, net}]
//   payments: [{method, brand, payments, amount}]
//   imported: ["AAAA-MM-DD", ...]  (dias que têm vendas importadas)
// Guarda em memória por alguns minutos para não repetir a mesma consulta ao trocar de tela.
import {supabase} from "../../core/db.js";

const cache=new Map();const TTL=5*60*1000;

/** opts.onlyDays: só o dia a dia (gráficos); produtos e pagamentos vêm vazios. */
export async function salesSummary(storeId,de,ate,opts={}){
 const k=storeId+"|"+de+"|"+ate+(opts.onlyDays?"|d":""),hit=cache.get(k);
 if(hit&&Date.now()-hit.t<TTL)return hit.v;
 const r=await supabase.functions.invoke("degust",{body:{acao:"resumo",storeId,de,ate,somenteDias:!!opts.onlyDays}});
 if(r.error){let msg=r.error.message;try{msg=JSON.parse(await r.error.context.text()).erro||msg}catch{}throw Error(msg)}
 const v={days:r.data.days||[],products:r.data.products||[],payments:r.data.payments||[],imported:r.data.imported||[]};
 cache.set(k,{t:Date.now(),v});return v;
}
/** Ranking de ticket médio das lojas da mesma marca (mês passado x este mês). {mesAnterior, mesAtual, ate, lojas:[{store_id,code,name,prev,cur,var,dias}]} */
export async function salesRanking(storeId){
 const k="rank|"+storeId,hit=cache.get(k);
 if(hit&&Date.now()-hit.t<TTL)return hit.v;
 const r=await supabase.functions.invoke("degust",{body:{acao:"ranking",storeId}});
 if(r.error){let msg=r.error.message;try{msg=JSON.parse(await r.error.context.text()).erro||msg}catch{}throw Error(msg)}
 cache.set(k,{t:Date.now(),v:r.data});return r.data;
}
/** Limpa o cache (ex.: depois de importar vendas). */
export function clearSalesCache(){cache.clear()}
