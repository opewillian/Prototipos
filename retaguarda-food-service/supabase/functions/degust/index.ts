// Integração Linx Degust One → vendas guardadas SÓ no Cloudflare R2 (decisão do usuário em 23/11/2026).
// Roda no servidor do Supabase (Edge Function "degust"). As senhas nunca vão ao navegador.
//
// Onde ficam as vendas (bucket R2_BUCKET):
//   vendas/loja=<id>/ano=<AAAA>/mes=<MM>/<AAAA-MM-DD>.json.gz  → o dia completo como veio da Linx (sem CPF/CNPJ do consumidor)
//   resumo/loja=<id>/ano=<AAAA>/mes=<MM>/<AAAA-MM-DD>.json     → resumo do dia (totais, produtos, formas de pagamento)
//   resumo/loja=<id>/ano=<AAAA>/mes=<MM>/mes.json              → resumo do mês (dia a dia + produtos + pagamentos)
// Regras dos valores (iguais às da tela de Faturamento): vendas canceladas ficam fora dos valores;
//   bruto = valProduto + valDescontoItem; descontos = valDesconto + valDescontoItem; líquido = valLiquido;
//   produto: itens não cancelados, líquido = valTotal − valDesconto do item; pagamento: forma + bandeira.
// No Supabase fica só o registro de quais dias foram importados (sales_imports).
// Regra do usuário (23/11/2026): o arquivo completo (vendas/...json.gz) só é guardado a partir de DETALHE_DESDE;
// dias anteriores ficam só com os resumos.
//
// Segredos: DEGUST_USUARIO, DEGUST_SENHA, DEGUST_FRANQUEADOR, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// Tokens reaproveitados ficam em public.integration_tokens (Linx: 4 h, "não gerar toda hora").
//
// Quem pode chamar:
//   • agendamento diário (pg_cron, cabeçalho x-cron-key = integration_tokens "cron") → só "diario";
//   • quem vê Faturamento ou CMV da loja → "resumo";
//   • administrador da Matriz → todas as outras.
// Ações (POST JSON {acao, ...}):
//   "resumo"   → {storeId, de, ate, somenteDias?}: dias, produtos e formas de pagamento do período (lido dos resumos no R2);
//                somenteDias:true devolve só o dia a dia (mais rápido, para gráficos).
//   "importar" → {storeId, data}: busca o dia na Linx e grava arquivo + resumos no R2.
//   "diario"   → para cada loja com código do Degust, reimporta os 3 dias anteriores.
//   "resumir"  → {storeId, data, mes?}: refaz o resumo do dia a partir do arquivo já guardado (sem chamar a Linx);
//                mes:true também refaz o resumo do mês.
//   "r2_limpar_detalhe" → {storeId}: apaga os arquivos completos anteriores a DETALHE_DESDE (os resumos ficam).
//   "lojas", "vendas" (consulta direta à Linx), "r2_list" {prefixo?}.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = "https://lx-degust-api-integracao-prd.azurewebsites.net";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const franqueador = () => Number(Deno.env.get("DEGUST_FRANQUEADOR"));
const n = (v: unknown) => Number(String(v ?? 0).replace(",", ".")) || 0;
const yes = (v: unknown) => String(v ?? "").trim().toUpperCase() === "S";
const r2d = (v: number) => Math.round(v * 100) / 100;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isStore = (s: string) => /^[a-z0-9-]+$/i.test(s);
const DETALHE_DESDE = "2026-10-01";

