import {supabase} from "./supabase.js";
export const featureByModule={contagem:"counts",listas:"lists",notas:"notes",compras:"orders",transferencias:"transfers",perdas:"losses",cmv:"cmv"};
export async function getStoreFeatures(storeId){
 if(!storeId)return {};
 const {data,error}=await supabase.from("store_feature_flags").select("feature_code,enabled").eq("store_id",storeId);
 if(error)throw error;
 return Object.fromEntries((data||[]).map(v=>[v.feature_code,v.enabled===true]));
}
export function canEditModule(area,moduleId,flags){
 if(area==="matriz")return moduleId==="matriz"||moduleId==="fornecedores";
 const key=featureByModule[moduleId];
 return Boolean(key&&flags?.[key]===true);
}
