import { iniciar } from "../comum/comum.js";

const D = await (await fetch("data/grafo.json")).json();
iniciar({ referencia: D.referencia });

// ---------- dados ----------
const G = new Map(D.grupos.map((g) => [g.id, g]));
const U = new Map(D.usuarios.map((u) => [u.id, u]));
const juntar = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
const filhos = new Map(), vincG = new Map(), vincU = new Map();
for (const g of D.grupos) if (g.pai != null) juntar(filhos, g.pai, g.id);
for (const v of D.vinculos) { juntar(vincG, v.g, v); juntar(vincU, v.u, v); }

const ESTADO = { orfao: "Órfão", risco: "Em risco", ativo: "Ativo", agregador: "Agregador" };
const PERFIL = { COORDENADOR: "Coordenação", COLABORADOR: "Colaboração", SOMENTE_AUTORIA: "Só autoria" };
const RANK = { FILO: "filo", SUPER_CLASSE: "superclasse", CLASSE: "classe", SUB_CLASSE: "subclasse", INFRA_CLASSE: "infraclasse",
  SUPER_ORDEM: "superordem", ORDEM: "ordem", SUB_ORDEM: "subordem", INFRA_ORDEM: "infraordem", PARVORDEM: "parvordem",
  SUPER_FAMILIA: "superfamília", FAMILIA: "família", SUB_FAMILIA: "subfamília", TRIBO: "tribo", SUB_TRIBO: "subtribo",
  GENERO: "gênero", SUB_GENERO: "subgênero", ESPECIE: "espécie", DIVISAO: "divisão", REINO: "reino" };
const { ativo: CA, risco: CR } = D.cortes_anos;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (n) => n.toLocaleString("pt-BR");
const data = (d) => d.split("-").reverse().join("/");
const nomeU = (id) => { const u = U.get(id); return esc(u.nome) + (u.instituicao ? ` <span class="meta">(${esc(u.instituicao)})</span>` : ""); };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const orfaosAbaixo = new Map();
const contar = (id) => {
  if (!orfaosAbaixo.has(id)) {
    let n = 0;
    for (const f of filhos.get(id) ?? []) n += (G.get(f).estado === "orfao") + contar(f);
    orfaosAbaixo.set(id, n);
  }
  return orfaosAbaixo.get(id);
};
const estadosAbaixo = (id) => {
  const c = { ativo: 0, risco: 0, orfao: 0 }, pilha = [...(filhos.get(id) ?? [])];
  while (pilha.length) { const x = pilha.pop(); if (G.get(x).estado in c) c[G.get(x).estado]++; pilha.push(...(filhos.get(x) ?? [])); }
  return c;
};
// espécies dos grupos vinculados (filtrados por perfil), sem contar duas vezes grupos aninhados
const espGrupos = (uid, ok) => {
  const ids = new Set((vincU.get(uid) ?? []).filter((v) => ok(v.perfil)).map((v) => v.g));
  let n = 0;
  for (const id of ids) { let p = G.get(id).pai; while (p != null && !ids.has(p)) p = G.get(p).pai; if (p == null) n += G.get(id).especies; }
  return n;
};
// coordenação direta: as espécies diretas de cada grupo vão aos coordenadores do grupo coordenado mais próximo
// (o próprio grupo ou um ancestral), divididas igualmente se houver mais de um. Soma de todos = catálogo.
const coordDe = new Map(), direta = new Map(), diretaPorGrupo = new Map();
for (const v of D.vinculos) if (v.perfil === "COORDENADOR") juntar(coordDe, v.g, v.u);
for (const g of D.grupos) {
  let x = g.id; while (x != null && !coordDe.has(x)) x = G.get(x).pai;
  if (x == null || !g.especies_diretas) continue;
  const us = coordDe.get(x), n = g.especies_diretas / us.length;
  for (const u of us) {
    direta.set(u, (direta.get(u) ?? 0) + n);
    const m = diretaPorGrupo.get(u) ?? diretaPorGrupo.set(u, new Map()).get(u);
    m.set(x, (m.get(x) ?? 0) + n);
  }
}
const espDireta = (uid) => Math.round(direta.get(uid) ?? 0);
// abrangência: todas as espécies dos grupos que a pessoa coordena, incluindo subgrupos com coordenador próprio
const abrangencia = (uid) => espGrupos(uid, (p) => p === "COORDENADOR");
const miniBarra = (d, a) => `<span class="mini" title="${num(d)} de ${num(a)} espécies"><i style="width:${a ? Math.min(100, d / a * 100) : 0}%"></i></span>`;
const destaqueEsp = (uid) => {
  const a = abrangencia(uid), d = espDireta(uid);
  if (!a) return `<p class="esp-total">Não coordena grupos</p>`;
  return `<p class="esp-total"><b>${num(d)}</b> espécies em coordenação direta</p>` +
    `<p class="abr-linha">${miniBarra(d, a)} abrangência: ${num(a)} espécies nos grupos que coordena</p>`;
};
const dicaPessoa = (uid) => abrangencia(uid) ? `${num(espDireta(uid))} em coordenação direta · ${num(abrangencia(uid))} de abrangência` : "não coordena grupos";

// ---------- abertura ----------
const total = D.grupos.reduce((c, g) => ((c[g.estado] = (c[g.estado] ?? 0) + 1), c), {});
const spOrfas = D.grupos.filter((g) => g.estado === "orfao").reduce((s, g) => s + g.especies_diretas, 0);
document.getElementById("lead").innerHTML =
  `Cada um dos ${num(D.grupos.length)} grupos taxonômicos do catálogo deve ter um coordenador. Em ${num(total.orfao)} deles ninguém exerce
   essa função; eles reúnem ${num(spOrfas)} espécies. <a href="metodo.html">Sobre e método</a>`;
const DESC = { orfao: `sem coordenador, ou sem edição há mais de ${CR} anos`, risco: `última edição entre ${CA} e ${CR} anos atrás`,
  ativo: `coordenador editou no último ano`, agregador: "sem coordenador próprio; os subgrupos têm" };