// ---------------------------------------------------------------- Linx
async function token(force = false): Promise<string> {
  if (!force) {
    const { data } = await admin.from("integration_tokens").select("token,expires_at").eq("provider", "degust").maybeSingle();
    if (data && new Date(data.expires_at).getTime() - Date.now() > 10 * 60 * 1000) return data.token;
  }
  const r = await fetch(BASE + "/api/usuario/autenticar?api-version=1.0", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: Deno.env.get("DEGUST_USUARIO"), senha: Deno.env.get("DEGUST_SENHA"), codigoFranqueador: franqueador() }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Login na Linx recusado (" + r.status + ").");
  let tk = txt.trim();
  try { const j = JSON.parse(txt); tk = typeof j === "string" ? j : (j.acesso?.token ?? j.token ?? j.Token ?? j.accessToken ?? ""); } catch { /* texto puro */ }
  tk = String(tk).replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  if (!tk) throw new Error("A Linx não devolveu o token (formato de resposta inesperado)."); // nunca devolve o texto: pode ter o token
  await admin.from("integration_tokens").upsert({ provider: "degust", token: tk, expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), updated_at: new Date().toISOString() });
  return tk;
}
async function linx(method: string, path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api-version", "1.0");
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) url.searchParams.set(k, String(v));
  const call = (tk: string) => fetch(url, { method, headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let r = await call(await token());
  if (r.status === 401) r = await call(await token(true));
  const txt = await r.text();
  if (!r.ok) throw new Error("Linx " + path + " (" + r.status + "): " + txt.slice(0, 300).replace(/eyJ[\w.-]+/g, "[token]"));
  try { return JSON.parse(txt); } catch { return txt; }
}

// ---------------------------------------------------------------- Cloudflare R2 (API S3, assinatura AWS SigV4)
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (d: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof d === "string" ? enc.encode(d) : d));
const hmac = async (key: ArrayBuffer | Uint8Array, msg: string) =>
  crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(msg));
