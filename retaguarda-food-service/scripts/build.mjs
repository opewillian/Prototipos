import { readdir, readFile, mkdir, rm, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const checkOnly = process.argv.includes("--check");

async function listFiles(dir) {
  const all = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) all.push(...await listFiles(filename));
    else if (entry.isFile()) all.push(filename);
  }
  return all;
}
async function assertExists(file) {
  try { await access(file); }
  catch { throw Error("Arquivo ausente: " + path.relative(root, file)); }
}
const jsFiles = (await listFiles(path.join(root, "src"))).filter(name => name.endsWith(".js"));
for (const file of jsFiles) {
  const contents = await readFile(file, "utf8");
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (checked.status !== 0) throw Error("Erro de sintaxe em " + path.relative(root, file) + "\n" + checked.stderr);
  const regex = new RegExp("(?:import|export)\\s+(?:[^'\\\"]*?\\s+from\\s+)?['\\\"](\\.[^'\\\"]+)['\\\"]", "g");
  for (const match of contents.matchAll(regex)) {
    const candidate = path.resolve(path.dirname(file), match[1]);
    await assertExists(candidate);
  }
}
for (const required of ["index.html", "assets/app.css", "assets/shell.css", "assets/brand/logo-mft.png", "src/main.js", "src/core/supabase.js"]) {
  await assertExists(path.join(root, required));
}
const config = await readFile(path.join(root, "src/core/config.js"), "utf8");
if (!config.includes("sb_publishable_")) throw Error("Chave publicável do Supabase ausente.");
if (config.includes("sb_secret_") || config.includes("SERVICE_ROLE =") || config.includes("service_role =") || config.includes("SUPABASE_SECRET_KEY =")) throw Error("Possível segredo no frontend.");
const html = await readFile(path.join(root, "index.html"), "utf8");
if (!html.includes("./src/main.js")) throw Error("index.html não aponta para o app.");
console.log("Verificação concluída:", jsFiles.length, "arquivos JavaScript.");
if (checkOnly) process.exit(0);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(path.join(root, "index.html"), path.join(output, "index.html"));
async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}
await copyDirectory(path.join(root, "src"), path.join(output, "src"));
await copyDirectory(path.join(root, "assets"), path.join(output, "assets"));
console.log("Arquivos gerados em", output);
