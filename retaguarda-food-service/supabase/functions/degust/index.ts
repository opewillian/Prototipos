// Integração Linx Degust One (API de Integrações Externa). Roda no servidor do Supabase (Edge Function "degust").
// Segredos (Edge Functions → Secrets): DEGUST_USUARIO, DEGUST_SENHA, DEGUST_FRANQUEADOR. A senha nunca vai ao navegador.
// O token da Linx (4 h) fica em public.integration_tokens (provider "degust") para ser reaproveitado.
// Quem pode chamar:
//   • administrador da Matriz (JWT do app) → ações "lojas", "vendas", "importar";
//   • o agendamento diário (pg_cron, cabeçalho x-cron-key = integration_tokens "cron") → só a ação "diario".
// Ações (POST JSON {acao, ...}):
//   "lojas"    → lista as lojas da franquia no Degust (código, nome, CNPJ, cidade).
//   "vendas"   → relatório de vendas de uma loja num período (máx. 30 dias): {codLoja, dataInicial, dataFinal, resumo?}
//   "importar" → grava UM dia de caixa da loja nas tabelas sales/sale_items/sale_payments: {storeId, data}
//   "diario"   → para cada loja com código do Degust, reimporta os últimos 3 dias (ontem e os 2 anteriores).
//   "bq_setup" → cria no BigQuery o conjunto "retaguarda" (São Paulo) e as tabelas sales / sale_items / sale_payments.
//   "bq_sync"  → copia UM dia de uma loja do Supabase para o BigQuery (apaga o dia lá e grava de novo): {storeId, data}
//   "r2_list"  → lista os arquivos guardados no R2 (prefixo opcional) com o tamanho total: {prefixo?}
// ARQUIVO (Cloudflare R2): toda importação ("importar"/"diario") grava o detalhe do dia, como veio da Linx
// (sem CPF/CNPJ do consumidor), em vendas/loja=<id>/ano=<AAAA>/mes=<MM>/<AAAA-MM-DD>.json.gz no bucket R2_BUCKET.
// Segredos: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// BigQuery (desligado; só roda com o segredo BQ_ENABLED=1): GCP_PROJECT_ID e GCP_SA_KEY. Ficou bloqueado por falta de
// faturamento no Google (conta de faturamento fechada / pré-pagamento) — trocado pelo R2 em 23/11/2026.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = "https://lx-degust-api-integracao-prd.azurewebsites.net";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const franqueador = () => Number(Deno.env.get("DEGUST_FRANQUEADOR"));

// Token da Linx: reaproveita o guardado enquanto faltar mais de 10 min para vencer.
async function token(force = false): Promise<string> {
  if (!force) {
    const { data } = await admin.from("integration_tokens").select("token,expires_at").eq("provider", "degust").maybeSingle();
    if (data && new Date(data.expires_at).getTime() - Date.now() > 10 * 60 * 1000) return data.token;
  }
  const r = await fetch(BASE + "/api/usuario/autenticar?api-version=1.0", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: Deno.env.get("DEGUST_USUARIO"),
      senha: Deno.env.get("DEGUST_SENHA"),
      codigoFranqueador: franqueador(),
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Login na Linx recusado (" + r.status + ").");
  let tk = txt.trim();
  try {
    const j = JSON.parse(txt);
    tk = typeof j === "string" ? j : (j.acesso?.token ?? j.token ?? j.Token ?? j.accessToken ?? j.access_token ?? j.data?.token ?? "");
  } catch { /* resposta em texto puro */ }
  tk = String(tk).replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  // Nunca devolve o texto da resposta: ele pode conter o token.
  if (!tk) throw new Error("A Linx não devolveu o token (formato de resposta inesperado).");
  await admin.from("integration_tokens").upsert({
    provider: "degust", token: tk, expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), updated_at: new Date().toISOString(),
  });
  return tk;
}

