export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
export function money(value) {
  return new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(Number(value || 0));
}
export function dateBR(value) {
  if (!value) return "—";
  const date = String(value).slice(0,10);
  const parts = date.split("-");
  return parts.length === 3 ? parts.reverse().join("/") : String(value);
}
export function displayValue(value, kind) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "money") return money(value);
  if (kind === "date") return dateBR(value);
  if (kind === "boolean") return value ? "Sim" : "Não";
  return String(value);
}