const PLURAL = { orfao: "órfãos", risco: "em risco", ativo: "ativos", agregador: "agregadores" };
document.getElementById("estados").innerHTML = Object.keys(ESTADO).map((e) =>
  `<li title="${ESTADO[e]}: ${DESC[e]}"><i class="${e}"></i><b>${num(total[e] ?? 0)}</b> ${PLURAL[e]}<span class="sr">: ${DESC[e]}</span></li>`).join("");

// ---------- explicação de um grupo ----------
function porque(g) {
  if (g.estado === "agregador") {
    const c = estadosAbaixo(g.id);
    return `Nenhum taxonomista coordena <b>${esc(g.nome)}</b> como um todo, mas seus subgrupos têm coordenação própria:
      ${num(c.ativo)} ativos, ${num(c.risco)} em risco e ${num(c.orfao)} órfãos.`;
  }
  const cn = g.coordenado_por != null ? G.get(g.coordenado_por) : null;
  if (!cn) return `Nenhum taxonomista coordena <b>${esc(g.nome)}</b>, nem os grupos acima ou abaixo dele.`;
  const quem = (vincG.get(cn.id) ?? []).filter((v) => v.perfil === "COORDENADOR").map((v) => esc(U.get(v.u).nome)).join(", ");
  const onde = cn.id === g.id ? "do próprio grupo" : `de ${RANK[cn.rank] ?? ""} <b>${esc(cn.nome)}</b>, o grupo coordenado mais próximo acima`;
  const quando = g.ultima_edicao
    ? `A última edição dessa coordenação em ${esc(cn.nome)} foi em ${data(g.ultima_edicao)}.`
    : `Essa coordenação não editou registros de ${esc(cn.nome)} desde o início do histórico do catálogo (2015).`;
  return `Quem responde por <b>${esc(g.nome)}</b> é a coordenação ${onde}: ${quem}. ${quando}`;
}
function painelGrupo(el, g) {
  const vs = vincG.get(g.id) ?? [];
  const blocos = Object.keys(PERFIL).map((p) => {
    const l = vs.filter((v) => v.perfil === p).map((v) => `<li><button class="link" data-u="${v.u}">${nomeU(v.u)}</button></li>`).join("");
    return l && `<h3>${PERFIL[p]} neste grupo</h3><ul>${l}</ul>`;
  }).join("");
  el.innerHTML = `<h2>${esc(g.nome)}</h2>
    <p class="meta">${RANK[g.rank] ?? ""} · ${num(g.especies)} espécies · <span class="estado ${g.estado}">${ESTADO[g.estado]}</span></p>
    <p class="porque">${porque(g)}</p>${blocos || "<h3>Vínculos diretos</h3><p>Nenhum taxonomista ligado diretamente a este grupo.</p>"}`;
}
function painelPessoa(el, uid) {
  const u = U.get(uid), vs = vincU.get(uid) ?? [];
  el.innerHTML = `<h2>${esc(u.nome)}</h2>${destaqueEsp(uid)}<p class="meta">${esc(u.instituicao ?? "Instituição não informada")}</p>` +
    Object.keys(PERFIL).map((p) => {
      const l = vs.filter((v) => v.perfil === p).map((v) => { const g = G.get(v.g);
        return `<li><button class="link" data-g="${g.id}">${esc(g.nome)}</button> <span class="estado ${g.estado}">${ESTADO[g.estado]}</span></li>`; }).join("");
      return l && `<h3>${PERFIL[p]}</h3><ul>${l}</ul>`;
    }).join("");
}

// ---------- estilo do grafo ----------
const tamanho = (g) => Math.min(70, 14 + Math.sqrt(g.especies) * 1.6);
const estilo = () => [
  { selector: "node", style: { label: "data(label)", "font-size": 11, color: css("--fg"), "text-valign": "bottom", "text-margin-y": 4,
    "text-wrap": "wrap", "text-max-width": 130, width: "data(size)", height: "data(size)", "background-color": (n) => css(`--${n.data("estado")}`),
    "min-zoomed-font-size": 7, "text-outline-color": css("--bg"), "text-outline-width": 2 } },
  { selector: "node[kind='pessoa']", style: { shape: "round-rectangle", "background-color": css("--pessoa"), width: 14, height: 14 } },
  { selector: "node[?proprio]", style: { "border-width": 3, "border-color": css("--fg") } },
  { selector: "node[estado='orfao']", style: { "border-width": 3, "border-style": "dashed", "border-color": css("--orfao"), "background-opacity": 0.85 } },
  { selector: "node[?foco]", style: { "font-size": 14, "font-weight": 700 } },
  { selector: "edge", style: { width: 1.2, "line-color": css("--line"), "curve-style": "bezier" } },
  { selector: "edge[perfil='COORDENADOR']", style: { width: 3, "line-color": css("--pessoa") } },
  { selector: "edge[perfil='COLABORADOR']", style: { width: 1.5, "line-color": css("--pessoa"), opacity: 0.5 } },
  { selector: "edge[perfil='SOMENTE_AUTORIA']", style: { "line-style": "dotted", "line-color": css("--pessoa"), opacity: 0.5 } },
];
const noGrupo = (g, extra = {}) => ({ data: { id: `g${g.id}`, gid: g.id, kind: "grupo", label: g.nome, size: tamanho(g), estado: g.estado, proprio: g.proprio, ...extra } });
const noPessoa = (uid) => ({ data: { id: `u${uid}`, uid, kind: "pessoa", label: U.get(uid).nome } });
const cytoOpts = (id) => ({ container: document.getElementById(id), style: estilo(), wheelSensitivity: 0.3, minZoom: 0.2, maxZoom: 3 });

