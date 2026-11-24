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
//   "cupons"   → {storeId, data}: cupons do dia (recibos) lidos do arquivo completo; quem vê Faturamento/CMV. Só a partir de DETALHE_DESDE.
//   "resumo"   → {storeId, de, ate, somenteDias?}: dias (com vendas por hora quando houver), produtos e formas de pagamento do período (lido dos resumos no R2);
//                somenteDias:true devolve só o dia a dia (mais rápido, para gráficos).
//   "ranking"  → {storeId}: ticket médio do mês passado e deste mês das lojas da mesma marca (quem vê Faturamento/CMV da loja).
//   "importar" → {storeId, data}: busca o dia na Linx e grava arquivo + resumos no R2.
//   "fila"     → processa a fila sales_import_jobs por até ~110 s (cron "degust-fila" a cada minuto, ou admin).
//   "periodo_teste" → {codLoja, de, ate}: separa um período por dia sem gravar (conferência).
// Lojas com vários pontos no Degust: stores.degust_codes (as vendas de todos entram somadas na loja).
// Franquia de cada loja: stores.degust_franqueador (vazio = DEGUST_FRANQUEADOR, a DEL). "lojas", "vendas" e "periodo_teste" aceitam {franqueador}.
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
// Franquia padrão (DEL) nos segredos; outras franquias (SAL 2168, ACB 2642, BIT 2202) vêm de stores.degust_franqueador. Mesmo usuário Linx.
const franqueador = () => Number(Deno.env.get("DEGUST_FRANQUEADOR"));
const franqOf = (f?: number | null) => (Number(f) > 0 ? Number(f) : franqueador());
const n = (v: unknown) => Number(String(v ?? 0).replace(",", ".")) || 0;
const yes = (v: unknown) => String(v ?? "").trim().toUpperCase() === "S";
const r2d = (v: number) => Math.round(v * 100) / 100;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isStore = (s: string) => /^[a-z0-9-]+$/i.test(s);
const DETALHE_DESDE = "2026-10-01";

