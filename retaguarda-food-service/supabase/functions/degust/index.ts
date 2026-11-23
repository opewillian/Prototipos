// Integração Linx Degust One (API de Integrações Externa). Roda no servidor do Supabase (Edge Function "degust").
// Segredos (Edge Functions → Secrets): DEGUST_USUARIO, DEGUST_SENHA, DEGUST_FRANQUEADOR. A senha nunca vai ao navegador.
// Só administrador da Matriz pode chamar. O token da Linx (4 h) fica em public.integration_tokens para ser reaproveitado.
// Ações (POST JSON {acao, ...}):
//   "lojas"  → lista as lojas da franquia no Degust (código, nome, CNPJ, cidade).
//   "vendas" → relatório de vendas de uma loja num período (máx. 30 dias): {codLoja, dataInicial, dataFinal, resumo?}
//   "importar" → grava UM dia de caixa da loja nas tabelas sales/sale_items/sale_payments: {storeId, data}
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
    if (p.acao === "importar") {
      // Importa UM dia de caixa de uma loja: apaga o que havia do dia e grava de novo (pega cancelamentos tardios).
      const dia = String(p.data ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return json({ erro: "Informe a data (AAAA-MM-DD)." }, 400);
      const { data: st } = await admin.from("stores").select("id,degust_code").eq("id", p.storeId).maybeSingle();
      if (!st?.degust_code) return json({ erro: "Loja sem código do Degust." }, 400);
      const r = await linx("POST", "/api/venda/relatorio-vendas", {
        body: { dataInicial: dia, dataFinal: dia, codFranqueador: franqueador(), codLoja: st.degust_code, exibirVendasCanceladas: true, tipoData: "C" },
      });
      const vendas: Record<string, any>[] = Array.isArray(r) ? r : [];
      const n = (v: unknown) => Number(String(v ?? 0).replace(",", ".")) || 0;
      const yes = (v: unknown) => String(v ?? "").trim().toUpperCase() === "S";
      // Mesmo controle repetido no dia: fica o último.
      const byCtl = new Map<number, Record<string, any>>();
      for (const v of vendas) byCtl.set(Number(v.controle), v);
      const lista = [...byCtl.values()];
      const del = await admin.from("sales").delete().eq("store_id", st.id).eq("business_date", dia);
      if (del.error) throw new Error("Apagar dia: " + del.error.message);
      let gravadas = 0, itens = 0, pagtos = 0;
      for (let i = 0; i < lista.length; i += 200) {
        const lote = lista.slice(i, i + 200);
        const rows = lote.map((v) => {
          const doc = (v.documento ?? [])[0] ?? {};
          return {
            store_id: st.id, business_date: dia, control: Number(v.controle), sale_date: v.dataVenda ?? null, created_raw: v.dataHoraInclusao ?? null,
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
            sale_id: sid, store_id: st.id, business_date: dia, line: it.numLancto ?? null, main_line: it.numLanctoItemPrincipal ?? null,
            product_code: it.codProduto ?? null, product_name: it.descricaoProduto ?? null, unit: it.unidadeProduto ?? null,
            quantity: n(it.quantidade), unit_price: n(it.valUnitario), total: n(it.valTotal), discount: n(it.valDesconto),
            cancelled: yes(it.cancelado), stock_item_code: it.fiscal?.codItemEstoque ?? null,
          });
          for (const pg of v.formaPagamento ?? []) pgs.push({
            sale_id: sid, store_id: st.id, business_date: dia, seq: pg.sequencia ?? null, method: pg.formaPgto ?? null,
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
        store_id: st.id, business_date: dia, sales: ok.length, cancelled: lista.length - ok.length, net: liquido,
        imported_at: new Date().toISOString(), imported_by: u.user.id,
      });
      return json({ ok: true, data: dia, vendas: ok.length, canceladas: lista.length - ok.length, liquido, gravadas, itens, pagamentos: pagtos });
    }
    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message ?? e) }, 500);
  }
});