// ---------- vista 1: lista + foco ----------
const filtroEstado = document.getElementById("filtro-estado");
filtroEstado.innerHTML += Object.entries(ESTADO).map(([e, r]) =>
  `<label><input type="checkbox" value="${e}" ${e === "orfao" || e === "risco" ? "checked" : ""}> ${r}</label>`).join("");
const filtroPerfil = document.getElementById("filtro-perfil");
filtroPerfil.innerHTML += Object.entries(PERFIL).map(([p, r]) =>
  `<label><input type="checkbox" value="${p}" checked> ${r}</label>`).join("");
const lista = document.getElementById("lista"), painel = document.getElementById("painel"), busca = document.getElementById("busca");
const cyF = cytoscape(cytoOpts("cy-foco"));
let focoAtual = null;

// lista em árvore colapsável (como em completude/): grupos que passam no filtro + seus ancestrais como contexto
const expandidos = new Set();
function listar() {
  const t = busca.value.trim().toLocaleLowerCase("pt-BR");
  const estados = new Set([...filtroEstado.querySelectorAll("input:checked")].map((i) => i.value));
  let gs;
  const pessoas = t ? D.usuarios.filter((u) => u.nome.toLocaleLowerCase("pt-BR").includes(t)) : [];
  if (t) {
    const s = new Set(D.grupos.filter((g) => g.nome.toLocaleLowerCase("pt-BR").includes(t)));
    for (const u of pessoas) for (const v of vincU.get(u.id) ?? []) s.add(G.get(v.g));
    gs = [...s];
  } else gs = D.grupos.filter((g) => estados.has(g.estado));
  document.getElementById("pessoas-busca").innerHTML = pessoas.length && pessoas.length <= 3 ? pessoas.map((u) =>
    `<div class="pessoa-busca"><b>${esc(u.nome)}</b>${destaqueEsp(u.id)}</div>`).join("") : "";
  const achados = new Set(gs.map((g) => g.id)), visiveis = new Set(achados);
  for (const g of gs) for (let p = g.pai; p != null && !visiveis.has(p); p = G.get(p).pai) visiveis.add(p);
  const aberto = (id) => t || expandidos.has(id); // com busca, tudo aberto até os achados
  const linhas = [];
  const desce = (ids, n) => {
    for (const id of ids.filter((x) => visiveis.has(x)).sort((a, b) => G.get(b).especies - G.get(a).especies)) {
      const kids = (filhos.get(id) ?? []).filter((x) => visiveis.has(x));
      linhas.push({ g: G.get(id), n, kids: kids.length });
      if (kids.length && aberto(id)) desce(kids, n + 1);
    }
  };
  desce(D.grupos.filter((g) => g.pai == null).map((g) => g.id), 0);
  document.getElementById("contagem").textContent = `${num(gs.length)} grupos${t ? ` para “${busca.value.trim()}”` : ""}.`;
  // ponytail: render único; 4.154 linhas no pior caso ainda cabem no DOM
  lista.innerHTML = linhas.map(({ g, n, kids }) => `<tr tabindex="0" data-g="${g.id}" aria-level="${n + 1}"${kids ? ` aria-expanded="${!!aberto(g.id)}"` : ""}${achados.has(g.id) ? "" : ' class="contexto"'} ${g.id === focoAtual ? 'aria-current="true"' : ""}>
    <td style="padding-left:${0.3 + n * 0.9}rem"><span class="seta">${kids && !t ? (aberto(g.id) ? "▾" : "▸") : ""}</span><span class="ponto" style="background:var(--${g.estado})"></span>${esc(g.nome)}<span class="sr"> (${ESTADO[g.estado]})</span></td>
    <td>${RANK[g.rank] ?? ""}</td><td class="num">${num(g.especies)}</td></tr>`).join("");
}
function alternar(id, abrir = !expandidos.has(id)) {
  abrir ? expandidos.add(id) : expandidos.delete(id);
  listar();
  lista.querySelector(`tr[data-g="${id}"]`)?.focus({ preventScroll: true });
}

function focar(id, { rolar = false } = {}) {
  const g = G.get(id); if (!g) return;
  focoAtual = id;
  const perfis = new Set([...filtroPerfil.querySelectorAll("input:checked")].map((i) => i.value));
  const els = [], vistos = new Set();
  const addG = (x, extra) => { if (!vistos.has(`g${x.id}`)) { vistos.add(`g${x.id}`); els.push(noGrupo(x, extra)); } };
  const aresta = (a, b, extra = {}) => els.push({ data: { id: `${a}-${b}-${extra.perfil ?? "t"}`, source: a, target: b, ...extra } });
  addG(g, { foco: true });
  for (let p = g; p.pai != null && p.id !== g.coordenado_por;) { const pai = G.get(p.pai); addG(pai); aresta(`g${pai.id}`, `g${p.id}`); p = pai; }
  const ligar = (gid, ok) => (vincG.get(gid) ?? []).filter(ok).forEach((v) => {
    if (!vistos.has(`u${v.u}`)) { vistos.add(`u${v.u}`); els.push(noPessoa(v.u)); }
    aresta(`u${v.u}`, `g${gid}`, { perfil: v.perfil });
  });
  ligar(g.id, (v) => perfis.has(v.perfil));
  if (g.coordenado_por != null && g.coordenado_por !== g.id) ligar(g.coordenado_por, (v) => v.perfil === "COORDENADOR");
  for (const f of (filhos.get(id) ?? []).slice(0, 40)) { addG(G.get(f)); aresta(`g${id}`, `g${f}`); }
  cyF.elements().remove(); cyF.add(els);
  cyF.layout({ name: "concentric", concentric: (n) => (n.data("foco") ? 3 : n.data("kind") === "pessoa" ? 2 : 1), levelWidth: () => 1,
    minNodeSpacing: els.length > 80 ? 8 : 28, fit: true, padding: 30, animate: false }).run();
  enquadrar(cyF);
  painelGrupo(painel, g);
  lista.querySelectorAll("tr[aria-current]").forEach((tr) => tr.removeAttribute("aria-current"));
  let tr = lista.querySelector(`tr[data-g="${id}"]`);
  if (!tr && !busca.value.trim()) { for (let p = g.pai; p != null; p = G.get(p).pai) expandidos.add(p); listar(); tr = lista.querySelector(`tr[data-g="${id}"]`); }
  tr?.setAttribute("aria-current", "true"); if (rolar) tr?.scrollIntoView({ block: "nearest" });
  const url = new URL(location); url.searchParams.delete("u"); url.searchParams.set("g", id); history.replaceState(null, "", url);
}

