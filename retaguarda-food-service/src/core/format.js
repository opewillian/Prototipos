// Formatação pt-BR e conversão de entradas numéricas.
export function escapeHtml(value){
 return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
export const e=escapeHtml;
const brl=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
export function money(value){return brl.format(Number(value||0))}
export function num(value,max=3){
 if(value===null||value===undefined||value==="")return "—";
 return new Intl.NumberFormat("pt-BR",{maximumFractionDigits:max}).format(Number(value));
}
/** Valor para campo de edição: vírgula decimal, sem separador de milhar. */
export function inputNum(value,max=3){
 if(value===null||value===undefined||value==="")return "";
 return new Intl.NumberFormat("pt-BR",{maximumFractionDigits:max,useGrouping:false}).format(Number(value));
}
/** "" → null (não informado); inválido ou negativo → NaN. Aceita vírgula ou ponto como decimal. */
export function parseNum(text){
 const t=String(text??"").trim().replace(/\s/g,"").replace(",",".");
 if(t==="")return null;
 if(!/^\d+(\.\d+)?$/.test(t))return NaN;
 return Number(t);
}
export function dateBR(value){
 if(!value)return "—";
 const d=String(value).slice(0,10).split("-");
 return d.length===3?d[2]+"/"+d[1]+"/"+d[0]:String(value);
}
export function dateTimeBR(value){
 if(!value)return "—";
 return new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
export function today(){return new Date().toLocaleDateString("en-CA")}
export function addDays(iso,days){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+days);return d.toLocaleDateString("en-CA")}
export function daysBetween(a,b){return Math.round((new Date(String(b).slice(0,10)+"T12:00:00")-new Date(String(a).slice(0,10)+"T12:00:00"))/86400000)}
export function round2(v){return Math.round(Number(v||0)*100)/100}
export function pct(v){return new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(Number(v||0))}
export function initials(name){return String(name||"?").trim().split(/\s+/).slice(0,2).map(p=>p[0]).join("").toUpperCase()}
export function normalizeText(v){return String(v||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}
export function displayValue(value,kind){
 if(value===null||value===undefined||value==="")return "—";
 if(kind==="money")return money(value);
 if(kind==="date")return dateBR(value);
 if(kind==="boolean")return value?"Sim":"Não";
 return String(value);
}
