// PROTÓTIPO descartável, variante B: árvore de área (icicle com zoom) + painel do grupo em foco.
export const nome = "Árvore de área";

const fmt = (n) => n.toLocaleString("pt-BR");
const pct = (r, c = 0) => (r * 100).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }) + "%";
const razao = (p, a) => (a > 0 ? p / a : null);
// Rampa contínua entre --q0 e --q5.
const cor = (r) => {
  const x = Math.min(Math.max(r ?? 0, 0), 1) * 5, i = Math.min(4, Math.floor(x));
  return `color-mix(in srgb, var(--q${i + 1}) ${Math.round((x - i) * 100)}%, var(--q${i}))`;
};
const tom = (r) => (r < 0.5 ? "t1" : r < 0.7 ? "t2" : "t3");
const rankPt = (r) =>
  r.toLowerCase().replace("familia", "família").replace("genero", "gênero").replace("especie", "espécie").replace(/_/g, "-");
const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const REGIOES = [
  ["Norte", ["AC", "AM", "AP", "PA", "RO", "RR", "TO"]],
  ["Nordeste", ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]],
  ["Centro-Oeste", ["DF", "GO", "MS", "MT"]],
  ["Sudeste", ["ES", "MG", "RJ", "SP"]],
  ["Sul", ["PR", "RS", "SC"]],
];

function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}
const barra = (r, curta, neutra) => {
  const i = h("i");
  if (r != null) { i.style.width = `${Math.max(r * 100, r > 0 ? 1 : 0)}%`; if (!neutra) i.style.background = cor(r); }
  return h("span", "barra" + (curta ? " curta" : "") + (neutra ? " neutra" : ""), i);
};

// Ouvintes globais ficam no módulo: o shell troca de variante sem recarregar.
let aoTeclar, observador;