function focarPessoa(uid) {
  if (!U.has(uid)) return;
  const perfis = new Set([...filtroPerfil.querySelectorAll("input:checked")].map((i) => i.value));
  const vs = (vincU.get(uid) ?? []).filter((v) => perfis.has(v.perfil));
  const els = [{ data: { ...noPessoa(uid).data, foco: true } }];
  for (const v of vs) {
    if (!els.some((e) => e.data.id === `g${v.g}`)) els.push(noGrupo(G.get(v.g)));
    els.push({ data: { id: `u${uid}-g${v.g}-${v.perfil}`, source: `u${uid}`, target: `g${v.g}`, perfil: v.perfil } });
  }
  cyF.elements().remove(); cyF.add(els);
  cyF.layout({ name: "concentric", concentric: (n) => (n.data("foco") ? 2 : 1), levelWidth: () => 1, minNodeSpacing: 24, fit: true, padding: 30, animate: false }).run();
  enquadrar(cyF);
  painelPessoa(painel, uid);
  const url = new URL(location); url.searchParams.delete("g"); url.searchParams.set("u", uid); history.replaceState(null, "", url);
}

// busca com sugestões (combobox ARIA)
const sug = document.getElementById("sugestoes");
const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const INDICE = [
  ...D.grupos.map((g) => ({ tipo: "g", id: g.id, nome: g.nome, n: norm(g.nome), extra: RANK[g.rank] ?? "", estado: g.estado, peso: g.especies })),
  ...D.usuarios.map((u) => ({ tipo: "u", id: u.id, nome: u.nome, n: norm(u.nome), extra: u.instituicao ?? "taxonomista", peso: vincU.get(u.id)?.length ?? 0 })),
];
let opcoes = [], ativa = -1;
const realcar = (nome, t) => { const i = norm(nome).indexOf(t); return i < 0 ? esc(nome) : esc(nome.slice(0, i)) + `<mark>${esc(nome.slice(i, i + t.length))}</mark>` + esc(nome.slice(i + t.length)); };
function fecharSug() { sug.hidden = true; busca.setAttribute("aria-expanded", "false"); busca.removeAttribute("aria-activedescendant"); ativa = -1; }
function sugerir() {
  const t = norm(busca.value.trim());
  if (t.length < 2) return fecharSug();
  opcoes = INDICE.filter((o) => o.n.includes(t)).sort((a, b) => b.n.startsWith(t) - a.n.startsWith(t) || b.peso - a.peso).slice(0, 12);
  ativa = -1;
  sug.innerHTML = opcoes.map((o, i) => `<li role="option" id="sug-${i}" aria-selected="false" data-i="${i}">
      <span class="ponto${o.tipo === "u" ? " pessoa" : ""}"${o.tipo === "g" ? ` style="background:var(--${o.estado})"` : ""}></span>
      <span>${realcar(o.nome, t)}</span><span class="tipo">${o.tipo === "g" ? esc(o.extra) : `taxonomista · ${esc(o.extra)}`}</span></li>`).join("")
    || `<li class="vazio" role="option" aria-disabled="true">Nenhum grupo ou taxonomista com esse nome</li>`;
  sug.hidden = false; busca.setAttribute("aria-expanded", "true");
}
function mover(d) {
  if (!opcoes.length) return;
  ativa = (ativa + d + opcoes.length) % opcoes.length;
  sug.querySelectorAll("[role=option]").forEach((li, i) => li.setAttribute("aria-selected", i === ativa));
  busca.setAttribute("aria-activedescendant", `sug-${ativa}`);
  document.getElementById(`sug-${ativa}`).scrollIntoView({ block: "nearest" });
}
function selecionar(i) {
  const o = opcoes[i]; if (!o) return;
  fecharSug(); busca.value = o.nome; listar();
  o.tipo === "g" ? focar(o.id, { rolar: true }) : focarPessoa(o.id);
}
busca.addEventListener("input", () => { listar(); sugerir(); });
busca.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (sug.hidden) sugerir(); mover(e.key === "ArrowDown" ? 1 : -1); }
  else if (e.key === "Enter" && !sug.hidden) { e.preventDefault(); selecionar(Math.max(ativa, 0)); }
  else if (e.key === "Escape") fecharSug();
});
busca.addEventListener("blur", () => setTimeout(fecharSug, 150));
sug.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); selecionar(+li.dataset.i); } });