async function linx(method: string, path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api-version", "1.0");
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) url.searchParams.set(k, String(v));
  const call = async (tk: string) =>
    fetch(url, {
      method,
      headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  let r = await call(await token());
  if (r.status === 401) r = await call(await token(true)); // token vencido do lado da Linx
  const txt = await r.text();
  if (!r.ok) throw new Error("Linx " + path + " (" + r.status + "): " + txt.slice(0, 300).replace(/eyJ[\w.-]+/g, "[token]"));
  try { return JSON.parse(txt); } catch { return txt; }
}

const n = (v: unknown) => Number(String(v ?? 0).replace(",", ".")) || 0;
const yes = (v: unknown) => String(v ?? "").trim().toUpperCase() === "S";

// Importa UM dia de caixa de uma loja: apaga o que havia do dia e grava de novo (pega cancelamentos tardios).
async function importDay(storeId: string, degustCode: number, dia: string, userId: string | null) {
  const r = await linx("POST", "/api/venda/relatorio-vendas", {
    body: { dataInicial: dia, dataFinal: dia, codFranqueador: franqueador(), codLoja: degustCode, exibirVendasCanceladas: true, tipoData: "C" },
  });
  const vendas: Record<string, any>[] = Array.isArray(r) ? r : [];
  const byCtl = new Map<number, Record<string, any>>();   // mesmo controle repetido no dia: fica o último
  for (const v of vendas) byCtl.set(Number(v.controle), v);
  const lista = [...byCtl.values()];
  const del = await admin.from("sales").delete().eq("store_id", storeId).eq("business_date", dia);
  if (del.error) throw new Error("Apagar dia: " + del.error.message);
  let gravadas = 0, itens = 0, pagtos = 0;
  for (let i = 0; i < lista.length; i += 200) {
    const lote = lista.slice(i, i + 200);
    const rows = lote.map((v) => {
      const doc = (v.documento ?? [])[0] ?? {};
      return {
        store_id: storeId, business_date: dia, control: Number(v.controle), sale_date: v.dataVenda ?? null, created_raw: v.dataHoraInclusao ?? null,
        pdv: v.numPdv ?? null, opening: v.numAbertura ?? null, sale_type: v.tipoVenda ?? null, cancelled: yes(v.cancelada),
        gross: n(v.valProduto), discount: n(v.valDesconto), item_discount: n(v.valDescontoItem), surcharge: n(v.valAcrescimo),
        net: n(v.valLiquido), change_amount: n(v.valTroco), has_customer_doc: yes(v.possuiCpfCnpj),
        doc_model: doc.modelo ?? null, doc_number: doc.numero ?? null, doc_key: doc.chave ?? null, doc_status: doc.situacaoSefaz ?? null,
      };
    });
    const ins = await admin.from("sales").insert(rows).select("id,control");
    if (ins.error) throw new Error("Gravar vendas: " + ins.error.message);
    const idOf = new Map((ins.data ?? []).map((x: { id: string; control: number }) => [Number(x.control), x.id]));
    gravadas += ins.data?.length ?? 0;
    const its: Record<string, unknown>[] = [], pgs: Record<string, unknown>[] = [];
    for (const v of lote) {
      const sid = idOf.get(Number(v.controle));
      if (!sid) continue;
      for (const it of v.itens ?? []) its.push({
        sale_id: sid, store_id: storeId, business_date: dia, line: it.numLancto ?? null, main_line: it.numLanctoItemPrincipal ?? null,
        product_code: it.codProduto ?? null, product_name: it.descricaoProduto ?? null, unit: it.unidadeProduto ?? null,
        quantity: n(it.quantidade), unit_price: n(it.valUnitario), total: n(it.valTotal), discount: n(it.valDesconto),
        cancelled: yes(it.cancelado), stock_item_code: it.fiscal?.codItemEstoque ?? null,
      });
      for (const pg of v.formaPagamento ?? []) pgs.push({
        sale_id: sid, store_id: storeId, business_date: dia, seq: pg.sequencia ?? null, method: pg.formaPgto ?? null,
        method_code: pg.codFormaPagamento ?? null, brand: pg.bandeira ?? null, amount: n(pg.valor), installments: pg.tefQtdeParcela ?? null,
      });
    }
    for (let k = 0; k < its.length; k += 500) {
      const e = await admin.from("sale_items").insert(its.slice(k, k + 500));
      if (e.error) throw new Error("Gravar itens: " + e.error.message);
    }
    for (let k = 0; k < pgs.length; k += 500) {
      const e = await admin.from("sale_payments").insert(pgs.slice(k, k + 500));
      if (e.error) throw new Error("Gravar pagamentos: " + e.error.message);
    }
    itens += its.length; pagtos += pgs.length;
  }
  const ok = lista.filter((v) => !yes(v.cancelada));
  const liquido = Math.round(ok.reduce((s, v) => s + n(v.valLiquido), 0) * 100) / 100;
  await admin.from("sales_imports").upsert({
    store_id: storeId, business_date: dia, sales: ok.length, cancelled: lista.length - ok.length, net: liquido,
    imported_at: new Date().toISOString(), imported_by: userId,
  });
  // Arquivo no R2 com o detalhe completo do dia (se falhar, a importação no Supabase continua valendo; o erro volta no resultado).
  let arquivo: unknown = null;
  if (Deno.env.get("R2_BUCKET")) {
    try { arquivo = await r2PutDay(storeId, degustCode, dia, lista); } catch (e) { arquivo = { erro: String((e as Error).message ?? e) }; }
  }
  let bigquery: unknown = null;
  if (Deno.env.get("BQ_ENABLED") === "1" && gcpProject()) { try { bigquery = await bqSyncDay(storeId, dia); } catch (e) { bigquery = { erro: String((e as Error).message ?? e) }; } }
  return { data: dia, vendas: ok.length, canceladas: lista.length - ok.length, liquido, gravadas, itens, pagamentos: pagtos, arquivo, bigquery };
}

// ---------------------------------------------------------------- Cloudflare R2 (API compatível com S3, assinatura AWS SigV4)
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (d: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof d === "string" ? enc.encode(d) : d));
const hmac = async (key: ArrayBuffer | Uint8Array, msg: string) =>
  crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(msg));