const uriEnc = (s: string, slash = false) => {
  const e = encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return slash ? e.replace(/%2F/g, "/") : e;
};
async function r2Fetch(method: string, key: string, query: Record<string, string> = {}, body?: Uint8Array, contentType?: string) {
  const acct = Deno.env.get("R2_ACCOUNT_ID") ?? "", bucket = Deno.env.get("R2_BUCKET") ?? "";
  const akid = Deno.env.get("R2_ACCESS_KEY_ID") ?? "", secret = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
  if (!acct || !bucket || !akid || !secret) throw new Error("Segredos do R2 incompletos.");
  const host = acct + ".r2.cloudflarestorage.com";
  const path = "/" + bucket + (key ? "/" + uriEnc(key, true) : "");
  const qs = Object.keys(query).sort().map((k) => uriEnc(k) + "=" + uriEnc(query[k])).join("&");
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), day = amzDate.slice(0, 8);
  const payloadHash = await sha256(body ?? new Uint8Array());
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, path, qs, names.map((h) => h + ":" + headers[h]).join("\n") + "\n", names.join(";"), payloadHash].join("\n");
  const scope = day + "/auto/s3/aws4_request";
  let k: ArrayBuffer = await hmac(enc.encode("AWS4" + secret), day);
  for (const part of ["auto", "s3", "aws4_request"]) k = await hmac(k, part);
  const sig = hex(await hmac(k, ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n")));
  const { host: _h, ...send } = headers;
  return fetch("https://" + host + path + (qs ? "?" + qs : ""), {
    method, body, headers: { ...send, Authorization: "AWS4-HMAC-SHA256 Credential=" + akid + "/" + scope + ", SignedHeaders=" + names.join(";") + ", Signature=" + sig },
  });
}
async function r2Put(key: string, body: Uint8Array, contentType: string) {
  const r = await r2Fetch("PUT", key, {}, body, contentType);
  if (!r.ok) throw new Error("R2 PUT (" + r.status + "): " + (await r.text()).slice(0, 200));
}
/** Lê um arquivo; devolve null se não existir. */
async function r2Get(key: string): Promise<Uint8Array | null> {
  const r = await r2Fetch("GET", key);
  if (r.status === 404) { await r.body?.cancel(); return null; }
  if (!r.ok) throw new Error("R2 GET (" + r.status + "): " + (await r.text()).slice(0, 200));
  return new Uint8Array(await r.arrayBuffer());
}
const r2PutJson = (key: string, obj: unknown) => r2Put(key, enc.encode(JSON.stringify(obj)), "application/json");
async function r2GetJson<T>(key: string): Promise<T | null> { const b = await r2Get(key); return b ? JSON.parse(new TextDecoder().decode(b)) : null; }
async function r2Keys(prefix: string) {
  const files: { key: string; size: number }[] = [];
  let tokenC = "";
  for (let i = 0; i < 100; i++) {
    const q: Record<string, string> = { "list-type": "2", "max-keys": "1000", prefix };
    if (tokenC) q["continuation-token"] = tokenC;
    const r = await r2Fetch("GET", "", q); const xml = await r.text();
    if (!r.ok) throw new Error("R2 LIST (" + r.status + "): " + xml.slice(0, 200));
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      files.push({ key: (m[1].match(/<Key>(.*?)<\/Key>/) ?? [])[1] ?? "", size: Number((m[1].match(/<Size>(\d+)<\/Size>/) ?? [])[1] ?? 0) });
    }
    tokenC = (xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/) ?? [])[1] ?? "";
    if (!tokenC) break;
  }
  return files;
}
async function gzip(s: string) { return new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); }
async function gunzip(b: Uint8Array) { return await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
const folder = (storeId: string, dia: string) => "loja=" + storeId + "/ano=" + dia.slice(0, 4) + "/mes=" + dia.slice(5, 7) + "/";
const keyDetail = (storeId: string, dia: string) => "vendas/" + folder(storeId, dia) + dia + ".json.gz";
const keyDaySum = (storeId: string, dia: string) => "resumo/" + folder(storeId, dia) + dia + ".json";
const keyMonthSum = (storeId: string, ym: string) => "resumo/" + folder(storeId, ym + "-01") + "mes.json";

// ---------------------------------------------------------------- Resumos
type Prod = { product_code: number | null; product_name: string; quantity: number; total: number; discount: number; net: number };
type Pay = { method: string; brand: string; payments: number; amount: number };
type DaySum = { business_date: string; sales: number; cancelled: number; gross: number; discount: number; net: number; products: Prod[]; payments: Pay[] };

function summarizeDay(dia: string, vendas: Record<string, any>[]): DaySum {
  const s: DaySum = { business_date: dia, sales: 0, cancelled: 0, gross: 0, discount: 0, net: 0, products: [], payments: [] };
  const prods = new Map<string, Prod>(), pays = new Map<string, Pay>();
  for (const v of vendas) {
    if (yes(v.cancelada)) { s.cancelled++; continue; }
    s.sales++;
    s.gross += n(v.valProduto) + n(v.valDescontoItem); s.discount += n(v.valDesconto) + n(v.valDescontoItem); s.net += n(v.valLiquido);
    for (const it of v.itens ?? []) {
      if (yes(it.cancelado)) continue;
      const k = String(it.codProduto ?? "");
      const p = prods.get(k) ?? { product_code: it.codProduto ?? null, product_name: it.descricaoProduto ?? "", quantity: 0, total: 0, discount: 0, net: 0 };
      p.quantity += n(it.quantidade); p.total += n(it.valTotal); p.discount += n(it.valDesconto); p.net += n(it.valTotal) - n(it.valDesconto);
      prods.set(k, p);
    }
    for (const pg of v.formaPagamento ?? []) {
      const method = String(pg.formaPgto ?? "").trim() || "Não informado", brand = String(pg.bandeira ?? "").trim();
      const k = method + "|" + brand;
      const p = pays.get(k) ?? { method, brand, payments: 0, amount: 0 };
      p.payments++; p.amount += n(pg.valor); pays.set(k, p);
    }
  }
  s.gross = r2d(s.gross); s.discount = r2d(s.discount); s.net = r2d(s.net);
  s.products = [...prods.values()].map((p) => ({ ...p, quantity: Math.round(p.quantity * 10000) / 10000, total: r2d(p.total), discount: r2d(p.discount), net: r2d(p.net) })).sort((a, b) => b.net - a.net);
  s.payments = [...pays.values()].map((p) => ({ ...p, amount: r2d(p.amount) })).sort((a, b) => b.amount - a.amount);
  return s;
}
function mergeProducts(lists: Prod[][]) {
  const m = new Map<string, Prod>();
  for (const l of lists) for (const p of l) {
    const k = String(p.product_code ?? ""); const x = m.get(k) ?? { ...p, quantity: 0, total: 0, discount: 0, net: 0 };
    x.quantity += p.quantity; x.total += p.total; x.discount += p.discount; x.net += p.net; m.set(k, x);
  }
  return [...m.values()].map((p) => ({ ...p, quantity: Math.round(p.quantity * 10000) / 10000, total: r2d(p.total), discount: r2d(p.discount), net: r2d(p.net) })).sort((a, b) => b.net - a.net);
}
function mergePayments(lists: Pay[][]) {
  const m = new Map<string, Pay>();
  for (const l of lists) for (const p of l) { const k = p.method + "|" + p.brand; const x = m.get(k) ?? { ...p, payments: 0, amount: 0 }; x.payments += p.payments; x.amount += p.amount; m.set(k, x); }
  return [...m.values()].map((p) => ({ ...p, amount: r2d(p.amount) })).sort((a, b) => b.amount - a.amount);
}
const dayTotals = ({ products: _p, payments: _q, ...t }: DaySum) => t;
// Refaz o resumo do mês a partir dos resumos de dia que existem no R2.
async function rebuildMonth(storeId: string, ym: string) {
  const keys = (await r2Keys("resumo/" + folder(storeId, ym + "-01"))).map((f) => f.key).filter((k) => /\d{4}-\d{2}-\d{2}\.json$/.test(k));
  const days = (await Promise.all(keys.map((k) => r2GetJson<DaySum>(k)))).filter(Boolean) as DaySum[];
  days.sort((a, b) => a.business_date.localeCompare(b.business_date));
  await r2PutJson(keyMonthSum(storeId, ym), { loja: storeId, mes: ym, atualizadoEm: new Date().toISOString(), days: days.map(dayTotals), products: mergeProducts(days.map((d) => d.products)), payments: mergePayments(days.map((d) => d.payments)) });
  return days.length;
}
const monthsBetween = (de: string, ate: string) => { const out: string[] = []; let y = +de.slice(0, 4), m = +de.slice(5, 7); const ey = +ate.slice(0, 4), em = +ate.slice(5, 7); while (y < ey || (y === ey && m <= em)) { out.push(y + "-" + String(m).padStart(2, "0")); if (++m > 12) { m = 1; y++; } } return out; };
const lastDayOf = (ym: string) => ym + "-" + String(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate()).padStart(2, "0");
// Resumo de um período: dia a dia + produtos + pagamentos. Mês inteiro usa o resumo do mês; mês parcial soma os dias.
async function periodSummary(storeId: string, de: string, ate: string, onlyDays = false) {
  const months = monthsBetween(de, ate);
  if (months.length > 36) throw new Error("Período grande demais (máx. 36 meses).");
  const monthDocs = await Promise.all(months.map((ym) => r2GetJson<{ days: Omit<DaySum, "products" | "payments">[]; products: Prod[]; payments: Pay[] }>(keyMonthSum(storeId, ym))));
  const days: Omit<DaySum, "products" | "payments">[] = [], prodLists: Prod[][] = [], payLists: Pay[][] = [];
  await Promise.all(months.map(async (ym, i) => {
    const doc = monthDocs[i]; if (!doc) return;
    const inRange = doc.days.filter((d) => d.business_date >= de && d.business_date <= ate);
    days.push(...inRange);
    if (onlyDays) return;
    if (de <= ym + "-01" && ate >= lastDayOf(ym)) { prodLists.push(doc.products); payLists.push(doc.payments); return; }
    const sums = (await Promise.all(inRange.map((d) => r2GetJson<DaySum>(keyDaySum(storeId, d.business_date))))).filter(Boolean) as DaySum[];
    for (const s of sums) { prodLists.push(s.products); payLists.push(s.payments); }
  }));
  days.sort((a, b) => a.business_date.localeCompare(b.business_date));
  return { days, products: mergeProducts(prodLists), payments: mergePayments(payLists), imported: days.map((d) => d.business_date) };
}

// ---------------------------------------------------------------- Importação
// Busca UM dia de caixa na Linx e grava no R2: arquivo completo + resumo do dia + resumo do mês. Regravar substitui.
async function importDay(storeId: string, degustCode: number, dia: string, userId: string | null, rebuild = true) {
  const r = await linx("POST", "/api/venda/relatorio-vendas", {
    body: { dataInicial: dia, dataFinal: dia, codFranqueador: franqueador(), codLoja: degustCode, exibirVendasCanceladas: true, tipoData: "C" },
  });
  const byCtl = new Map<number, Record<string, any>>();   // mesmo controle repetido no dia: fica o último
  for (const v of (Array.isArray(r) ? r : [])) byCtl.set(Number(v.controle), v);
  const lista = [...byCtl.values()].map(({ docConsumidor: _a, docConsumidorDesconto: _b, ...v }) => v);
  const doc = JSON.stringify({ loja: storeId, codLojaDegust: degustCode, data: dia, geradoEm: new Date().toISOString(), vendas: lista });
  let gz: Uint8Array | null = null;
  if (dia >= DETALHE_DESDE) { gz = await gzip(doc); await r2Put(keyDetail(storeId, dia), gz, "application/gzip"); }
  const sum = summarizeDay(dia, lista);
  await r2PutJson(keyDaySum(storeId, dia), sum);
  if (rebuild) await rebuildMonth(storeId, dia.slice(0, 7));
  await admin.from("sales_imports").upsert({ store_id: storeId, business_date: dia, sales: sum.sales, cancelled: sum.cancelled, net: sum.net, imported_at: new Date().toISOString(), imported_by: userId });
  return { data: dia, vendas: sum.sales, canceladas: sum.cancelled, liquido: sum.net, arquivo: gz ? { bytes: gz.length, bytesSemCompactar: enc.encode(doc).length } : "só resumo" };
}
// Refaz o resumo do dia a partir do arquivo já guardado (sem chamar a Linx).
async function resummarize(storeId: string, dia: string, month: boolean) {
  const b = await r2Get(keyDetail(storeId, dia));
  if (!b) return { data: dia, arquivo: false };
  const doc = JSON.parse(await gunzip(b));
  const sum = summarizeDay(dia, doc.vendas ?? []);
  await r2PutJson(keyDaySum(storeId, dia), sum);
  if (month) await rebuildMonth(storeId, dia.slice(0, 7));
  return { data: dia, vendas: sum.sales, liquido: sum.net };
}

function diaSP(menos: number) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  d.setDate(d.getDate() - menos);
  return d.toLocaleDateString("en-CA");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const p = await req.json().catch(() => ({}));

    // Agendamento diário: confere a chave guardada no banco e só aceita "diario".
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

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ erro: "Faça login." }, 401);

    // Resumo do período: quem vê Faturamento ou CMV da loja (mesma regra do banco, avaliada com o login de quem chama).
    if (p.acao === "resumo") {
      const storeId = String(p.storeId ?? ""), de = String(p.de ?? ""), ate = String(p.ate ?? "");
      if (!isStore(storeId) || !isDay(de) || !isDay(ate) || ate < de) return json({ erro: "Loja ou período inválido." }, 400);
      const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + jwt } } });
      const { data: can, error } = await asUser.rpc("can_view_sales", { p_store: storeId });
      if (error) throw new Error("Permissão: " + error.message);
      if (!can) return json({ erro: "Sem acesso ao faturamento desta loja." }, 403);
      return json({ ok: true, ...(await periodSummary(storeId, de, ate, !!p.somenteDias)) });
    }

    const { data: m } = await admin.from("store_memberships").select("user_id")
      .eq("user_id", u.user.id).eq("store_id", "matriz").eq("role", "matrix_admin").eq("active", true).limit(1);
    if (!m?.length) return json({ erro: "Somente administradores da Matriz." }, 403);

    if (p.acao === "lojas") {
      const r = await linx("GET", "/api/loja/listarLojasFranquia", { query: { codigoFranquia: franqueador() } });
      return json({ ok: true, lojas: (Array.isArray(r) ? r : []).map((l: Record<string, unknown>) => ({ codigoLoja: l.codigoLoja, nomeLoja: l.nomeLoja, razaoSocial: l.razaoSocial, cnpj: l.cnpj, cidade: l.cidade, uf: l.uf, tipo: l.tipo })) });
    }
    if (p.acao === "vendas") {
      const r = await linx("POST", "/api/venda/relatorio-vendas", { body: { dataInicial: p.dataInicial, dataFinal: p.dataFinal, codFranqueador: franqueador(), codLoja: Number(p.codLoja), exibirVendasCanceladas: true, tipoData: "C" } });
      const vendas = Array.isArray(r) ? r : [];
      const ok = vendas.filter((v: Record<string, unknown>) => !yes(v.cancelada));
      return json({ ok: true, vendas: vendas.length, canceladas: vendas.length - ok.length, liquido: r2d(ok.reduce((s: number, v: Record<string, unknown>) => s + n(v.valLiquido), 0)) });
    }
    if (p.acao === "r2_limpar_detalhe") {
      const sid = String(p.storeId ?? "");
      if (!isStore(sid)) return json({ erro: "Loja inválida." }, 400);
      const old = (await r2Keys("vendas/loja=" + sid + "/")).filter((f) => (f.key.match(/(\d{4}-\d{2}-\d{2})\.json\.gz$/) ?? [])[1] < DETALHE_DESDE);
      for (let i = 0; i < old.length; i += 10) {
        await Promise.all(old.slice(i, i + 10).map(async (f) => { const r = await r2Fetch("DELETE", f.key); await r.body?.cancel(); if (!r.ok && r.status !== 404) throw new Error("R2 DELETE (" + r.status + ")"); }));
      }
      return json({ ok: true, apagados: old.length, bytes: old.reduce((s, f) => s + f.size, 0) });
    }
    if (p.acao === "r2_list") {
      const files = await r2Keys(String(p.prefixo ?? ""));
      return json({ ok: true, arquivos: files.length, bytes: files.reduce((s, f) => s + f.size, 0), primeiros: files.slice(0, 3), ultimos: files.slice(-3) });
    }
    const storeId = String(p.storeId ?? ""), dia = String(p.data ?? "");
    if (p.acao === "resumir") {
      if (!isStore(storeId) || !isDay(dia)) return json({ erro: "Loja ou data inválida." }, 400);
      return json({ ok: true, ...(await resummarize(storeId, dia, !!p.mes)) });
    }
    if (p.acao === "importar") {
      if (!isDay(dia)) return json({ erro: "Informe a data (AAAA-MM-DD)." }, 400);
      const { data: st } = await admin.from("stores").select("id,degust_code").eq("id", storeId).maybeSingle();
      if (!st?.degust_code) return json({ erro: "Loja sem código do Degust." }, 400);
      return json({ ok: true, ...(await importDay(st.id, st.degust_code, dia, u.user.id, p.mes !== false)) });
    }
    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message ?? e).replace(/eyJ[\w.-]+/g, "[token]") }, 500);
  }
});