filtroEstado.addEventListener("change", listar);
filtroPerfil.addEventListener("change", () => {
  const u = new URL(location).searchParams.get("u");
  u ? focarPessoa(+u) : focoAtual != null && focar(focoAtual);
});
lista.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-g]"); if (!tr) return;
  e.target.closest(".seta") && tr.hasAttribute("aria-expanded") && !busca.value.trim() ? alternar(+tr.dataset.g) : focar(+tr.dataset.g);
});
lista.addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr[data-g]"); if (!tr) return;
  const id = +tr.dataset.g, livre = !busca.value.trim();
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focar(id); }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); (e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling)?.focus(); }
  if (e.key === "ArrowRight" && livre && tr.hasAttribute("aria-expanded")) { e.preventDefault(); expandidos.has(id) ? tr.nextElementSibling?.focus() : alternar(id, true); }
  if (e.key === "ArrowLeft" && livre) {
    e.preventDefault();
    if (expandidos.has(id)) alternar(id, false);
    else lista.querySelector(`tr[data-g="${G.get(id).pai}"]`)?.focus();
  }
});
painel.addEventListener("click", (e) => {
  const b = e.target.closest("button.link"); if (!b) return;
  b.dataset.g ? focar(+b.dataset.g, { rolar: true }) : focarPessoa(+b.dataset.u);
});
cyF.on("tap", "node", (e) => e.target.data("kind") === "pessoa" ? focarPessoa(e.target.data("uid")) : focar(e.target.data("gid"), { rolar: true }));
// número de espécies ao passar o mouse sobre um nó
function dicaNos(cy, dica) {
  cy.on("mouseover", "node", (e) => {
    const d = e.target.data(), p = e.target.renderedPosition();
    if (d.kind === "pessoa") dica.innerHTML = `<b>${esc(U.get(d.uid).nome)}</b><br>${dicaPessoa(d.uid)}`;
    else { const g = G.get(d.gid); dica.innerHTML = `<b>${esc(g.nome)}</b><br>${num(g.especies)} espécies` + (g.especies_diretas != null ? ` (${num(g.especies_diretas)} diretas)` : ""); }
    dica.hidden = false;
    dica.style.left = p.x + 12 + "px"; dica.style.top = p.y + 12 + "px";
  });
  cy.on("mouseout", "node", () => (dica.hidden = true));
  cy.on("viewport tap", () => (dica.hidden = true));
}
dicaNos(cyF, document.querySelector("#cy-foco + .dica-no"));

// largura da coluna da lista: arrastar o divisor (ou setas no teclado); guardada no navegador
const colLista = document.querySelector(".coluna-lista"), divisor = document.querySelector(".divisor");
const largura = (px) => { px = Math.max(240, Math.min(innerWidth * 0.6, px)); colLista.style.width = px + "px"; cyF.resize(); localStorage.setItem("grafo-largura-lista", Math.round(px)); };
if (localStorage.getItem("grafo-largura-lista")) largura(+localStorage.getItem("grafo-largura-lista"));
divisor.addEventListener("pointerdown", (e) => {
  const x0 = e.clientX, w0 = colLista.offsetWidth;
  divisor.setPointerCapture(e.pointerId); divisor.classList.add("arrastando");
  const mover = (ev) => largura(w0 + ev.clientX - x0);
  divisor.addEventListener("pointermove", mover);
  divisor.addEventListener("pointerup", () => { divisor.removeEventListener("pointermove", mover); divisor.classList.remove("arrastando"); }, { once: true });
});
divisor.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); largura(colLista.offsetWidth + (e.key === "ArrowRight" ? 24 : -24)); }
});