const uriEnc = (s: string, slash = false) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()).replace(slash ? /%2F/g : /$^/, "/");
async function r2(method: string, key: string, query: Record<string, string> = {}, body?: Uint8Array, contentType?: string) {
  const acct = Deno.env.get("R2_ACCOUNT_ID") ?? "", bucket = Deno.env.get("R2_BUCKET") ?? "";
  const akid = Deno.env.get("R2_ACCESS_KEY_ID") ?? "", secret = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
  if (!acct || !bucket || !akid || !secret) throw new Error("Segredos do R2 incompletos.");
  const host = acct + ".r2.cloudflarestorage.com";
  const path = "/" + bucket + (key ? "/" + uriEnc(key, true) : "");
  const qs = Object.keys(query).sort().map((k) => uriEnc(k) + "=" + uriEnc(query[k])).join("&");
  const now = new Date(), amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), day = amzDate.slice(0, 8);
  const payloadHash = await sha256(body ?? new Uint8Array());
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, path, qs, names.map((n) => n + ":" + headers[n]).join("\n") + "\n", names.join(";"), payloadHash].join("\n");
  const scope = day + "/auto/s3/aws4_request";
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  let k: ArrayBuffer = await hmac(enc.encode("AWS4" + secret), day);
  for (const part of ["auto", "s3", "aws4_request"]) k = await hmac(k, part);
  const sig = hex(await hmac(k, toSign));
  const { host: _h, ...send } = headers;
  const r = await fetch("https://" + host + path + (qs ? "?" + qs : ""), {
    method, body, headers: { ...send, Authorization: "AWS4-HMAC-SHA256 Credential=" + akid + "/" + scope + ", SignedHeaders=" + names.join(";") + ", Signature=" + sig },
  });
  const text = await r.text();
  if (!r.ok) throw new Error("R2 " + method + " (" + r.status + "): " + text.slice(0, 300));
  return text;
}
async function gzip(s: string) {
  const cs = new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
// Guarda o dia inteiro como veio da Linx (sem documento do consumidor). Regravar o mesmo dia substitui o arquivo.
async function r2PutDay(storeId: string, degustCode: number, dia: string, vendas: Record<string, any>[]) {
  const clean = vendas.map(({ docConsumidor: _a, docConsumidorDesconto: _b, ...v }) => v);
  const doc = JSON.stringify({ loja: storeId, codLojaDegust: degustCode, data: dia, geradoEm: new Date().toISOString(), vendas: clean });
  const body = await gzip(doc);
  const key = "vendas/loja=" + storeId + "/ano=" + dia.slice(0, 4) + "/mes=" + dia.slice(5, 7) + "/" + dia + ".json.gz";
  await r2("PUT", key, {}, body, "application/gzip");
  return { arquivo: key, bytes: body.length, bytesSemCompactar: enc.encode(doc).length };
}
async function r2List(prefix = "") {
  const files: { key: string; size: number }[] = [];
  let token = "";
  for (let i = 0; i < 50; i++) {
    const q: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
    if (prefix) q.prefix = prefix; if (token) q["continuation-token"] = token;
    const xml = await r2("GET", "", q);
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      files.push({ key: (m[1].match(/<Key>(.*?)<\/Key>/) ?? [])[1] ?? "", size: Number((m[1].match(/<Size>(\d+)<\/Size>/) ?? [])[1] ?? 0) });
    }
    token = (xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/) ?? [])[1] ?? "";
    if (!token) break;
  }
  return { arquivos: files.length, bytes: files.reduce((s, f) => s + f.size, 0), primeiros: files.slice(0, 3), ultimos: files.slice(-3) };
}

