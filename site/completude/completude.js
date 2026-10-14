// Completude de cada grupo da fauna brasileira: matriz com a árvore de grupos nas linhas e os 18 atributos nas colunas,
// gaveta de detalhe do grupo e Domínio de Valores (valores.json, carregado sob demanda).
import { iniciar } from "../comum/comum.js";

const N = (n) => n.toLocaleString("pt-BR");
const soma = (v) => v.reduce((s, x) => s + x, 0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Percentual que nunca arredonda para 100% sem estar completo, nem para 0% havendo algum preenchido.
function pct(p, a, dec = 0) {
  if (!a) return "—";
  let r = (p / a) * 100;
  if (dec === 0) {
    r = Math.round(r);
    if (p < a) r = Math.min(r, 99);
    return p > 0 && r === 0 ? "<1%" : r + "%";
  }
  const f = 10 ** dec;
  r = Math.round(r * f) / f;
  if (p < a) r = Math.min(r, 100 - 1 / f);
  return r.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + "%";
}
// classe de cor: na = não se aplica, f = nenhum preenchido, q1..q5 = rampa de completude
const cls = (p, a) => (!a ? "na" : p === 0 ? "f" : "q" + Math.max(1, Math.round((p / a) * 5)));

const RANK = { FILO: "filo", CLASSE: "classe", ORDEM: "ordem", SUB_ORDEM: "subordem", FAMILIA: "família", SUB_FAMILIA: "subfamília", TRIBO: "tribo",
  GENERO: "gênero", SUB_GENERO: "subgênero", ESPECIE: "espécie", SUB_CLASSE: "subclasse", INFRA_ORDEM: "infraordem", SUPER_FAMILIA: "superfamília",
  SUPER_CLASSE: "superclasse", SUB_TRIBO: "subtribo", SUPER_ORDEM: "superordem", INFRA_CLASSE: "infraclasse" };
const DISP = { INDISPONIVEL: "indisponível", DISPONIVEL: "disponível", SEM_VALOR: "sem valor" };

const plural = (n, s, p) => `${N(n)} ${n === 1 ? s : p}`;
const barra = (p, a) => `<span class="bar"><i class="${cls(p, a)}" style="width:${a ? (p / a) * 100 : 0}%"></i></span>`;

function nomesHTML(ac, si, nv, det = "") {
  const tt = ac + si + nv;
  return `<div class="emp" role="img" aria-label="${N(ac)} aceitos, ${N(si)} sinônimos, ${N(nv)} não validados"><i class="ac" style="flex:${ac}"></i><i class="si" style="flex:${si}"></i>${nv ? `<i class="nvd" style="flex:${nv}"></i>` : ""}</div>
<ul class="leg"><li><b>Nome validado</b> ${N(ac + si)} (${pct(ac + si, tt, 1)}): <i class="sw ac"></i>aceitos ${N(ac)}, <i class="sw si"></i>sinônimos ${N(si)}</li>
<li class="alerta"><i class="sw nvd"></i><b>Nome não validado</b> ${N(nv)} (${pct(nv, tt, 1)})${det}</li></ul>`;
}

// ---- dados ----
const raiz = document.querySelector("main");
const dados = await (await fetch("data/completude.json")).json();
iniciar({ referencia: dados.referencia });

const { atributos, dominios, total, nomes, grupos } = dados;
const porId = new Map(grupos.map((g) => [g.id, g]));
const filhos = new Map();
for (const g of grupos) {
  if (!filhos.has(g.pai)) filhos.set(g.pai, []);
  filhos.get(g.pai).push(g);
}
let cacheValores;
const valores = () => (cacheValores ??= fetch("data/valores.json").then((r) => r.json()));

const nA = atributos.length;
const ini = atributos.map((a, i) => i === 0 || a.dominio !== atributos[i - 1].dominio);
const idxAttr = new Map(atributos.map((a, i) => [a.id, i]));

// pseudo-grupo "toda a fauna" (id -1) para a linha global fixa e a gaveta global
const GLOBAL = { id: -1, nome: "Toda a fauna", rank: null, pai: null, especies: nomes.aceitos, especies_diretas: nomes.aceitos, p: total.p, a: total.a,
  sinonimos: nomes.sinonimos, nao_validados: soma(Object.values(nomes.nao_validados)) };
const todos = new Map(porId).set(-1, GLOBAL);
const T = new Map([...todos].map(([id, g]) => [id, { p: soma(g.p), a: soma(g.a) }]));
const nomeN = new Map(grupos.map((g) => [g.id, norm(g.nome)]));
const dom = dominios.map((_, d) => atributos.map((x, i) => (x.dominio === d ? i : -1)).filter((i) => i >= 0));

// ---- estado ----
let ordem = { k: "especies", d: -1 };
const expandidos = new Set();
let busca = "", linhas = [], renderizados = 0, ativo = null, sel = null, col = -1;
const CHUNK = 60;

// ---- esqueleto ----
const gt = T.get(-1);
const bandas = dom.map((ids, d) => `<span class="banda ini d${d % 2}" style="width:calc(${ids.length} * 1.4rem + ${ids.length - 1} * 2px)" title="${esc(dominios[d])}">${esc(dominios[d])}</span>`).join("");
const nvDet = Object.entries(nomes.nao_validados).map(([k, n]) => `${DISP[k] ?? k} ${N(n)}`).join(", ");
raiz.innerHTML = `
<section class="faixa" aria-label="Resumo da fauna">
  <div class="bloco comp"><span class="rot">Completude da fauna brasileira</span><strong>${pct(gt.p, gt.a, 1)}</strong>
    <span>${N(gt.p)} de ${N(gt.a)} atributos preenchidos em ${N(nomes.aceitos)} espécies aceitas</span>
    <small>${dados.fora_da_nota.map((f) => `${esc(f.nome)}: ${esc(f.motivo)}, fora da nota`).join("; ")}. <a href="metodo.html">Sobre e método</a></small></div>
  <div class="bloco nomesbl"><span class="rot">Nomes no catálogo</span>${nomesHTML(nomes.aceitos, nomes.sinonimos, GLOBAL.nao_validados, `: ${nvDet}`)}</div>
</section>
<div class="ferr">
  <label class="busca">Buscar grupo <input type="search" placeholder="Nome do grupo, por exemplo Aves" autocomplete="off"></label>
  <span class="info" aria-live="polite"></span>
  <button type="button" class="recolher">Recolher tudo</button>
  <a href="#dv-global" class="ir-dv">Domínio de Valores global</a>
</div>
<p class="ajuda">Clique na seta ou use as setas do teclado para expandir e recolher. Enter ou clique na linha abre o detalhe do grupo. Shift com as setas percorre as colunas.</p>
<div class="matriz" role="treegrid" aria-label="Completude por grupo e atributo"><div class="lista">
  <div class="cab">
    <div class="l bandas"><span class="nm"></span><span class="esp"></span><span class="tot"></span>${bandas}<span class="sin"></span><span class="nv"></span></div>
    <div class="l nomes"><span class="nm th" role="columnheader"><button type="button" data-k="nome">Grupo</button></span>
      <span class="esp th" role="columnheader"><button type="button" data-k="especies">Espécies</button></span>
      <span class="tot th" role="columnheader"><button type="button" data-k="total">Completude</button></span>
      ${atributos.map((a, i) => `<span class="at${ini[i] ? " ini" : ""}" data-i="${i}"><span>${esc(a.nome)}</span></span>`).join("")}
      <span class="sin th" role="columnheader"><button type="button" data-k="sinonimos">Sinônimos</button></span>
      <span class="nv th" role="columnheader"><button type="button" data-k="nao_validados">Não validados</button></span></div>
    <div class="l global" data-id="-1" role="row" tabindex="0">${linhaMiolo(GLOBAL, 0, true)}</div>
  </div>
  <div class="corpo"></div>
  <p class="vazio" hidden>Nenhum grupo encontrado.</p>
</div></div>
<p class="legenda"><span><i class="c f"></i>nenhum preenchido</span><span><i class="c q1"></i><i class="c q2"></i><i class="c q3"></i><i class="c q4"></i><i class="c q5"></i>de poucos a todos preenchidos</span><span><i class="c na"></i>não se aplica</span></p>
<section class="gl" id="dv-global"><details><summary>Domínio de Valores de toda a fauna</summary><div class="gl-corpo"><p class="mut">Carregando os valores…</p></div></details></section>
<aside class="gaveta" role="complementary" aria-label="Detalhe do grupo" hidden></aside>
<div class="dica" role="tooltip" hidden></div>`;

const $ = (s) => raiz.querySelector(s);
const cont = $(".matriz"), corpo = $(".corpo"), gaveta = $(".gaveta"), dica = $(".dica"), vazio = $(".vazio");
const entrada = $(".busca input"), info = $(".info"), btnRecolher = $(".recolher");

// ---- linhas ----
function linhaMiolo(g, n, global = false) {
  const t = T.get(g.id), kids = filhos.get(g.id)?.length;
  const seta = global || busca ? "" : kids ? (expandidos.has(g.id) ? "▾" : "▸") : "";
  const sub = busca ? `${RANK[g.rank] ?? ""}${g.pai != null ? ", em " + porId.get(g.pai).nome : ""}` : "";
  let c = "";
  for (let i = 0; i < nA; i++) c += `<i class="c ${cls(g.p[i], g.a[i])}${ini[i] ? " ini" : ""}" data-i="${i}"></i>`;
  return `<span class="nm" style="--n:${Math.min(n, 10)}"><span class="seta">${seta}</span><span class="t" title="${esc(g.nome)}${g.rank ? ", " + RANK[g.rank] : ""}">${esc(g.nome)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</span>` +
    `<span class="esp">${N(g.especies)}</span><span class="tot" data-i="t"><i class="c ${cls(t.p, t.a)}"></i><b>${pct(t.p, t.a)}</b></span>${c}` +
    `<span class="sin">${N(g.sinonimos)}</span><span class="nv${g.nao_validados ? " tem" : ""}">${N(g.nao_validados)}</span>`;
}
function linhaHTML({ g, n }) {
  const t = T.get(g.id), kids = filhos.get(g.id)?.length;
  return `<div class="l${sel === g.id ? " sel" : ""}" role="row" data-id="${g.id}" aria-level="${n + 1}"${kids && !busca ? ` aria-expanded="${expandidos.has(g.id)}"` : ""} tabindex="${g.id === ativo ? 0 : -1}" aria-label="${esc(g.nome)}, ${N(g.especies)} espécies, completude ${pct(t.p, t.a)}">${linhaMiolo(g, n)}</div>`;
}

const val = { nome: (g) => g.nome, especies: (g) => g.especies, total: (g) => (T.get(g.id).a ? T.get(g.id).p / T.get(g.id).a : -1),
  sinonimos: (g) => g.sinonimos, nao_validados: (g) => g.nao_validados };
function cmp(x, y) {
  const a = val[ordem.k](x), b = val[ordem.k](y);
  return ((typeof a === "string" ? a.localeCompare(b, "pt-BR") : a - b) || x.nome.localeCompare(y.nome, "pt-BR")) * ordem.d;
}

function construir() {
  linhas = [];
  if (busca) {
    const q = norm(busca);
    for (const g of grupos) if (nomeN.get(g.id).includes(q)) linhas.push({ g, n: 0 });
    linhas.sort((x, y) => cmp(x.g, y.g));
  } else {
    const desce = (lista, n) => {
      for (const g of [...lista].sort(cmp)) {
        linhas.push({ g, n });
        if (expandidos.has(g.id)) desce(filhos.get(g.id) ?? [], n + 1);
      }
    };
    desce(filhos.get(null), 0);
  }
  if (!linhas.some((l) => l.g.id === ativo)) ativo = linhas[0]?.g.id ?? null;
  info.textContent = busca ? plural(linhas.length, "grupo encontrado", "grupos encontrados") : `${N(linhas.length)} de ${N(grupos.length)} grupos visíveis`;
  btnRecolher.disabled = !expandidos.size || !!busca;
  vazio.hidden = linhas.length > 0;
}
function renderizar() {
  const n = Math.max(renderizados, CHUNK);
  corpo.innerHTML = linhas.slice(0, n).map(linhaHTML).join("");
  renderizados = Math.min(n, linhas.length);
  preencher();
}
function renderMais() {
  if (renderizados >= linhas.length) return;
  const fim = Math.min(linhas.length, renderizados + CHUNK);
  corpo.insertAdjacentHTML("beforeend", linhas.slice(renderizados, fim).map(linhaHTML).join(""));
  renderizados = fim;
}
// rolagem infinita. ponytail: renderiza em blocos e nunca descarta; 4.154 linhas expandidas ainda cabem no DOM
function preencher() {
  while (renderizados < linhas.length && cont.scrollHeight - cont.scrollTop - cont.clientHeight < 600) renderMais();
}
cont.addEventListener("scroll", preencher, { passive: true });

const linhaEl = (id) => corpo.querySelector(`.l[data-id="${id}"]`);
function alternar(id, abrir = !expandidos.has(id)) {
  abrir ? expandidos.add(id) : expandidos.delete(id);
  ativo = id;
  construir();
  renderizar();
  linhaEl(id)?.focus({ preventScroll: true });
}
function mostrarNaArvore(id) {
  entrada.value = busca = "";
  for (let p = porId.get(id)?.pai; p != null; p = porId.get(p).pai) expandidos.add(p);
  ativo = id;
  construir();
  renderizados = linhas.findIndex((l) => l.g.id === id) + CHUNK;
  renderizar();
  const el = linhaEl(id);
  el?.scrollIntoView({ block: "center", inline: "nearest" });
  el?.focus({ preventScroll: true });
}

// ---- ordenação e busca ----
function marcarOrdem() {
  raiz.querySelectorAll(".th").forEach((th) => {
    const k = th.firstElementChild.dataset.k;
    th.setAttribute("aria-sort", k === ordem.k ? (ordem.d > 0 ? "ascending" : "descending") : "none");
  });
}
entrada.addEventListener("input", () => {
  busca = entrada.value.trim();
  renderizados = 0;
  construir();
  cont.scrollTop = 0;
  renderizar();
});
btnRecolher.onclick = () => {
  expandidos.clear();
  construir();
  renderizar();
};
$(".ir-dv").addEventListener("click", (e) => {
  e.preventDefault();
  const d = $(".gl details");
  d.open = true;
  d.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- tooltip ----
function texto(g, i) {
  if (i === "t") {
    const t = T.get(g.id);
    return `Completude total: ${t.a ? `${pct(t.p, t.a)} (${N(t.p)} de ${N(t.a)})` : "não se aplica"}`;
  }
  const p = g.p[i], a = g.a[i], nm = atributos[i].nome;
  return a ? `${nm}: ${N(p)} de ${N(a)} (${pct(p, a)})` : `${nm}: não se aplica`;
}
function mostrarDica(alvo) {
  const l = alvo.closest(".l[data-id]");
  const i = alvo.dataset.i === "t" ? "t" : +alvo.dataset.i;
  dica.textContent = texto(l ? todos.get(+l.dataset.id) : GLOBAL, i) + (l ? "" : ", em toda a fauna");
  dica.hidden = false;
  const r = alvo.getBoundingClientRect(), d = dica.getBoundingClientRect();
  dica.style.left = Math.max(4, Math.min(innerWidth - d.width - 4, r.left + r.width / 2 - d.width / 2)) + "px";
  dica.style.top = (r.top - d.height - 6 < 4 ? r.bottom + 6 : r.top - d.height - 6) + "px";
}
function limparColuna() {
  col = -1;
  dica.hidden = true;
  cont.querySelector(".foco")?.classList.remove("foco");
}
function mostrarColuna() {
  cont.querySelector(".foco")?.classList.remove("foco");
  const l = document.activeElement?.closest?.(".l[data-id]");
  const c = l?.querySelector(`[data-i="${col}"]`);
  if (!c) return limparColuna();
  c.classList.add("foco");
  c.scrollIntoView({ block: "nearest", inline: "nearest" });
  mostrarDica(c);
}
cont.addEventListener("mouseover", (e) => {
  const c = e.target.closest?.("[data-i]");
  c ? mostrarDica(c) : (dica.hidden = true);
});
cont.addEventListener("mouseleave", () => (dica.hidden = true));
cont.addEventListener("focusout", (e) => {
  if (!cont.contains(e.relatedTarget)) limparColuna();
});
cont.addEventListener("scroll", () => (dica.hidden = true), { passive: true });

// ---- cliques e teclado na matriz ----
cont.addEventListener("click", (e) => {
  const b = e.target.closest("[data-k]:not([data-i])");
  if (b) {
    const k = b.dataset.k;
    ordem = ordem.k === k ? { k, d: -ordem.d } : { k, d: k === "nome" ? 1 : -1 };
    marcarOrdem();
    construir();
    cont.scrollTop = 0;
    renderizar();
    return;
  }
  const l = e.target.closest(".l[data-id]");
  if (!l) return;
  const id = +l.dataset.id;
  if (e.target.closest(".seta") && l.hasAttribute("aria-expanded")) alternar(id);
  else abrir(id);
});
cont.addEventListener("focusin", (e) => {
  const l = e.target.closest?.(".corpo .l");
  if (l && +l.dataset.id !== ativo) {
    linhaEl(ativo)?.setAttribute("tabindex", "-1");
    ativo = +l.dataset.id;
    l.tabIndex = 0;
  }
  if (col >= 0) mostrarColuna();
});
cont.addEventListener("keydown", (e) => {
  const l = e.target.closest?.(".l[data-id]");
  if (!l || e.altKey || e.ctrlKey || e.metaKey) return;
  const id = +l.dataset.id, k = e.key;
  const vai = (el) => {
    el?.focus();
    e.preventDefault();
  };
  if (k === "Enter" || k === " ") return abrir(id), e.preventDefault();
  if (!corpo.contains(l)) return;
  if (e.shiftKey && (k === "ArrowRight" || k === "ArrowLeft")) {
    col = Math.max(0, Math.min(nA - 1, col + (k === "ArrowRight" ? 1 : -1)));
    mostrarColuna();
    return e.preventDefault();
  }
  switch (k) {
    case "ArrowDown":
      if (!l.nextElementSibling) renderMais();
      return vai(l.nextElementSibling);
    case "ArrowUp": return vai(l.previousElementSibling);
    case "Home": return vai(corpo.firstElementChild);
    case "ArrowRight":
      if (!busca && filhos.get(id)?.length) expandidos.has(id) ? vai(l.nextElementSibling) : alternar(id, true);
      return e.preventDefault();
    case "ArrowLeft":
      if (!busca) {
        if (expandidos.has(id)) alternar(id, false);
        else if (todos.get(id).pai != null) vai(linhaEl(todos.get(id).pai));
      }
      return e.preventDefault();
  }
});
raiz.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (col >= 0 || !dica.hidden) limparColuna();
  else if (sel != null) fechar();
});

// ---- Domínio de Valores (carga sob demanda) ----
function campoHTML(c, obj, a, maxLinhas) {
  const attr = atributos[idxAttr.get(c.atributo)].nome;
  const cab = `<h4>${esc(c.nome)} <small>atributo ${esc(attr)}</small></h4>`;
  if (!a) return `<section class="campo">${cab}<p class="mut">Não se aplica: nenhuma espécie aplicável.</p></section>`;
  const com = obj[""] ?? 0;
  const ent = Object.entries(obj).filter(([k]) => k !== "").sort((x, y) => y[1] - x[1]);
  const max = ent[0]?.[1] || 1;
  const nunca = c.check.filter((v) => !(v in obj));
  const li = ([v, n]) => `<li title="${esc(v)}: ${N(n)} de ${N(a)} espécies aplicáveis (${pct(n, a, 1)})"><span class="v">${esc(v === "VAZIO" ? "VAZIO (não informado)" : v)}</span><span class="bar"><i style="width:${Math.min(100, (n / max) * 100)}%"></i></span><span class="num">${N(n)}</span></li>`;
  const resto = ent.slice(maxLinhas);
  return `<section class="campo">${cab}
<p class="cobre">${pct(com, a, 1)} com valor <span class="mut">(${N(com)} de ${N(a)} espécies aplicáveis)</span></p>${barra(com, a)}
${ent.length ? `<ul class="vals">${ent.slice(0, maxLinhas).map(li).join("")}</ul>` : `<p class="mut">Nenhuma espécie com valor.</p>`}
${resto.length ? `<details class="mais"><summary>Mais ${N(resto.length)} valores usados</summary><ul class="vals">${resto.map(li).join("")}</ul></details>` : ""}
${nunca.length ? `<details class="nunca"${nunca.length <= 6 ? " open" : ""}><summary>Nunca usados: ${N(nunca.length)} de ${N(c.check.length)} valores</summary><p class="chips">${nunca.map((v) => `<span>${esc(v)}</span>`).join("")}</p></details>` : ""}</section>`;
}
const falhou = (alvo) => (alvo.innerHTML = `<p class="mut">Não foi possível carregar os valores.</p>`);

const glDet = $(".gl details");
glDet.addEventListener("toggle", () => {
  if (!glDet.open || glDet.dataset.ok) return;
  glDet.dataset.ok = 1;
  const alvo = $(".gl-corpo");
  valores().then((v) => {
    const nunca = v.campos.reduce((s, c) => s + c.check.filter((x) => !(x in (v.global[c.id] ?? {}))).length, 0);
    alvo.innerHTML = `<p class="intro">Para cada coluna com lista de valores permitidos, quantas espécies usam cada valor. Valores permitidos que nenhuma espécie usa aparecem em vermelho: ${N(nunca)} no total.</p>
<div class="cartoes">${v.campos.map((c) => campoHTML(c, v.global[c.id] ?? {}, total.a[idxAttr.get(c.atributo)], 10)).join("")}</div>`;
  }, () => falhou(alvo));
});

// ---- gaveta ----
function gavetaHTML(g) {
  const t = T.get(g.id), glob = g.id === -1;
  const trilha = [];
  for (let p = g.pai; p != null; p = porId.get(p).pai) trilha.unshift(porId.get(p));
  const nSub = filhos.get(g.id)?.length ?? 0;
  const doms = dom.map((ids, d) => {
    const p = soma(ids.map((i) => g.p[i])), a = soma(ids.map((i) => g.a[i]));
    return `<li><span>${esc(dominios[d])}</span>${barra(p, a)}<span class="r">${a ? `${pct(p, a)} (${N(p)} de ${N(a)})` : "não se aplica"}</span></li>`;
  }).join("");
  const atrs = dom.map((ids, d) => `<h4>${esc(dominios[d])}</h4><ul class="atrs">${ids.map((i) => {
    const p = g.p[i], a = g.a[i];
    return `<li><span>${esc(atributos[i].nome)}</span>${barra(p, a)}<span class="r${a ? "" : " mut"}">${a ? `${N(p)} de ${N(a)} (${pct(p, a)})` : "não se aplica"}</span></li>`;
  }).join("")}</ul>`).join("");
  return `<div class="g-topo"><div><h3>${esc(g.nome)}</h3><p class="mut">${glob ? "Todas as espécies aceitas do catálogo" : `${RANK[g.rank] ?? g.rank}, ${plural(g.especies, "espécie aceita", "espécies aceitas")}${nSub ? `, ${plural(nSub, "subgrupo direto", "subgrupos diretos")}` : ""}`}</p></div>
<button type="button" class="fechar" aria-label="Fechar detalhe">Fechar</button></div>
${trilha.length ? `<nav class="trilha" aria-label="Posição na taxonomia">${trilha.map((x) => `<button type="button" data-ir="${x.id}">${esc(x.nome)}</button>`).join("")}</nav>` : ""}
${glob ? "" : `<div class="acoes"><button type="button" class="ver-esp">Ver as ${plural(g.especies, "espécie", "espécies")}</button>
<button type="button" class="arvore" data-arv="${g.id}">Mostrar na árvore</button></div>`}
<div class="g-comp"><span class="rot">Completude${glob ? "" : " do grupo"}</span><strong>${pct(t.p, t.a, 1)}</strong><span class="mut">${N(t.p)} de ${N(t.a)} atributos preenchidos</span>${barra(t.p, t.a)}</div>
${glob ? "" : `<p class="dir"><b>Espécies diretas</b> ${g.especies_diretas ? `${pct(g.diretas[0], g.diretas[1])} (${N(g.diretas[0])} de ${N(g.diretas[1])}), ${plural(g.especies_diretas, "espécie", "espécies")}` : "— nenhuma espécie direta, só subgrupos"}</p>`}
<h4>Por domínio</h4><ul class="atrs doms">${doms}</ul>
<h4 class="h-nomes">Nomes</h4>${nomesHTML(g.especies, g.sinonimos, g.nao_validados, glob ? `: ${nvDet}` : "")}
<details class="sec" open><summary>Os ${nA} atributos</summary>${atrs}</details>
<details class="sec" open><summary>Domínio de Valores</summary><div class="vals-corpo"><p class="mut">Carregando os valores…</p></div></details>
${glob ? "" : `<details class="sec" open><summary>Espécies</summary><div class="especies">
<p class="mut">Todas as espécies aceitas da subárvore, das menos completas para as mais completas.</p>
<div class="esp-filtros"><input type="search" class="esp-busca" placeholder="Buscar espécie" aria-label="Buscar espécie">
<select class="esp-falta" aria-label="Filtrar por atributo faltante"><option value="-1">Qualquer atributo</option>${atributos.map((a, i) => `<option value="${i}">Falta: ${esc(a.nome)}</option>`).join("")}</select></div>
<p class="esp-info mut">Carregando as espécies…</p><ul class="esp-lista"></ul></div></details>`}`;
}

// ---- espécies do grupo (um arquivo por filo, carregado sob demanda) ----
const cacheFilo = new Map();
const especiesDoFilo = (f) => cacheFilo.get(f) ?? cacheFilo.set(f, fetch(`data/especies/${f}.json`).then((r) => {
  if (!r.ok) throw new Error(r.status);
  return r.json();
}).then((l) => l.map(([nome, g, s]) => {
  const p = s.split("p").length - 1, a = nA - (s.split("n").length - 1);
  return { nome, g, s, p, a, n: norm(nome) };
}))).get(f);

function especies(g) {
  let filo = g;
  while (filo.pai != null) filo = porId.get(filo.pai);
  const sub = new Set([g.id]);
  for (const id of sub) for (const f of filhos.get(id) ?? []) sub.add(f.id);
  const alvo = gaveta.querySelector(".especies"), info = alvo.querySelector(".esp-info"), lista = alvo.querySelector(".esp-lista");
  const busca = alvo.querySelector(".esp-busca"), falta = alvo.querySelector(".esp-falta"), secao = alvo.parentElement;
  especiesDoFilo(filo.id).then((todas) => {
    if (sel !== g.id) return;
    const doGrupo = todas.filter((e) => sub.has(e.g)).sort((x, y) => x.p / x.a - y.p / y.a || x.nome.localeCompare(y.nome));
    let vis = [], feitas = 0;
    const linha = (e) => `<li><span class="esp-nome"><i>${esc(e.nome)}</i>${e.g === g.id ? "" : ` <span class="mut">· ${esc(porId.get(e.g).nome)}</span>`}</span>${barra(e.p, e.a)}<span class="r">${pct(e.p, e.a)} (${e.p} de ${e.a})</span>
${e.p < e.a ? `<span class="esp-faltam mut">Falta: ${[...e.s].flatMap((c, i) => (c === "f" ? [esc(atributos[i].nome)] : [])).join(", ")}</span>` : ""}</li>`;
    // ponytail: rolagem infinita em blocos sem descarte; Arthropoda (111 mil) só chega ao fim se o leitor rolar tudo
    const mais = () => {
      if (!secao.open) return; // seção recolhida: a lista não tem altura e carregaria tudo
      while (feitas < vis.length && lista.scrollHeight - lista.scrollTop - lista.clientHeight < 400) {
        lista.insertAdjacentHTML("beforeend", vis.slice(feitas, feitas + CHUNK).map(linha).join(""));
        feitas += CHUNK;
      }
    };
    const filtrar = () => {
      const q = norm(busca.value.trim()), i = +falta.value;
      vis = doGrupo.filter((e) => (!q || e.n.includes(q)) && (i < 0 || e.s[i] === "f"));
      feitas = 0;
      lista.innerHTML = "";
      lista.scrollTop = 0;
      info.textContent = vis.length === doGrupo.length ? plural(doGrupo.length, "espécie", "espécies") : `${N(vis.length)} de ${plural(doGrupo.length, "espécie", "espécies")}`;
      mais();
    };
    busca.addEventListener("input", filtrar);
    falta.addEventListener("change", filtrar);
    lista.addEventListener("scroll", mais, { passive: true });
    secao.addEventListener("toggle", mais);
    filtrar();
  }).catch(() => {
    cacheFilo.delete(filo.id);
    if (sel === g.id) info.textContent = "Não foi possível carregar as espécies.";
  });
}
function abrir(id) {
  sel = id;
  cont.querySelector(".sel")?.classList.remove("sel");
  cont.querySelector(`.l[data-id="${id}"]`)?.classList.add("sel");
  const g = todos.get(id);
  raiz.classList.add("aberta");
  gaveta.hidden = false;
  gaveta.innerHTML = gavetaHTML(g);
  gaveta.scrollTop = 0;
  if (id !== -1) especies(g);
  const alvo = gaveta.querySelector(".vals-corpo");
  valores().then((v) => {
    if (sel !== id) return;
    const obj = id === -1 ? v.global : v.grupos[id] ?? {};
    alvo.innerHTML = `<p class="mut">Quantas espécies do grupo usam cada valor. Valores nunca usados aparecem em vermelho.</p>` +
      v.campos.map((c) => campoHTML(c, obj[c.id] ?? {}, g.a[idxAttr.get(c.atributo)], 8)).join("");
  }, () => falhou(alvo));
}
function fechar() {
  sel = null;
  cont.querySelector(".sel")?.classList.remove("sel");
  raiz.classList.remove("aberta");
  gaveta.hidden = true;
  if (gaveta.contains(document.activeElement)) linhaEl(ativo)?.focus();
}
gaveta.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.classList.contains("fechar")) fechar();
  else if (b.dataset.ir) abrir(+b.dataset.ir);
  else if (b.dataset.arv) mostrarNaArvore(+b.dataset.arv);
  else if (b.classList.contains("ver-esp")) {
    const s = gaveta.querySelector(".especies").parentElement;
    s.open = true;
    s.scrollIntoView({ behavior: "smooth" });
  }
});

marcarOrdem();
construir();
renderizar();