// enquadra tudo, sem ampliar demais grafos pequenos
function enquadrar(cy) {
  cy.fit(undefined, 30);
  if (cy.zoom() > 1.2) { cy.zoom(1.2); cy.center(); }
}
// zoom e reinício do enquadramento
function controlesZoom(el, obterCy) {
  el.innerHTML = `<button type="button" data-z="1.4" aria-label="Aproximar">+</button>
    <button type="button" data-z="0.7" aria-label="Afastar">−</button>
    <button type="button" class="reset" data-z="0" aria-label="Reiniciar enquadramento">Reset</button>`;
  el.addEventListener("click", (e) => {
    const z = e.target.closest("button")?.dataset.z, cy = obterCy();
    if (z === undefined || !cy) return;
    if (+z === 0) enquadrar(cy);
    else cy.zoom({ level: cy.zoom() * z, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  });
}

// ---------- vista 2: árvore radial ----------
const filos = D.grupos.filter((g) => g.pai == null);
G.set(0, { id: 0, nome: "Animalia", rank: "REINO", especies: filos.reduce((s, g) => s + g.especies, 0), estado: "raiz" });
filhos.set(0, filos.map((g) => g.id));
contar(0);
let cyA = null;
const abertos = new Set([0]);
// Árvore radial: cada grupo aberto ocupa um setor proporcional às folhas visíveis abaixo dele.
function desenharArvore(foco) {
  const els = [];
  const folhas = (id) => (abertos.has(id) && filhos.has(id) ? filhos.get(id).reduce((s, f) => s + folhas(f), 0) : 1);
  const prof = (id) => (abertos.has(id) && filhos.has(id) ? 1 + Math.max(...filhos.get(id).map(prof)) : 0);
  const R = Math.max(180, (folhas(0) * 95) / (2 * Math.PI * Math.max(1, prof(0)))); // ~95 px por folha no anel externo
  const visitar = (id, prof, a0, a1) => {
    const g = G.get(id), esc_ = !abertos.has(id) && orfaosAbaixo.get(id), a = (a0 + a1) / 2;
    els.push({ ...noGrupo(g, { label: g.nome + (esc_ ? ` [${esc_} órfãos]` : "") }),
      position: { x: prof * R * Math.cos(a), y: prof * R * Math.sin(a) } });
    if (!abertos.has(id)) return;
    const fs = filhos.get(id) ?? [], total = fs.reduce((s, f) => s + folhas(f), 0);
    let ini = a0;
    for (const f of fs) {
      const fim = ini + ((a1 - a0) * folhas(f)) / total;
      visitar(f, prof + 1, ini, fim); ini = fim;
      els.push({ data: { id: `t${id}-${f}`, source: `g${id}`, target: `g${f}` } });
    }
  };
  visitar(0, 0, 0, 2 * Math.PI);
  cyA.elements().remove(); cyA.add(els); cyA.resize();
  cyA.layout({ name: "preset", padding: 20 }).run();
}
// navegação: cada clique guarda o estado anterior para "Voltar"; "Raiz" fecha tudo
const passos = [], ajudaArvore = document.getElementById("painel-arvore").innerHTML;
let painelArvoreId = null;
const btVoltar = document.getElementById("arvore-voltar"), btRaiz = document.getElementById("arvore-raiz");
function mostrarNaArvore(abertosNovos, painelId) {
  abertos.clear(); abertosNovos.forEach((a) => abertos.add(a));
  desenharArvore(); enquadrar(cyA);
  painelArvoreId = painelId;
  const pa = document.getElementById("painel-arvore");
  painelId ? painelGrupo(pa, G.get(painelId)) : (pa.innerHTML = ajudaArvore);
  btVoltar.disabled = !passos.length; btRaiz.disabled = abertos.size === 1;
}
const navegar = (abertosNovos, painelId) => { passos.push([[...abertos], painelArvoreId]); mostrarNaArvore(abertosNovos, painelId); };
btVoltar.addEventListener("click", () => passos.length && mostrarNaArvore(...passos.pop()));
btRaiz.addEventListener("click", () => navegar([0], painelArvoreId));
function abrirArvore() {
  if (cyA) return;
  cyA = cytoscape(cytoOpts("cy-arvore"));
  dicaNos(cyA, document.querySelector("#cy-arvore + .dica-no"));
  cyA.on("tap", "node", (e) => {
    const id = e.target.data("gid");
    if (!id) return;
    const novos = new Set(abertos);
    if (filhos.has(id)) novos.has(id) ? novos.delete(id) : novos.add(id);
    navegar(novos, id);
  });
  desenharArvore();
}

// ---------- abas, tema e estado inicial ----------
const abas = { "aba-lista": "vista-lista", "aba-arvore": "vista-arvore", "aba-taxonomistas": "vista-taxonomistas", "aba-distribuicao": "vista-distribuicao" };
function mostrarAba(id) {
  for (const [a, v] of Object.entries(abas)) {
    document.getElementById(a).setAttribute("aria-selected", a === id);
    document.getElementById(v).hidden = a !== id;
  }
  if (id === "aba-arvore") abrirArvore(); else cyF.resize();
}
document.querySelector(".abas").addEventListener("click", (e) => e.target.id in abas && mostrarAba(e.target.id));
document.querySelector(".abas").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const ids = Object.keys(abas), outra = ids[(ids.indexOf(e.target.id) + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
  mostrarAba(outra); document.getElementById(outra).focus();
});

// ---------- vista 3: taxonomistas ----------
// grupo de exibição: classe (ou filo, acima de classe) do grupo onde a pessoa tem mais coordenação direta;
// sem coordenação, o maior grupo com qualquer vínculo
const classeDe = (gid) => { let g = G.get(gid); while (g.rank !== "CLASSE" && g.pai != null) g = G.get(g.pai); return g.id; };
const hoje = new Date(D.referencia);
const estadoData = (d) => { const anos = (hoje - new Date(d)) / 3.15576e10; return anos < CA ? "ativo" : anos < CR ? "risco" : "orfao"; };
const LINHAS = [...vincU.keys()].filter((uid) => U.has(uid)).map((uid) => {
  const vs = vincU.get(uid), coord = vs.filter((v) => v.perfil === "COORDENADOR");
  const porG = [...(diretaPorGrupo.get(uid) ?? [])].sort((a, b) => b[1] - a[1]);
  const principal = porG[0]?.[0] ?? vs.reduce((m, v) => G.get(v.g).especies > G.get(m).especies ? v.g : m, vs[0].g);
  const datas = coord.map((v) => v.ultima_edicao).filter(Boolean).sort();
  return { uid, nome: U.get(uid).nome, direta: espDireta(uid), abr: abrangencia(uid),
    nCoord: coord.length, nColab: vs.filter((v) => v.perfil === "COLABORADOR").length,
    divisao: Math.max(1, ...porG.map(([g]) => coordDe.get(g).length)), atividade: datas.at(-1) ?? "",
    classe: classeDe(principal) };
});
const LUID = new Map(LINHAS.map((l) => [l.uid, l]));
const coordenadores = LINHAS.filter((l) => l.direta > 0).sort((a, b) => b.direta - a.direta);
const maxDireta = coordenadores[0]?.direta || 1;

// ---------- vista 4: distribuição (coordenação direta × abrangência) ----------
// duas faixas de pontos (beeswarm), um ponto por coordenador em cada faixa, mesma escala log
const dist = document.getElementById("dist-faixa"), distEu = document.getElementById("dist-eu");
const porAbr = LINHAS.filter((l) => l.abr > 0).sort((a, b) => b.abr - a.abr);
const med = (xs, k) => xs[xs.length >> 1]?.[k] ?? 0;
// atividade: última edição da pessoa como coordenadora (mesmos cortes dos grupos); sem data = sem edição registrada
const atv = (l) => l.atividade ? estadoData(l.atividade) : "agregador";
const ATV = { ativo: "Ativo: editou no último ano", risco: `${CA} a ${CR} anos sem editar`, orfao: `Inativo: mais de ${CR} anos sem editar`, agregador: "Sem edição registrada" };
{ // quantas pessoas cobrem metade das espécies em coordenação direta; quanto está com coordenadores inativos
  const soma = coordenadores.reduce((s, l) => s + l.direta, 0); let acc = 0, n = 0;
  for (const l of coordenadores) { acc += l.direta; n++; if (acc >= soma / 2) break; }
  const por = Object.fromEntries(Object.keys(ATV).map((k) => [k, { n: 0, esp: 0 }]));
  for (const l of coordenadores) { por[atv(l)].n++; por[atv(l)].esp += l.direta; }
  const pct = (x, t) => `${Math.round(x / t * 100)}%`;
  document.getElementById("dist-lead").textContent = `${num(n)} pessoas fazem a coordenação direta de metade das espécies do catálogo. ` +
    `Mediana: ${num(med(coordenadores, "direta"))} espécies em coordenação direta e ${num(med(porAbr, "abr"))} de abrangência por coordenador ` +
    `(${num(coordenadores.length)} coordenadores). ${num(por.orfao.n)} coordenadores (${pct(por.orfao.n, coordenadores.length)}) estão inativos, ` +
    `sem editar há mais de ${CR} anos, e têm ${num(por.orfao.esp)} espécies (${pct(por.orfao.esp, soma)}) em coordenação direta.`;
  document.getElementById("dist-legenda").innerHTML = Object.entries(ATV).filter(([k]) => por[k].n).map(([k, r]) =>
    `<button type="button" data-k="${k}" aria-pressed="true" title="Clique para esconder ou mostrar"><i class="ponto ${k}"></i> ${r} ` +
    `<span class="meta">${num(por[k].n)} pessoas · ${num(por[k].esp)} espécies diretas</span></button>`).join("");
}
const DW = 1000, DX0 = 40, DX1 = 970, DR = 4.5, PASSO = 9.5, maxEsp = Math.max(porAbr[0]?.abr ?? 1, maxDireta);
const xLog = (v) => DX0 + (DX1 - DX0) * Math.log10(Math.max(v, 1)) / Math.log10(maxEsp);
const posDist = { direta: new Map(), abr: new Map() }; // uid → {x, y}, para ligar a mesma pessoa nas duas faixas
function faixaDist(k, xs, rotulo, Y0) {
  const postos = [];
  const pts = [...xs].reverse().map((l) => { // menores primeiro: os grandes ficam por cima
    const x = xLog(l[k]); let y = 0;
    for (let i = 1; postos.some((p) => Math.abs(p.x - x) < PASSO && Math.abs(p.y - y) < PASSO); i++) y = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * PASSO;
    postos.push({ x, y });
    return { l, x, y };
  });
  const alt = Math.max(...postos.map((p) => Math.abs(p.y))) + DR, Y = Y0 + alt + 22, md = med(xs, k);
  for (const p of pts) posDist[k].set(p.l.uid, { x: p.x, y: Y + p.y });
  const svg = `<text class="ini" x="${DX0}" y="${Y - alt - 8}">${rotulo}</text>` +
    `<line class="mediana" x1="${xLog(md)}" x2="${xLog(md)}" y1="${Y - alt}" y2="${Y + alt}"/>` +
    `<text x="${xLog(md)}" y="${Y - alt - 8}">mediana ${num(md)}</text>` +
    pts.map(({ l, x, y }) => `<circle class="${k} ${atv(l)}" cx="${x.toFixed(1)}" cy="${Y + y}" r="${DR}" data-u="${l.uid}">` +
      `<title>${esc(l.nome)}: ${num(l.direta)} em coordenação direta · ${num(l.abr)} de abrangência · ${ATV[atv(l)]}</title></circle>`).join("");
  return { svg, fim: Y + alt + 10 };
}
{
  const a = faixaDist("direta", coordenadores, "Coordenação direta", 0), b = faixaDist("abr", porAbr, "Abrangência", a.fim), y = b.fim;
  const ticks = [1, 10, 100, 1000, 10000, 100000].filter((t) => t <= maxEsp).map((t) =>
    `<line x1="${xLog(t)}" x2="${xLog(t)}" y1="${y}" y2="${y + 4}"/><text x="${xLog(t)}" y="${y + 17}">${num(t)}</text>`).join("");
  dist.innerHTML = a.svg + b.svg + `<line class="liga" visibility="hidden"/><line class="eixo" x1="${DX0}" x2="${DX1}" y1="${y}" y2="${y}"/>${ticks}` +
    `<text class="fim" x="${DX1}" y="${y + 34}">espécies (escala log)</text>`;
  dist.setAttribute("viewBox", `0 0 ${DW} ${y + 40}`);
}
function marcarDist(uid) {
  for (const c of dist.querySelectorAll("circle.eu")) c.classList.remove("eu");
  for (const c of dist.querySelectorAll(`circle[data-u="${uid}"]`)) { c.classList.add("eu"); c.parentNode.append(c); } // traz para frente
  const a = posDist.direta.get(uid), b = posDist.abr.get(uid), liga = dist.querySelector(".liga");
  liga.setAttribute("visibility", a && b ? "visible" : "hidden");
  if (a && b) { liga.setAttribute("x1", a.x); liga.setAttribute("y1", a.y); liga.setAttribute("x2", b.x); liga.setAttribute("y2", b.y); dist.append(liga); }
  const l = LUID.get(uid), acima = coordenadores.filter((x) => x.direta < l.direta).length;
  distEu.innerHTML = `<h2 class="dist-nome">${esc(l.nome)}</h2>` +
    `<p class="meta">${esc(U.get(uid).instituicao ?? "Instituição não informada")} · ${esc(G.get(l.classe).nome)}</p>` +
    (l.abr ? `<p><span class="estado ${atv(l)}">${ATV[atv(l)]}</span>${l.atividade ? ` <span class="meta">última edição em ${data(l.atividade)}</span>` : ""}</p>` : "") +
    (l.abr ? `<div class="dist-num"><p class="direta"><b>${num(l.direta)}</b>coordenação direta</p><p class="abr"><b>${num(l.abr)}</b>abrangência</p></div>` +
      `<p>${Math.round(l.direta / l.abr * 100)}% da abrangência é coordenação direta.` +
      (l.direta ? ` Tem mais coordenação direta que ${Math.round(acima / coordenadores.length * 100)}% dos coordenadores.` : "") + `</p>`
      : `<p>Não coordena grupos.</p>`) +
    `<button type="button" class="botao" data-u="${uid}">Ver na tabela de taxonomistas →</button>`;
}
dist.addEventListener("click", (e) => { const c = e.target.closest("circle[data-u]"); if (c) { marcarDist(+c.dataset.u); distAchar.value = ""; } });
const distAchar = document.getElementById("dist-achar");
distEu.addEventListener("click", (e) => { const b = e.target.closest("button[data-u]"); if (b) { mostrarAba("aba-taxonomistas"); selecionarTax(+b.dataset.u); } });
document.getElementById("dist-legenda").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-k]"); if (!b) return;
  b.setAttribute("aria-pressed", dist.classList.toggle("oculta-" + b.dataset.k) ? "false" : "true");
});