// ---------------------------------------------------------------- BigQuery
const BQ_DATASET = "retaguarda", BQ_LOCATION = "southamerica-east1";
const gcpProject = () => Deno.env.get("GCP_PROJECT_ID") ?? "";
const b64url = (b: ArrayBuffer | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
// Token do Google pela conta de serviço (JWT assinado com a chave privada). Reaproveita enquanto faltar > 5 min.
async function googleToken(): Promise<string> {
  const { data } = await admin.from("integration_tokens").select("token,expires_at").eq("provider", "google").maybeSingle();
  if (data && new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return data.token;
  const sa = JSON.parse(Deno.env.get("GCP_SA_KEY") ?? "{}");
  if (!sa.client_email || !sa.private_key) throw new Error("Segredo GCP_SA_KEY ausente ou inválido.");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/bigquery", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const der = Uint8Array.from(atob(String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + b64url(sig),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Login no Google recusado (" + r.status + "): " + (j.error_description || j.error || ""));
  await admin.from("integration_tokens").upsert({ provider: "google", token: j.access_token, expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString(), updated_at: new Date().toISOString() });
  return j.access_token;
}
async function bq(method: string, path: string, body?: unknown) {
  const r = await fetch("https://bigquery.googleapis.com/bigquery/v2/projects/" + gcpProject() + path, {
    method, headers: { Authorization: "Bearer " + (await googleToken()), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  return { ok: r.ok, status: r.status, j };
}
const F = (name: string, type: string, mode = "NULLABLE") => ({ name, type, mode });
const BQ_TABLES: Record<string, ReturnType<typeof F>[]> = {
  sales: [F("store_id", "STRING", "REQUIRED"), F("business_date", "DATE", "REQUIRED"), F("control", "INT64", "REQUIRED"), F("sale_date", "STRING"), F("created_raw", "STRING"),
    F("pdv", "STRING"), F("opening", "STRING"), F("sale_type", "STRING"), F("cancelled", "BOOL"), F("gross", "NUMERIC"), F("discount", "NUMERIC"), F("item_discount", "NUMERIC"),
    F("surcharge", "NUMERIC"), F("net", "NUMERIC"), F("change_amount", "NUMERIC"), F("has_customer_doc", "BOOL"), F("doc_model", "STRING"), F("doc_number", "INT64"),
    F("doc_key", "STRING"), F("doc_status", "STRING"), F("imported_at", "TIMESTAMP")],
  sale_items: [F("store_id", "STRING", "REQUIRED"), F("business_date", "DATE", "REQUIRED"), F("control", "INT64", "REQUIRED"), F("line", "INT64"), F("main_line", "INT64"),
    F("product_code", "INT64"), F("product_name", "STRING"), F("unit", "STRING"), F("quantity", "NUMERIC"), F("unit_price", "NUMERIC"), F("total", "NUMERIC"),
    F("discount", "NUMERIC"), F("cancelled", "BOOL"), F("stock_item_code", "INT64")],
  sale_payments: [F("store_id", "STRING", "REQUIRED"), F("business_date", "DATE", "REQUIRED"), F("control", "INT64", "REQUIRED"), F("seq", "STRING"), F("method", "STRING"),
    F("method_code", "STRING"), F("brand", "STRING"), F("amount", "NUMERIC"), F("installments", "INT64")],
};
async function bqSetup() {
  const out: Record<string, number> = {};
  const ds = await bq("POST", "/datasets", { datasetReference: { projectId: gcpProject(), datasetId: BQ_DATASET }, location: BQ_LOCATION, description: "Retaguarda MFT — vendas do Degust" });
  if (!ds.ok && ds.status !== 409) throw new Error("Criar conjunto no BigQuery (" + ds.status + "): " + JSON.stringify(ds.j.error?.message ?? ds.j).slice(0, 300));
  out.dataset = ds.status;
  for (const [t, fields] of Object.entries(BQ_TABLES)) {
    const r = await bq("POST", "/datasets/" + BQ_DATASET + "/tables", {
      tableReference: { projectId: gcpProject(), datasetId: BQ_DATASET, tableId: t }, schema: { fields },
      timePartitioning: { type: "DAY", field: "business_date" }, clustering: { fields: ["store_id"] },
    });
    if (!r.ok && r.status !== 409) throw new Error("Criar tabela " + t + " (" + r.status + "): " + JSON.stringify(r.j.error?.message ?? r.j).slice(0, 300));
    out[t] = r.status;
  }
  return out;
}
async function bqWaitJob(jobId: string) {
  for (let i = 0; i < 60; i++) {
    const r = await bq("GET", "/jobs/" + jobId + "?location=" + BQ_LOCATION);
    if (!r.ok) throw new Error("Job BigQuery (" + r.status + ")");
    if (r.j.status?.state === "DONE") { if (r.j.status.errorResult) throw new Error("BigQuery: " + r.j.status.errorResult.message); return r.j; }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("BigQuery demorou demais.");
}
async function bqQuery(sql: string) {
  const r = await bq("POST", "/queries", { query: sql, useLegacySql: false, location: BQ_LOCATION, timeoutMs: 60000 });
  if (!r.ok) throw new Error("Consulta BigQuery (" + r.status + "): " + (r.j.error?.message ?? ""));
  if (!r.j.jobComplete) await bqWaitJob(r.j.jobReference.jobId);
  return r.j;
}
// Grava linhas por "load job" (gratuito) em NDJSON.
async function bqLoad(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const boundary = "bq" + crypto.randomUUID().replace(/-/g, "");
  const meta = { configuration: { load: { destinationTable: { projectId: gcpProject(), datasetId: BQ_DATASET, tableId: table }, sourceFormat: "NEWLINE_DELIMITED_JSON", writeDisposition: "WRITE_APPEND" } }, jobReference: { location: BQ_LOCATION } };
  const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) + "\r\n--" + boundary +
    "\r\nContent-Type: application/octet-stream\r\n\r\n" + rows.map((x) => JSON.stringify(x)).join("\n") + "\r\n--" + boundary + "--";
  const r = await fetch("https://bigquery.googleapis.com/upload/bigquery/v2/projects/" + gcpProject() + "/jobs?uploadType=multipart", {
    method: "POST", headers: { Authorization: "Bearer " + (await googleToken()), "Content-Type": "multipart/related; boundary=" + boundary }, body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Enviar " + table + " ao BigQuery (" + r.status + "): " + (j.error?.message ?? ""));
  await bqWaitJob(j.jobReference.jobId);
  return rows.length;
}
async function allRows(build: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  return out;
}
// Copia um dia de uma loja do Supabase para o BigQuery (apaga o dia lá e grava de novo).
async function bqSyncDay(storeId: string, dia: string) {
  if (!/^[a-z0-9-]+$/i.test(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("Loja ou data inválida.");
  const sales = await allRows((a, b) => admin.from("sales").select("id,store_id,business_date,control,sale_date,created_raw,pdv,opening,sale_type,cancelled,gross,discount,item_discount,surcharge,net,change_amount,has_customer_doc,doc_model,doc_number,doc_key,doc_status,imported_at").eq("store_id", storeId).eq("business_date", dia).order("id").range(a, b));
  const ctl = new Map(sales.map((s: any) => [s.id, s.control]));
  const items = await allRows((a, b) => admin.from("sale_items").select("sale_id,line,main_line,product_code,product_name,unit,quantity,unit_price,total,discount,cancelled,stock_item_code").eq("store_id", storeId).eq("business_date", dia).order("id").range(a, b));
  const pays = await allRows((a, b) => admin.from("sale_payments").select("sale_id,seq,method,method_code,brand,amount,installments").eq("store_id", storeId).eq("business_date", dia).order("id").range(a, b));
  const base = { store_id: storeId, business_date: dia };
  await bqQuery(["sales", "sale_items", "sale_payments"].map((t) => "DELETE FROM `" + BQ_DATASET + "." + t + "` WHERE store_id = '" + storeId + "' AND business_date = DATE '" + dia + "';").join("\n"));
  const n1 = await bqLoad("sales", sales.map(({ id: _id, ...s }: any) => s));
  const n2 = await bqLoad("sale_items", items.map(({ sale_id, ...x }: any) => ({ ...base, control: ctl.get(sale_id), ...x })));
  const n3 = await bqLoad("sale_payments", pays.map(({ sale_id, ...x }: any) => ({ ...base, control: ctl.get(sale_id), ...x })));
  return { vendas: n1, itens: n2, pagamentos: n3 };
}

// Data de hoje em São Paulo, menos N dias (AAAA-MM-DD).
function diaSP(menos: number) {
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  hoje.setDate(hoje.getDate() - menos);
  return hoje.toLocaleDateString("en-CA");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const p = await req.json().catch(() => ({}));

    // Agendamento diário: confere a chave guardada no banco e só aceita a ação "diario".
    const cronKey = req.headers.get("x-cron-key");
    if (cronKey) {
      const { data: k } = await admin.from("integration_tokens").select("token").eq("provider", "cron").maybeSingle();
      if (!k?.token || k.token !== cronKey) return json({ erro: "Chave do agendamento inválida." }, 401);
      if (p.acao !== "diario") return json({ erro: "O agendamento só pode rodar a ação diario." }, 400);
      const { data: lojas } = await admin.from("stores").select("id,degust_code").not("degust_code", "is", null).eq("active", true);
      const res: unknown[] = [];
      for (const st of lojas ?? []) for (const d of [3, 2, 1]) {
        try { res.push({ loja: st.id, ...(await importDay(st.id, st.degust_code, diaSP(d), null)) }); }
        catch (e) { res.push({ loja: st.id, data: diaSP(d), erro: String((e as Error).message ?? e) }); }
      }
      return json({ ok: true, resultado: res });
    }

    // Demais ações: precisa ser administrador da Matriz.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ erro: "Faça login." }, 401);
    const { data: m } = await admin.from("store_memberships").select("user_id")
      .eq("user_id", u.user.id).eq("store_id", "matriz").eq("role", "matrix_admin").eq("active", true).limit(1);
    if (!m?.length) return json({ erro: "Somente administradores da Matriz." }, 403);

    if (p.acao === "lojas") {
      const r = await linx("GET", "/api/loja/listarLojasFranquia", { query: { codigoFranquia: franqueador() } });
      const lojas = (Array.isArray(r) ? r : []).map((l: Record<string, unknown>) => ({
        codigoLoja: l.codigoLoja, nomeLoja: l.nomeLoja, razaoSocial: l.razaoSocial, cnpj: l.cnpj, cidade: l.cidade, uf: l.uf, tipo: l.tipo,
      }));
      return json({ ok: true, lojas });
    }
    if (p.acao === "vendas") {
      const r = await linx("POST", "/api/venda/relatorio-vendas", {
        body: {
          dataInicial: p.dataInicial, dataFinal: p.dataFinal, codFranqueador: franqueador(), codLoja: Number(p.codLoja),
          exibirVendasCanceladas: true, tipoData: "C",
        },
      });
      const vendas = Array.isArray(r) ? r : [];
      if (p.resumo) {
        const ok = vendas.filter((v: Record<string, unknown>) => !yes(v.cancelada));
        return json({
          ok: true, vendas: vendas.length, canceladas: vendas.length - ok.length,
          liquido: Math.round(ok.reduce((s: number, v: Record<string, unknown>) => s + n(v.valLiquido), 0) * 100) / 100,
          // Exemplo de uma venda para conferir o formato, sem documento do consumidor (CPF/CNPJ).
          exemplo: vendas[0] ? { ...vendas[0], docConsumidor: undefined, docConsumidorDesconto: undefined } : null,
        });
      }
      return json({ ok: true, vendas });
    }
    if (p.acao === "r2_list") return json({ ok: true, ...(await r2List(String(p.prefixo ?? ""))) });
    if (p.acao === "bq_setup") return json({ ok: true, ...(await bqSetup()) });
    if (p.acao === "bq_sync") {
      const dia = String(p.data ?? "");
      return json({ ok: true, data: dia, ...(await bqSyncDay(String(p.storeId ?? ""), dia)) });
    }
    if (p.acao === "importar") {
      const dia = String(p.data ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ erro: "Informe a data (AAAA-MM-DD)." }, 400);
      const { data: st } = await admin.from("stores").select("id,degust_code").eq("id", p.storeId).maybeSingle();
      if (!st?.degust_code) return json({ erro: "Loja sem código do Degust." }, 400);
      return json({ ok: true, ...(await importDay(st.id, st.degust_code, dia, u.user.id)) });
    }
    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message ?? e).replace(/eyJ[\w.-]+/g, "[token]") }, 500);
  }
});