export function montar(raiz, dados, { valores }) {
  const { atributos, dominios, porId, filhos } = dados;
  const dom = dominios.map((_, d) => atributos.flatMap((a, i) => (a.dominio === d ? [i] : [])));
  const todos = atributos.map((_, i) => i);
  const filhosDe = (g) => filhos.get(g.id) ?? [];
  const nv = Object.values(dados.nomes.nao_validados).reduce((s, n) => s + n, 0);
  const RAIZ = {
    id: null, nome: "Animalia", rank: "REINO", pai: null,
    especies: filhos.get(null).reduce((s, g) => s + g.especies, 0), aceitos: dados.nomes.aceitos,
    especies_diretas: dados.sem_grupo, p: dados.total.p, a: dados.total.a, diretas: [0, 0],
    sinonimos: dados.nomes.sinonimos, nao_validados: nv,
  };
  const caminho = (g) => {
    const c = [];
    for (let x = g; x !== RAIZ; x = x.pai == null ? RAIZ : porId.get(x.pai)) c.unshift(x);
    return [RAIZ, ...c];
  };
  const somar = (g, idx) => { let p = 0, a = 0; for (const i of idx) { p += g.p[i]; a += g.a[i]; } return { p, a, r: razao(p, a) }; };
  const memo = new Map();
  const comp = (g) => memo.get(g) ?? (memo.set(g, somar(g, todos)), memo.get(g));
  const textoComp = (c, casas) => (c.r == null ? "—" : `${pct(c.r, casas)} (${fmt(c.p)} de ${fmt(c.a)})`);

  let foco = RAIZ, sel = RAIZ, aba = "comp";

  // ---------- esqueleto ----------
  const glob = somar(RAIZ, todos);
  const intro = h("section", "intro",
    h("div", "intro-n", h("strong", "grande", pct(glob.r, 1)), h("span", null, "de completude geral: atributos preenchidos entre os aplicáveis, nas ", fmt(RAIZ.aceitos), " espécies aceitas do catálogo.")),
    nomesBloco(RAIZ.aceitos, RAIZ.sinonimos, RAIZ.nao_validados, dados.nomes.nao_validados));
  const busca = h("input"); busca.type = "search"; busca.placeholder = "Buscar um grupo pelo nome"; busca.autocomplete = "off";
  busca.setAttribute("role", "combobox"); busca.setAttribute("aria-expanded", "false"); busca.setAttribute("aria-controls", "b-sugestoes"); busca.setAttribute("aria-label", "Buscar um grupo pelo nome");
  const lista = h("ul", "sugestoes"); lista.id = "b-sugestoes"; lista.setAttribute("role", "listbox"); lista.hidden = true;
  const dica = h("p", "dica", "Clique numa faixa para aproximar; clique numa faixa estreita à esquerda ou aperte Esc para voltar. Altura = número de espécies, cor = completude. Faixas menores que um pixel não aparecem: aproxime ou use a busca.");
  const grafico = h("div", "grafico");
  const painel = h("section", "painel");
  raiz.append(intro, h("section", "arvore", h("div", "busca", busca, lista), grafico, dica), painel);

  // ---------- gráfico ----------
  function desenhar() {
    const W = grafico.clientWidth, H = grafico.clientHeight;
    grafico.replaceChildren();
    if (!W) return;
    const anc = caminho(foco).slice(0, -1);
    const S = anc.length > 5 ? 18 : 28;
    anc.forEach((g, i) => {
      const c = comp(g);
      const b = h("button", `faixa-anc ${tom(c.r ?? 0)}`, h("span", null, g.nome));
      b.style.cssText = `left:${i * S}px;width:${S}px;background:${cor(c.r)}`;
      b.title = `Voltar para ${g.nome}`;
      b.onclick = () => ir(g);
      grafico.append(b);
    });
    const x0 = anc.length * S, n = Math.max(1, Math.min(5, Math.floor((W - x0) / 130))), cw = (W - x0) / n;
    const banda = (g, col, y, alt) => {
      const c = comp(g), pode = filhosDe(g).length > 0;
      const b = h("button", `banda ${tom(c.r ?? 0)}${alt < 4 ? " fina" : ""}${g === sel && sel !== foco ? " sel" : ""}${pode ? "" : " folha"}`);
      b.style.cssText = `left:${x0 + col * cw}px;width:${cw}px;top:${y}px;height:${alt}px;background:${cor(c.r)}`;
      b.title = `${g.nome} (${rankPt(g.rank)})\n${textoComp(c, 0)}\n${fmt(g.especies)} espécies${pode ? ` em ${fmt(filhosDe(g).length)} subgrupos` : ""}`;
      if (alt >= 16) b.append(h("span", "n", g.nome));
      if (alt >= 34) b.append(h("span", "m", `${c.r == null ? "—" : pct(c.r)} · ${fmt(g.especies)} espécies`));
      if (alt < 16) b.tabIndex = -1;
      b.onclick = () => ir(g);
      grafico.append(b);
      if (col + 1 >= n || !g.especies) return;
      let yy = y;
      for (const f of filhosDe(g)) {
        const fa = (alt * f.especies) / g.especies;
        if (fa < 1) break; // ordenados por tamanho: o resto é menor ainda
        banda(f, col + 1, yy, fa);
        yy += fa;
      }
    };
    banda(foco, 0, 0, H);
  }
  // Foco = grupo aproximado; sel = grupo no painel (folha só seleciona).
  function ir(g, comFoco = true) {
    sel = g;
    if (g === RAIZ || filhosDe(g).length) foco = g;
    else if (comFoco) foco = g.pai == null ? RAIZ : porId.get(g.pai);
    render();
  }
  function subir() {
    if (sel !== foco) sel = foco;
    else if (foco !== RAIZ) foco = sel = foco.pai == null ? RAIZ : porId.get(foco.pai);
    else return;
    render();
  }
  function render() { desenhar(); desenharPainel(); }

  observador?.disconnect();
  let larg = 0;
  observador = new ResizeObserver(() => { if (grafico.clientWidth !== larg) { larg = grafico.clientWidth; desenhar(); } });
  observador.observe(grafico);
  document.removeEventListener("keydown", aoTeclar);
  aoTeclar = (e) => {
    if (e.key !== "Escape" || !raiz.classList.contains("variante-b") || e.target.closest?.("input")) return;
    subir();
  };
  document.addEventListener("keydown", aoTeclar);

  // ---------- busca ----------
  const indice = dados.grupos.map((g) => ({ g, k: norm(g.nome) }));
  let sugestoes = [], ativa = -1;
  function sugerir() {
    const q = norm(busca.value.trim());
    sugestoes = q
      ? indice.filter((x) => x.k.includes(q))
          .sort((a, b) => (b.k.startsWith(q) - a.k.startsWith(q)) || b.g.especies - a.g.especies).slice(0, 8).map((x) => x.g)
      : [];
    ativa = sugestoes.length ? 0 : -1;
    pintarSugestoes();
  }
  function pintarSugestoes() {
    lista.replaceChildren(...sugestoes.map((g, i) => {
      const li = h("li", i === ativa ? "ativa" : "", h("b", null, g.nome), h("small", null, `${rankPt(g.rank)}${g.pai == null ? "" : " em " + porId.get(g.pai).nome} · ${fmt(g.especies)} espécies`));
      li.setAttribute("role", "option");
      li.onmousedown = (e) => { e.preventDefault(); escolher(g); };
      return li;
    }));
    lista.hidden = !sugestoes.length;
    busca.setAttribute("aria-expanded", String(sugestoes.length > 0));
  }
  function escolher(g) { busca.value = ""; sugestoes = []; pintarSugestoes(); busca.blur(); ir(g); }
  busca.oninput = sugerir;
  busca.onblur = () => { sugestoes = []; pintarSugestoes(); };
  busca.onkeydown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugestoes.length) return;
      e.preventDefault();
      ativa = (ativa + (e.key === "ArrowDown" ? 1 : -1) + sugestoes.length) % sugestoes.length;
      pintarSugestoes();
    } else if (e.key === "Enter" && sugestoes[ativa]) { e.preventDefault(); escolher(sugestoes[ativa]); }
    else if (e.key === "Escape") { if (sugestoes.length) { sugestoes = []; pintarSugestoes(); } else busca.blur(); }
  };

  // ---------- painel ----------
  function nomesBloco(aceitos, sin, naoVal, detalhe) {
    const seg = (cls, n, rot) => { const i = h("i", cls); i.style.flex = n; i.title = `${rot}: ${fmt(n)}`; return n ? i : null; };
    return h("div", "nomes",
      h("div", "duplo",
        h("span", "val", "Nomes validados ", h("b", null, fmt(aceitos + sin)), ` (${fmt(aceitos)} aceitos + ${fmt(sin)} sinônimos)`),
        h("span", "nval", "Nomes não validados ", h("b", null, fmt(naoVal)))),
      h("div", "faixa", seg("ac", aceitos, "Aceitos"), seg("sn", sin, "Sinônimos"), seg("nv", naoVal, "Não validados")),
      detalhe ? h("small", null, `Sem status de validação; por disponibilidade: ${fmt(detalhe.INDISPONIVEL)} indisponível, ${fmt(detalhe.DISPONIVEL)} disponível, ${fmt(detalhe.SEM_VALOR)} sem valor.`) : null);
  }

  function desenharPainel() {
    const g = sel, c = comp(g);
    const trilha = h("nav", "trilha");
    trilha.hidden = g === RAIZ;
    trilha.setAttribute("aria-label", "Caminho do grupo");
    caminho(g).forEach((x, i, l) => {
      if (i) trilha.append(h("span", "sep", "/"));
      if (x === g) trilha.append(h("span", "atual", x.nome));
      else { const b = h("button", null, x.nome); b.type = "button"; b.onclick = () => ir(x); trilha.append(b); }
    });
    const aceitos = g.aceitos ?? g.especies;
    const abas = h("div", "abas");
    abas.setAttribute("role", "tablist");
    for (const [id, rot] of [["comp", "Completude"], ["val", "Domínio de valores"]]) {
      const b = h("button", null, rot);
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(aba === id));
      b.onclick = () => { aba = id; desenharPainel(); };
      abas.append(b);
    }
    const corpo = h("div", "corpo");
    painel.replaceChildren(
      trilha,
      h("div", "cab", h("h2", null, g.nome), h("span", "rank", `${rankPt(g.rank)} · ${fmt(aceitos)} espécies aceitas`)),
      abas, corpo);
    if (aba === "comp") corpo.append(abaCompletude(g, c, aceitos));
    else abaValores(corpo, g);
  }

  function abaCompletude(g, c, aceitos) {
    const dir = g.diretas;
    const dd = dir[1] > 0 ? `${pct(dir[0] / dir[1])} (${fmt(dir[0])} de ${fmt(dir[1])})` : "—";
    const esq = h("div", "resumo",
      h("div", "topo-n", h("strong", "grande", c.r == null ? "—" : pct(c.r, g === RAIZ ? 1 : 0)), h("span", "ratio", c.r == null ? "" : `(${fmt(c.p)} de ${fmt(c.a)})`)),
      h("p", "leg", "Atributos preenchidos entre os aplicáveis, somando o grupo e todos os subgrupos."),
      h("p", "diretas", h("b", null, "Só as espécies diretas do grupo: "), dd, g.especies_diretas ? ` · ${fmt(g.especies_diretas)} ${g.especies_diretas === 1 ? "espécie direta" : "espécies diretas"}` : " · nenhuma espécie direta (só subgrupos)"),
      h("h3", null, "Os quatro domínios"),
      dom.map((idx, d) => {
        const s = somar(g, idx);
        return h("div", "linha dominio", h("span", "rot", dominios[d]), barra(s.r), h("span", "val", textoComp(s, 0)));
      }),
      h("h3", null, "Nomes do grupo"),
      nomesBloco(aceitos, g.sinonimos, g.nao_validados, g === RAIZ ? dados.nomes.nao_validados : null),
      h("p", "leg", dados.fora_da_nota.map((f) => `${f.nome}: ${f.motivo}, fora da nota.`).join(" ")));
    const dir_ = h("div", "atributos", dom.map((idx, d) => h("div", "grupo-dom",
      h("h3", null, dominios[d]),
      idx.map((i) => {
        const p = g.p[i], a = g.a[i];
        return h("div", "linha" + (a ? "" : " nao"), h("span", "rot", atributos[i].nome), a ? barra(p / a, true) : h("span", "barra curta vazio"),
          h("span", "val", a ? `${fmt(p)} de ${fmt(a)}` : "não se aplica"));
      }))));
    return h("div", "duas", esq, dir_);
  }

  async function abaValores(corpo, g) {
    corpo.textContent = "Carregando o domínio de valores…";
    const v = await valores();
    if (g !== sel || aba !== "val") return;
    const fonte = g === RAIZ ? v.global : v.grupos[g.id] ?? {};
    corpo.replaceChildren(
      h("p", "leg", `${g === RAIZ ? "Todas as espécies" : "Neste grupo"}: quantas espécies usam cada valor permitido. Valores que o modelo permite mas ninguém usa aparecem como nunca usado.`),
      h("div", "campos", v.campos.map((c) => campo(c, fonte[c.id] ?? {}, g.a[atributos.findIndex((a) => a.id === c.atributo)]))));
  }

  function campo(c, obj, ap) {
    const comValor = obj[""] ?? 0;
    const todosV = [...new Set([...c.check, ...Object.keys(obj).filter((k) => k !== "")])];
    const usados = todosV.filter((x) => obj[x] > 0).sort((a, b) => obj[b] - obj[a]);
    const zerados = todosV.filter((x) => !(obj[x] > 0));
    const max = Math.max(1, ...usados.map((x) => obj[x]));
    const cab = h("header", null, h("h4", null, c.nome),
      barra(razao(comValor, ap), true),
      h("span", "val", ap ? `${pct(comValor / ap)} com valor (${fmt(comValor)} de ${fmt(ap)})` : "não se aplica"));
    const sec = h("section", "campo", cab);
    if (c.id === "uf") {
      const conhecidas = new Set(REGIOES.flatMap((r) => r[1]));
      const grade = h("div", "grade-uf");
      const regs = [...REGIOES, ["Outros", todosV.filter((x) => !conhecidas.has(x))]];
      for (const [reg, ufs] of regs) {
        if (!ufs.length) continue;
        grade.append(h("div", "regiao", h("small", null, reg), h("div", "tiles", ufs.map((u) => {
          const n = obj[u] ?? 0, t = h("div", "tile" + (n ? "" : " zero"), h("b", null, u), h("span", null, n ? fmt(n) : "nunca usado"));
          if (n) t.style.setProperty("--m", `${Math.round(15 + (n / max) * 85)}%`);
          t.title = n ? `${u}: ${fmt(n)} espécies` : `${u}: nunca usado`;
          return t;
        }))));
      }
      sec.append(grade);
      return sec;
    }
    const lin = (x) => {
      const n = obj[x], r = ap ? Math.min(1, n / ap) : n / max;
      const rot = h("span", "rot", x.replace(/_/g, " ").toLowerCase());
      rot.title = x;
      return h("div", "linha", rot, barra(r, true, true), h("span", "val", `${fmt(n)}${ap ? ` · ${r < 0.001 ? "<0,1%" : pct(r, r < 0.01 ? 1 : 0)}` : ""}`));
    };
    const caixa = h("div", "valores", usados.slice(0, 8).map(lin));
    sec.append(caixa);
    if (!usados.length) caixa.append(h("p", "leg", "Nenhum valor usado."));
    if (usados.length > 8) {
      const b = h("button", "mais", usados.length === 9 ? "Ver mais 1 valor" : `Ver mais ${fmt(usados.length - 8)} valores`);
      b.type = "button";
      b.onclick = () => { caixa.append(...usados.slice(8).map(lin)); b.remove(); };
      sec.append(b);
    }
    if (zerados.length) sec.append(h("details", "zerados", h("summary", null, `${fmt(zerados.length)} nunca usados`), h("div", null, zerados.map((x) => h("span", "chip", x.replace(/_/g, " ").toLowerCase())))));
    return sec;
  }

  render();
}