const tabTax = document.getElementById("tabela-taxonomistas"), agrupar = document.getElementById("tax-agrupar");
const achar = document.getElementById("tax-achar"), eu = document.getElementById("tax-eu");
const ROTULO = new Map(LINHAS.map((l) => [l.nome + (U.get(l.uid).instituicao ? ` (${U.get(l.uid).instituicao})` : ""), l.uid]));
document.getElementById("tax-nomes").innerHTML = [...ROTULO.keys()].map((n) => `<option value="${esc(n)}">`).join("");
let ordem = { col: "direta", desc: true }, selecionado = null;
const fechados = new Set();
const cmp = (a, b) => {
  const { col, desc } = ordem, s = desc ? -1 : 1;
  const r = col === "nome" || col === "atividade" ? a[col].localeCompare(b[col], "pt-BR") : a[col] - b[col];
  return s * r || a.nome.localeCompare(b.nome, "pt-BR");
};
const linhaTax = (l) => `<tr data-u="${l.uid}"${l.uid === selecionado ? ' aria-current="true"' : ""}>` +
  `<td><a href="?u=${l.uid}">${nomeU(l.uid)}</a></td>` +
  `<td class="barra-cel">${l.direta ? `<span class="barra"><i style="width:${l.direta / maxDireta * 100}%"></i></span>` : ""}` +
  `<span class="num">${num(l.direta)}</span>${l.divisao > 1 ? ` <span class="div" title="coordenação dividida entre ${l.divisao} pessoas">÷${l.divisao}</span>` : ""}</td>` +
  `<td>${l.abr ? `${miniBarra(l.direta, l.abr)} <span class="meta">${num(l.direta)} / ${num(l.abr)}</span>` : ""}</td>` +
  `<td class="num">${num(l.nCoord)}</td><td class="num">${num(l.nColab)}</td>` +
  `<td>${l.atividade ? `<i class="ponto ${estadoData(l.atividade)}" title="${ESTADO[estadoData(l.atividade)]}"></i> ${data(l.atividade)}` : '<span class="meta">—</span>'}</td></tr>`;
