// PROTÓTIPO descartável: carrega os dados, monta a variante de ?variante= e a barra de troca.
// Contrato de cada variante (variante-x.js): export const nome; export function montar(raiz, dados, { valores }).
import { iniciar } from "../../comum/comum.js";

const VARIANTES = ["A", "B", "C"];
const url = new URL(location.href);
let atual = VARIANTES.includes(url.searchParams.get("variante")) ? url.searchParams.get("variante") : "A";

const dados = await (await fetch("../data/completude.json")).json();
iniciar({ referencia: dados.referencia });

// Índices prontos para as variantes (não alteram o JSON).
dados.porId = new Map(dados.grupos.map((g) => [g.id, g]));
dados.filhos = new Map();
for (const g of dados.grupos) {
  if (!dados.filhos.has(g.pai)) dados.filhos.set(g.pai, []);
  dados.filhos.get(g.pai).push(g);
}
for (const l of dados.filhos.values()) l.sort((a, b) => b.especies - a.especies);

let cacheValores;
const valores = () => (cacheValores ??= fetch("../data/valores.json").then((r) => r.json()));

async function mostrar(v) {
  atual = v;
  url.searchParams.set("variante", v);
  history.replaceState(null, "", url);
  const mod = await import(`./variante-${v.toLowerCase()}.js`);
  document.getElementById("css-variante").href = `variante-${v.toLowerCase()}.css`;
  const raiz = document.getElementById("variante");
  raiz.replaceChildren();
  raiz.className = `variante-${v.toLowerCase()}`;
  mod.montar(raiz, dados, { valores });
  document.getElementById("rotulo").textContent = `${v} (${mod.nome})`;
}

const passo = (d) => mostrar(VARIANTES[(VARIANTES.indexOf(atual) + d + VARIANTES.length) % VARIANTES.length]);
document.getElementById("anterior").onclick = () => passo(-1);
document.getElementById("proxima").onclick = () => passo(1);
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if (e.key === "ArrowLeft") passo(-1);
  if (e.key === "ArrowRight") passo(1);
});
mostrar(atual);
