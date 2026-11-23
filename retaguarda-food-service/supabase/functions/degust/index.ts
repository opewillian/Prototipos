// Integração Linx Degust One (API de Integrações Externa). Roda no servidor do Supabase (Edge Function "degust").
// Segredos (Edge Functions → Secrets): DEGUST_USUARIO, DEGUST_SENHA, DEGUST_FRANQUEADOR. A senha nunca vai ao navegador.
// Só administrador da Matriz pode chamar. O token da Linx (4 h) fica em public.integration_tokens para ser reaproveitado.
// Ações (POST JSON {acao, ...}):
//   "lojas"  → lista as lojas da franquia no Degust (código, nome, CNPJ, cidade).
//   "vendas" → relatório de vendas de uma loja num período (máx. 30 dias): {codLoja, dataInicial, dataFinal, resumo?}
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = "https://lx-degust-api-integracao-prd.azurewebsites.net";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (!r.ok) throw new Error("Login na Linx recusado (" + r.status + "): " + txt.slice(0, 300));
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
  if (!r.ok) throw new Error("Linx " + path + " (" + r.status + "): " + txt.slice(0, 300));
  try { return JSON.parse(txt); } catch { return txt; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Quem chama precisa ser administrador da Matriz.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return json({ erro: "Faça login." }, 401);
    const { data: m } = await admin.from("store_memberships").select("user_id")
      .eq("user_id", u.user.id).eq("store_id", "matriz").eq("role", "matrix_admin").eq("active", true).limit(1);
    if (!m?.length) return json({ erro: "Somente administradores da Matriz." }, 403);

    const p = await req.json().catch(() => ({}));
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
        const n = (v: unknown) => Number(String(v ?? 0).replace(",", ".")) || 0;
        const ok = vendas.filter((v: Record<string, unknown>) => v.cancelada !== "S");
        return json({
          ok: true, vendas: vendas.length, canceladas: vendas.length - ok.length,
          liquido: Math.round(ok.reduce((s: number, v: Record<string, unknown>) => s + n(v.valLiquido), 0) * 100) / 100,
          // Exemplo de uma venda para conferir o formato, sem documento do consumidor (CPF/CNPJ).
          exemplo: vendas[0] ? { ...vendas[0], docConsumidor: undefined, docConsumidorDesconto: undefined } : null,
        });
      }
      return json({ ok: true, vendas });
    }
    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message ?? e) }, 500);
  }
});