function ordenarTax() {
  for (const th of tabTax.querySelectorAll("th[data-col]"))
    th.setAttribute("aria-sort", th.dataset.col === ordem.col ? (ordem.desc ? "descending" : "ascending") : "none");
  const ls = [...LINHAS].sort(cmp);
  if (agrupar.value !== "classe") { tabTax.tBodies[0].innerHTML = ls.map(linhaTax).join(""); return; }
  const grupos = new Map();
  for (const l of ls) juntar(grupos, l.classe, l);
  const soma = (xs) => xs.reduce((s, l) => s + l.direta, 0);
  tabTax.tBodies[0].innerHTML = [...grupos].sort((a, b) => soma(b[1]) - soma(a[1])).map(([c, xs]) => {
    const aberto = !fechados.has(c);
    return `<tr class="grupo-tax"><th colspan="6" scope="rowgroup"><button type="button" data-c="${c}" aria-expanded="${aberto}">` +
      `${aberto ? "▾" : "▸"} ${esc(G.get(c).nome)}</button> <span class="meta">${num(xs.length)} pessoas, ${num(xs.filter((l) => l.direta).length)} com coordenação direta</span></th></tr>` +
      (aberto ? xs.map(linhaTax).join("") : "");
  }).join("");
}
function selecionarTax(uid) {
  selecionado = uid; const l = LUID.get(uid);
  fechados.delete(l.classe); ordenarTax();
  const acima = coordenadores.filter((x) => x.direta < l.direta).length;
  eu.innerHTML = `<b>${esc(l.nome)}</b>: ${num(l.direta)} espécies em coordenação direta` +
    (l.abr ? `, ${num(l.abr)} de abrangência` : "") +
    (l.direta ? (acima ? `. Tem mais que ${Math.round(acima / coordenadores.length * 100)}% dos coordenadores.` : ".") : ". Não tem coordenação direta.");
  tabTax.querySelector(`tr[data-u="${uid}"]`)?.scrollIntoView({ block: "center" });
}
tabTax.tHead.addEventListener("click", (e) => {
  const col = e.target.closest("th[data-col]")?.dataset.col; if (!col) return;
  ordem = { col, desc: ordem.col === col ? !ordem.desc : col !== "nome" };
  ordenarTax();
});
tabTax.tBodies[0].addEventListener("click", (e) => {
  const b = e.target.closest("button[data-c]"); if (!b) return;
  const c = +b.dataset.c; fechados.has(c) ? fechados.delete(c) : fechados.add(c); ordenarTax();
});
agrupar.addEventListener("change", ordenarTax);
achar.addEventListener("input", () => ROTULO.has(achar.value) && selecionarTax(ROTULO.get(achar.value)));
distAchar.addEventListener("input", () => ROTULO.has(distAchar.value) && marcarDist(ROTULO.get(distAchar.value)));
ordenarTax();
addEventListener("tema", () => { cyF.style(estilo()); cyA?.style(estilo()); });
controlesZoom(document.querySelector(".zoom[data-cy=foco]"), () => cyF);
controlesZoom(document.querySelector(".zoom[data-cy=arvore]"), () => cyA);
document.getElementById("painel-arvore").addEventListener("click", (e) => { // links do painel da árvore levam à vista de foco
  const b = e.target.closest("button.link"); if (!b) return;
  mostrarAba("aba-lista"); b.dataset.g ? focar(+b.dataset.g, { rolar: true }) : focarPessoa(+b.dataset.u);
});
listar();
const params = new URL(location).searchParams, gInicial = +params.get("g"), uInicial = +params.get("u");
if (U.has(uInicial)) focarPessoa(uInicial);
else focar(G.has(gInicial) && gInicial ? gInicial : +lista.querySelector("tr")?.dataset.g);
