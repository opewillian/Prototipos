import { supabase } from "./core/supabase.js";
import { getStores, getRows, getDashboard } from "./core/api.js";
import { demoStores } from "./core/demo-data.js";
import { modules, moduleById } from "./modules/index.js";
import { layout, accountButton } from "./components/layout.js";
import { renderList } from "./components/table.js";
import { renderDashboard } from "./modules/dashboard/index.js";

const state = {
  mode: "demo", moduleId: "dashboard", storeId: demoStores[0].id,
  stores: demoStores, session: null, rows: [], dashboard: {},
  loading: false, error: ""
};
const root = document.getElementById("app");
let loadingSequence = 0;

async function initialize() {
  try {
    const {data, error} = await supabase.auth.getSession();
    if (error) throw error;
    state.session = data.session;
  } catch (error) {
    state.error = "Não foi possível verificar a sessão: " + error.message;
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if (state.mode === "live") Promise.resolve().then(refreshStores);
  });
  await refreshStores();
}
async function refreshStores() {
  const requestId = ++loadingSequence;
  state.error = "";
  if (state.mode === "live" && !state.session) {
    state.stores = []; state.storeId = ""; state.loading = false; render(); return;
  }
  state.loading = true; render();
  try {
    const stores = await getStores(state.mode);
    if (requestId !== loadingSequence) return;
    state.stores = stores;
    if (!stores.some((s) => s.id === state.storeId)) state.storeId = stores[0]?.id || "";
    await loadModule();
  } catch (error) {
    if (requestId !== loadingSequence) return;
    state.stores = []; state.storeId = ""; state.loading = false;
    state.error = "Falha ao consultar as unidades: " + error.message;
    render();
  }
}
async function loadModule() {
  const id = ++loadingSequence;
  state.loading = true; state.error = ""; render();
  try {
    if (state.mode === "live" && !state.session) { state.loading = false; render(); return; }
    if (state.moduleId === "dashboard") {
      state.dashboard = await getDashboard(state.mode, state.storeId);
    } else {
      state.rows = await getRows(moduleById[state.moduleId], state.mode, state.storeId);
    }
    if (id !== loadingSequence) return;
    state.loading = false; render();
  } catch (error) {
    if (id !== loadingSequence) return;
    state.error = "Falha na consulta: " + error.message;
    state.rows = []; state.dashboard = {}; state.loading = false; render();
  }
}
function render() {
  let content = "";
  if (state.moduleId === "dashboard") content = renderDashboard(state.dashboard, state.mode);
  else content = renderList(moduleById[state.moduleId], state.rows, state.mode);
  root.innerHTML = layout(state, content);
  const footer = document.querySelector(".top-actions");
  if (footer) footer.insertAdjacentHTML("beforeend", accountButton(state));
  root.querySelectorAll("[data-module]").forEach((button) => button.addEventListener("click", () => {
    state.moduleId = button.dataset.module;
    loadModule();
  }));
  root.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.mode === state.mode) return;
    state.mode = button.dataset.mode;
    refreshStores();
  }));
  const select = document.getElementById("store");
  if (select) select.addEventListener("change", () => {
    state.storeId = select.value;
    loadModule();
  });
  const form = document.getElementById("login-form");
  if (form) form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true; button.textContent = "Autenticando...";
    const email = form.querySelector("#email").value.trim();
    const password = form.querySelector("#password").value;
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) {
      state.error = "Não foi possível entrar: " + error.message;
      render();
    }
  });
  const signout = document.getElementById("signout");
  if (signout) signout.addEventListener("click", async () => {
    const {error} = await supabase.auth.signOut();
    if (error) { state.error = "Não foi possível encerrar a sessão: " + error.message; render(); }
  });
}
initialize();