// ---------------------------------------------------------------- Linx
// Um token por franquia (o login leva o código da franquia): provider "degust" (padrão) ou "degust:<franquia>".
async function token(force = false, franq?: number | null): Promise<string> {
  const f = franqOf(franq), provider = f === franqueador() ? "degust" : "degust:" + f;
  if (!force) {
    const { data } = await admin.from("integration_tokens").select("token,expires_at").eq("provider", provider).maybeSingle();
    if (data && new Date(data.expires_at).getTime() - Date.now() > 10 * 60 * 1000) return data.token;
  }
  const r = await fetch(BASE + "/api/usuario/autenticar?api-version=1.0", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: Deno.env.get("DEGUST_USUARIO"), senha: Deno.env.get("DEGUST_SENHA"), codigoFranqueador: f }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Login na Linx recusado (" + r.status + ").");
  let tk = txt.trim();
  try { const j = JSON.parse(txt); tk = typeof j === "string" ? j : (j.acesso?.token ?? j.token ?? j.Token ?? j.accessToken ?? ""); } catch { /* texto puro */ }
  tk = String(tk).replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  if (!tk) throw new Error("A Linx não devolveu o token (formato de resposta inesperado)."); // nunca devolve o texto: pode ter o token
  await admin.from("integration_tokens").upsert({ provider, token: tk, expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), updated_at: new Date().toISOString() });
  return tk;
}
async function linx(method: string, path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}, franq?: number | null) {
  const url = new URL(BASE + path);
  url.searchParams.set("api-version", "1.0");
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) url.searchParams.set(k, String(v));
  const call = (tk: string) => fetch(url, { method, headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let r = await call(await token(false, franq));
  if (r.status === 401) r = await call(await token(true, franq));
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
// hours / hoursN: líquido e nº de vendas por hora do dia (0 a 23, pela hora da venda = 1º item lançado). Só nos dias resumidos a partir do arquivo completo.
type DaySum = { business_date: string; sales: number; cancelled: number; gross: number; discount: number; net: number; hours?: number[]; hoursN?: number[]; products: Prod[]; payments: Pay[] };

// Hora da venda: a do 1º item lançado no caixa (datHoraLancamento). dataHoraInclusao é a hora em que a venda CHEGOU ao
// Degust — com o caixa sem internet, dezenas de vendas chegam juntas às 23h/0h (visto em 03, 04, 12, 14 e 19/11/2026).
const horaVenda = (v: Record<string, any>) => {
  const hs = (v.itens ?? []).map((it: Record<string, any>) => String(it.datHoraLancamento ?? "")).filter((h: string) => /^\d{4}-\d{2}-\d{2} \d{2}:/.test(h)).sort();
  return hs[0] ?? String(v.dataHoraInclusao ?? "");
};
// Cupom para a tela de recibos (Faturamento › clicar no dia). Só os campos usados no recibo; sem dados do cliente.
// hora = horaVenda ("AAAA-MM-DD HH:MM:SS"); bruto/desconto/líquido com a mesma regra do resumo.
const cupom = (v: Record<string, any>) => ({
  id: v.controle, hora: horaVenda(v), pdv: v.numPdv ?? "", nfce: v.documento?.[0]?.numero ?? null,
  cancelada: yes(v.cancelada),
  bruto: r2d(n(v.valProduto) + n(v.valDescontoItem)), desconto: r2d(n(v.valDesconto) + n(v.valDescontoItem)),
  acrescimo: r2d(n(v.valAcrescimo)), liquido: r2d(n(v.valLiquido)), troco: r2d(n(v.valTroco)),
  itens: (v.itens ?? []).map((it: Record<string, any>) => ({
    codigo: it.codProduto ?? null, nome: String(it.descricaoProduto ?? ""), unid: String(it.unidadeProduto ?? ""),
    qtd: n(it.quantidade), unit: r2d(n(it.valUnitario)), total: r2d(n(it.valTotal)), desconto: r2d(n(it.valDesconto)), cancelado: yes(it.cancelado),
  })),
  pagamentos: (v.formaPagamento ?? []).map((pg: Record<string, any>) => ({
    forma: String(pg.formaPgto ?? "").trim() || "Não informado", adm: String(pg.administradora ?? "").trim(), valor: r2d(n(pg.valor)), parcelas: n(pg.tefQtdeParcela) || 1,
  })),
});
function summarizeDay(dia: string, vendas: Record<string, any>[]): DaySum {
  const s: DaySum = { business_date: dia, sales: 0, cancelled: 0, gross: 0, discount: 0, net: 0, hours: Array(24).fill(0), hoursN: Array(24).fill(0), products: [], payments: [] };
  const prods = new Map<string, Prod>(), pays = new Map<string, Pay>();
  for (const v of vendas) {
    if (yes(v.cancelada)) { s.cancelled++; continue; }
    s.sales++;
    s.gross += n(v.valProduto) + n(v.valDescontoItem); s.discount += n(v.valDesconto) + n(v.valDescontoItem); s.net += n(v.valLiquido);
    const hv = horaVenda(v), h = Number(hv.slice(11, 13));
    if (h >= 0 && h < 24 && hv.length >= 13) { s.hours![h] += n(v.valLiquido); s.hoursN![h]++; }
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
  s.gross = r2d(s.gross); s.discount = r2d(s.discount); s.net = r2d(s.net); s.hours = s.hours!.map(r2d);
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
// Pontos de venda do Degust de uma loja: stores.degust_codes (vários pontos com o mesmo CNPJ, somados na loja) ou degust_code.
type StoreRow = { id: string; degust_code: number | null; degust_codes?: number[] | null; degust_franqueador?: number | null };
const codesOf = (st: StoreRow) => ((st.degust_codes?.length ? st.degust_codes : [st.degust_code]) ?? []).filter((c): c is number => Number(c) > 0);
// Dia de caixa da venda: dataVenda (dd/mm/aaaa); sem ela, datMovimento; sem as duas, o dia pedido.
const diaDaVenda = (v: Record<string, any>, padrao: string) => {
  const m = String(v.dataVenda ?? v.datMovimento ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + "-" + m[2] + "-" + m[1];
  const iso = String(v.datMovimento ?? "").match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : padrao;
};
/** Busca as vendas de um período (até 30 dias) em todos os pontos da loja; tira duplicadas e o documento do consumidor. */
async function fetchSales(codes: number[], de: string, ate: string, franq?: number | null) {
  const byKey = new Map<string, Record<string, any>>();   // mesmo controle repetido: fica o último
  for (const cod of codes) {
    const r = await linx("POST", "/api/venda/relatorio-vendas", {
      body: { dataInicial: de, dataFinal: ate, codFranqueador: franqOf(franq), codLoja: cod, exibirVendasCanceladas: true, tipoData: "C" },
    }, franq);
    for (const v of (Array.isArray(r) ? r : [])) byKey.set(cod + "|" + Number(v.controle), { ...v, codLoja: v.codLoja ?? cod });
  }
  return [...byKey.values()].map(({ docConsumidor: _a, docConsumidorDesconto: _b, ...v }) => v);
}
/** Grava um dia: arquivo completo (a partir de DETALHE_DESDE), resumo do dia e registro em sales_imports. */
async function writeDay(storeId: string, codes: number[], dia: string, lista: Record<string, any>[], userId: string | null, rebuild: boolean) {
  const doc = JSON.stringify({ loja: storeId, codLojaDegust: codes.length === 1 ? codes[0] : codes, data: dia, geradoEm: new Date().toISOString(), vendas: lista });
  let gz: Uint8Array | null = null;
  if (dia >= DETALHE_DESDE) { gz = await gzip(doc); await r2Put(keyDetail(storeId, dia), gz, "application/gzip"); }
  const sum = summarizeDay(dia, lista);
  await r2PutJson(keyDaySum(storeId, dia), sum);
  if (rebuild) await rebuildMonth(storeId, dia.slice(0, 7));
  await admin.from("sales_imports").upsert({ store_id: storeId, business_date: dia, sales: sum.sales, cancelled: sum.cancelled, net: sum.net, imported_at: new Date().toISOString(), imported_by: userId });
  return { data: dia, vendas: sum.sales, canceladas: sum.cancelled, liquido: sum.net, arquivo: gz ? { bytes: gz.length, bytesSemCompactar: enc.encode(doc).length } : "só resumo" };
}
// Busca UM dia de caixa na Linx e grava no R2. Regravar substitui.
async function importDay(storeId: string, codes: number[], dia: string, userId: string | null, rebuild = true, franq?: number | null) {
  return writeDay(storeId, codes, dia, await fetchSales(codes, dia, dia, franq), userId, rebuild);
}
const addDia = (dia: string, n: number) => { const d = new Date(dia + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Importa um período (até 30 dias) de uma vez: uma chamada por ponto, separa por dia e grava os dias em paralelo
 *  (5 por vez) e o registro em sales_imports numa chamada só. Não refaz o mês (o trabalho "mes" da fila faz). */
async function importRange(storeId: string, codes: number[], de: string, ate: string, userId: string | null, franq?: number | null) {
  const lista = await fetchSales(codes, de, ate, franq);
  const porDia = new Map<string, Record<string, any>[]>();
  for (const v of lista) { const d = diaDaVenda(v, de); (porDia.get(d) ?? porDia.set(d, []).get(d)!).push(v); }
  const dias: string[] = [];
  for (let d = de; d <= ate; d = addDia(d, 1)) dias.push(d);
  const regs: Record<string, unknown>[] = [];
  let vendas = 0;
  for (let i = 0; i < dias.length; i += 5) {
    await Promise.all(dias.slice(i, i + 5).map(async (d) => {
      const vs = porDia.get(d) ?? [];
      if (d >= DETALHE_DESDE) {
        const doc = JSON.stringify({ loja: storeId, codLojaDegust: codes.length === 1 ? codes[0] : codes, data: d, geradoEm: new Date().toISOString(), vendas: vs });
        await r2Put(keyDetail(storeId, d), await gzip(doc), "application/gzip");
      }
      const sum = summarizeDay(d, vs);
      await r2PutJson(keyDaySum(storeId, d), sum);
      vendas += sum.sales;
      regs.push({ store_id: storeId, business_date: d, sales: sum.sales, cancelled: sum.cancelled, net: sum.net, imported_at: new Date().toISOString(), imported_by: userId });
    }));
  }
  const { error } = await admin.from("sales_imports").upsert(regs);
  if (error) throw new Error("sales_imports: " + error.message);
  const fora = [...porDia.keys()].filter((d) => d < de || d > ate);
  return { dias: dias.length, vendas, fora };
}
// ---------------------------------------------------------------- Fila de importação (tabela sales_import_jobs)
// kind "dias" = importRange(de..ate); kind "mes" = rebuildMonth(mês de "de"). Quem pega o trabalho: public.claim_sales_import_job().
async function runQueue(budgetMs: number) {
  const t0 = Date.now(); let feitos = 0, erros = 0;
  const lojas = new Map<string, { codes: number[]; franq: number | null }>();
  while (Date.now() - t0 < budgetMs) {
    const { data: job, error } = await admin.rpc("claim_sales_import_job");
    if (error) throw new Error("Fila: " + error.message);
    const j = Array.isArray(job) ? job[0] : job;
    if (!j?.id) break;
    try {
      if (j.kind === "mes") { await rebuildMonth(j.store_id, String(j.de).slice(0, 7)); }
      else {
        if (!lojas.has(j.store_id)) { const { data: st } = await admin.from("stores").select("id,degust_code,degust_codes,degust_franqueador").eq("id", j.store_id).maybeSingle(); lojas.set(j.store_id, { codes: st ? codesOf(st as StoreRow) : [], franq: (st as StoreRow | null)?.degust_franqueador ?? null }); }
        const lj = lojas.get(j.store_id)!;
        if (!lj.codes.length) throw new Error("Loja sem código do Degust.");
        await importRange(j.store_id, lj.codes, j.de, j.ate, null, lj.franq);
      }
      await admin.from("sales_import_jobs").update({ status: "ok", error: null, updated_at: new Date().toISOString() }).eq("id", j.id);
      feitos++;
    } catch (e) {
      erros++;
      const msg = String((e as Error).message ?? e).replace(/eyJ[\w.-]+/g, "[token]").slice(0, 500);
      await admin.from("sales_import_jobs").update({ status: j.tries >= 4 ? "erro" : "pending", error: msg, updated_at: new Date().toISOString() }).eq("id", j.id);
    }
  }
  return { feitos, erros, ms: Date.now() - t0 };
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
      if (p.acao === "fila") return json({ ok: true, ...(await runQueue(110_000)) });
      if (p.acao !== "diario") return json({ erro: "O agendamento só pode rodar as ações diario e fila." }, 400);
      // Diário: põe na fila os 3 últimos dias de cada loja com Degust (e o resumo dos meses tocados) e já processa a fila.
      const { data: lojas } = await admin.from("stores").select("id,degust_code,degust_codes,degust_franqueador").eq("active", true);
      const de = diaSP(3), ate = diaSP(1), jobs: Record<string, unknown>[] = [];
      for (const st of (lojas ?? []) as StoreRow[]) {
        if (!codesOf(st).length) continue;
        jobs.push({ store_id: st.id, kind: "dias", de, ate, priority: 0 });
        for (const ym of new Set([de.slice(0, 7), ate.slice(0, 7)])) jobs.push({ store_id: st.id, kind: "mes", de: ym + "-01", ate: ym + "-01", priority: 0 });
      }
      if (jobs.length) { const { error } = await admin.from("sales_import_jobs").insert(jobs); if (error) throw new Error("Fila: " + error.message); }
      return json({ ok: true, enfileirados: jobs.length, ...(await runQueue(110_000)) });
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
    // Ranking de ticket médio das lojas da MESMA MARCA da loja vista (mês passado x este mês). Quem vê Faturamento/CMV
    // da loja vê o ranking (só o ticket médio das outras lojas, não as vendas). Marca = stores.brand_id; sem marca, o
    // prefixo do código (ACB, SAL…). Base: public.sales_imports (líquido e nº de vendas por dia).
    if (p.acao === "ranking") {
      const storeId = String(p.storeId ?? "");
      if (!isStore(storeId)) return json({ erro: "Loja inválida." }, 400);
      const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + jwt } } });
      const { data: can, error } = await asUser.rpc("can_view_sales", { p_store: storeId });
      if (error) throw new Error("Permissão: " + error.message);
      if (!can) return json({ erro: "Sem acesso ao faturamento desta loja." }, 403);
      const { data: all } = await admin.from("stores").select("id,code,name,brand_id,degust_code,active").eq("store_type", "operational");
      const key = (x: Record<string, any>) => x.brand_id ?? ("pref:" + String(x.code ?? "").split("-")[0]);
      const me = (all ?? []).find((x) => x.id === storeId);
      if (!me) return json({ erro: "Loja não encontrada." }, 404);
      const lojas = (all ?? []).filter((x) => key(x) === key(me) && x.degust_code != null);
      const hoje = diaSP(0), ontem = diaSP(1);
      const curIni = hoje.slice(0, 8) + "01";
      const prevIni = addDia(curIni, -1).slice(0, 8) + "01", prevFim = addDia(curIni, -1);
      const tot = new Map<string, { pn: number; ps: number; cn: number; cs: number; cd: number }>();
      for (const l of lojas) tot.set(l.id, { pn: 0, ps: 0, cn: 0, cs: 0, cd: 0 });
      const ids = lojas.map((l) => l.id);
      for (let from = 0; ids.length; from += 1000) {
        const { data: rows, error: e2 } = await admin.from("sales_imports").select("store_id,business_date,sales,net")
          .in("store_id", ids).gte("business_date", prevIni).lte("business_date", ontem).order("store_id").order("business_date").range(from, from + 999);
        if (e2) throw new Error("Vendas: " + e2.message);
        for (const r of rows ?? []) {
          const t = tot.get(r.store_id)!; const d = String(r.business_date);
          if (d <= prevFim) { t.pn += Number(r.net); t.ps += Number(r.sales); } else { t.cn += Number(r.net); t.cs += Number(r.sales); t.cd++; }
        }
        if (!rows || rows.length < 1000) break;
      }
      const tk = (n: number, q: number) => (q > 0 ? r2d(n / q) : null);
      const out = lojas.map((l) => {
        const t = tot.get(l.id)!; const a = tk(t.pn, t.ps), b = tk(t.cn, t.cs);
        return { store_id: l.id, code: l.code, name: l.name, prev: a, cur: b, var: a && b ? Math.round((b / a - 1) * 10000) / 10000 : null, dias: t.cd };
      });
      return json({ ok: true, marca: me.brand_id ? null : String(me.code).split("-")[0], mesAnterior: prevIni.slice(0, 7), mesAtual: curIni.slice(0, 7), ate: ontem, lojas: out });
    }
    // Cupons de um dia (arquivo completo do R2; só existe a partir de DETALHE_DESDE). Mesma permissão do resumo.
    if (p.acao === "cupons") {
      const storeId = String(p.storeId ?? ""), dia = String(p.data ?? "");
      if (!isStore(storeId) || !isDay(dia)) return json({ erro: "Loja ou data inválida." }, 400);
      const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: "Bearer " + jwt } } });
      const { data: can, error } = await asUser.rpc("can_view_sales", { p_store: storeId });
      if (error) throw new Error("Permissão: " + error.message);
      if (!can) return json({ erro: "Sem acesso ao faturamento desta loja." }, 403);
      if (dia < DETALHE_DESDE) return json({ ok: true, detalhe: false, desde: DETALHE_DESDE, cupons: [] });
      const b = await r2Get(keyDetail(storeId, dia));
      if (!b) return json({ ok: true, detalhe: true, cupons: [] });
      const doc = JSON.parse(await gunzip(b));
      return json({ ok: true, detalhe: true, cupons: (doc.vendas ?? []).map(cupom) });
    }

    const { data: m } = await admin.from("store_memberships").select("user_id")
      .eq("user_id", u.user.id).eq("store_id", "matriz").eq("role", "matrix_admin").eq("active", true).limit(1);
    if (!m?.length) return json({ erro: "Somente administradores da Matriz." }, 403);

    // Teste: separa por dia um período de UM ponto (sem gravar), para conferir com a importação dia a dia.
    if (p.acao === "periodo_teste") {
      const de = String(p.de ?? ""), ate = String(p.ate ?? "");
      if (!isDay(de) || !isDay(ate)) return json({ erro: "Período inválido." }, 400);
      const lista = await fetchSales([Number(p.codLoja)], de, ate, Number(p.franqueador) || null);
      const out: Record<string, { n: number; liq: number }> = {};
      for (const v of lista) { if (yes(v.cancelada)) continue; const d = diaDaVenda(v, de); const o = out[d] ?? (out[d] = { n: 0, liq: 0 }); o.n++; o.liq = r2d(o.liq + n(v.valLiquido)); }
      return json({ ok: true, dias: out });
    }
    if (p.acao === "fila") return json({ ok: true, ...(await runQueue(Math.min(Number(p.ms) || 60_000, 110_000))) });
    if (p.acao === "lojas") {
      const fq = franqOf(Number(p.franqueador) || null);
      const r = await linx("GET", "/api/loja/listarLojasFranquia", { query: { codigoFranquia: fq } }, fq);
      return json({ ok: true, lojas: (Array.isArray(r) ? r : []).map((l: Record<string, unknown>) => ({ codigoLoja: l.codigoLoja, nomeLoja: l.nomeLoja, razaoSocial: l.razaoSocial, cnpj: l.cnpj, cidade: l.cidade, uf: l.uf, tipo: l.tipo })) });
    }
    if (p.acao === "vendas") {
      const r = await linx("POST", "/api/venda/relatorio-vendas", { body: { dataInicial: p.dataInicial, dataFinal: p.dataFinal, codFranqueador: franqOf(Number(p.franqueador) || null), codLoja: Number(p.codLoja), exibirVendasCanceladas: true, tipoData: "C" } }, Number(p.franqueador) || null);
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
      const { data: st } = await admin.from("stores").select("id,degust_code,degust_codes,degust_franqueador").eq("id", storeId).maybeSingle();
      const codes = st ? codesOf(st as StoreRow) : [];
      if (!codes.length) return json({ erro: "Loja sem código do Degust." }, 400);
      return json({ ok: true, ...(await importDay(st!.id, codes, dia, u.user.id, p.mes !== false, (st as StoreRow).degust_franqueador ?? null)) });
    }
    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message ?? e).replace(/eyJ[\w.-]+/g, "[token]") }, 500);
  }
});
