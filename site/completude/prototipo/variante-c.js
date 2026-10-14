// Variante C: relatório editorial, ranking plano de grupos e ficha de grupo (hash #g=<id>).
export const nome = "Ranking e ficha";

const f = (n) => n.toLocaleString("pt-BR");
const pc = (r, c = 0) => (r == null ? "—" : (r * 100).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }) + "%");
const razao = (p, a) => (a > 0 ? p / a : null);
const cor = (r) => `var(--q${1 + Math.min(4, Math.floor((r ?? 0) * 4.999))})`;
const RANKS = { FILO: "Filo", CLASSE: "Classe", ORDEM: "Ordem", FAMILIA: "Família", TRIBO: "Tribo", GENERO: "Gênero", ESPECIE: "Espécie" };
const rankNome = (r) => RANKS[r] ?? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ");
const CURTOS = ["Núcleo", "Distribuição", "Biologia", "Referências"];

const h = (t, a = {}, ...c) => {
  const e = document.createElement(t);
  for (const [k, v] of Object.entries(a)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e[k] = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...c.flat().filter((x) => x != null && x !== false));
  return e;
};
const barra = (r, cls = "") =>
  h("span", { class: `barra ${cls}`, "aria-hidden": "true" }, h("i", { style: `width:${(r ?? 0) * 100}%;background:${cor(r)}` }));

// Rolagem infinita: acrescenta lotes de linhas em `host` (já no DOM) enquanto a sentinela aparece.
function incremental(host, itens, linha, lote = 60) {
  let i = 0;
  const sent = h("div", { class: "sentinela" });
  const mais = () => {
    const fr = document.createDocumentFragment();
    for (const fim = Math.min(i + lote, itens.length); i < fim; i++) fr.append(linha(itens[i]));
    host.append(fr);
    if (i >= itens.length) fim();
  };
  const obs = new IntersectionObserver((e) => {
    if (!e[0].isIntersecting) return;
    mais();
    if (i < itens.length) { obs.unobserve(sent); obs.observe(sent); }
  }, { rootMargin: "600px" });
  const fim = () => { obs.disconnect(); sent.remove(); };
  host.after(sent);
  mais();
  if (i < itens.length) obs.observe(sent);
  return fim;
}

export function montar(raiz, dados, { valores }) {
  const { atributos, dominios, total, grupos, porId, filhos } = dados;
  const idxDom = dominios.map((_, d) => atributos.flatMap((x, i) => (x.dominio === d ? [i] : [])));
  const soma = (o, idxs) => [idxs.reduce((s, i) => s + o.p[i], 0), idxs.reduce((s, i) => s + o.a[i], 0)];
  const razoes = (o) => {
    const [p, a] = soma(o, atributos.map((_, i) => i));
    return { r: razao(p, a), p, a, d: idxDom.map((ix) => razao(...soma(o, ix))) };
  };
  const calc = new Map(grupos.map((g) => [g.id, razoes(g)]));
  const glob = razoes(total);
  const aceitos = dados.nomes.aceitos, sin = dados.nomes.sinonimos, nv = dados.nomes.nao_validados;
  const nvTotal = Object.values(nv).reduce((s, n) => s + n, 0);

  // ---------- abertura ----------
  const dg = glob.d.map((r, i) => ({ r, i })).sort((a, b) => a.r - b.r);
  const fraco = dg[0], forte = dg[dg.length - 1];
  const forA = dados.fora_da_nota[0];
  const abertura = h("section", { class: "abertura" },
    h("div", { class: "texto" },
      h("h2", {}, "Completude da fauna brasileira"),
      h("p", { class: "lede" },
        `Até ${new Date(dados.referencia + "T12:00").toLocaleDateString("pt-BR", { dateStyle: "long" })}, os registros do CTFB preenchem `,
        h("strong", { class: "destaque" }, pc(glob.r, 1)), ` dos atributos aplicáveis às ${f(aceitos)} espécies aceitas (${f(glob.p)} de ${f(glob.a)}). `,
        `O domínio mais fraco é `, h("strong", {}, `${dominios[fraco.i]} (${pc(fraco.r)})`),
        `; o mais completo, `, h("strong", {}, `${dominios[forte.i]} (${pc(forte.r)})`), ". ",
        `${forA.nome} fica fora da nota: ${forA.motivo}.`),
      h("p", { class: "lede" },
        `Quanto aos nomes, `, h("strong", { class: "ok" }, `${f(aceitos + sin)} são validados`), ` (${f(aceitos)} aceitos e ${f(sin)} sinônimos) e `,
        h("strong", { class: "alerta" }, `${f(nvTotal)} não são validados`),
        `: ${f(nv.INDISPONIVEL)} com disponibilidade indisponível, ${f(nv.DISPONIVEL)} disponível e ${f(nv.SEM_VALOR)} sem valor.`),
      h("div", { class: "nomes" },
        h("div", { class: "nome ok" }, h("b", {}, f(aceitos + sin)), h("span", {}, "Nome validado")),
        h("div", { class: "nome alerta" }, h("b", {}, f(nvTotal)), h("span", {}, "Nome não validado")))),
    h("figure", { class: "waffle" },
      h("figcaption", {}, "Preenchimento de cada atributo (cada célula = 10% das espécies aplicáveis)"),
      dominios.map((d, di) => h("div", { class: "wdom" },
        h("h3", {}, d, h("small", {}, pc(glob.d[di]))),
        idxDom[di].map((i) => {
          const r = razao(total.p[i], total.a[i]), cheias = Math.round((r ?? 0) * 10);
          return h("div", { class: "wlin", title: `${atributos[i].nome}: ${f(total.p[i])} de ${f(total.a[i])}` },
            h("span", { class: "wnome" }, atributos[i].nome),
            h("span", { class: "cel", "aria-hidden": "true" }, Array.from({ length: 10 }, (_, k) => h("i", { style: k < cheias ? `background:${cor(r)}` : "" }))),
            h("span", { class: "wpc" }, pc(r)));
        })))));

  // ---------- ranking ----------
  const ranks = [...new Set(grupos.map((g) => g.rank))].sort((a, b) => Object.keys(RANKS).indexOf(a) - Object.keys(RANKS).indexOf(b));
  const est = { rank: "", min: 10, busca: "", chave: "r", dir: -1 };
  const CHAVES = { nome: (g) => g.nome, esp: (g) => g.especies, r: (g) => calc.get(g.id).r ?? -1, ...Object.fromEntries([0, 1, 2, 3].map((d) => [`d${d}`, (g) => calc.get(g.id).d[d] ?? -1])) };
  const selRank = h("select", { "aria-label": "Filtrar por nível taxonômico" }, h("option", { value: "" }, "Todos os níveis"), ranks.map((r) => h("option", { value: r }, rankNome(r))));
  const inMin = h("input", { type: "number", min: "0", value: String(est.min), "aria-label": "Mínimo de espécies" });
  const inBusca = h("input", { type: "search", placeholder: "Buscar grupo pelo nome", "aria-label": "Buscar grupo pelo nome" });
  const resumo = h("p", { class: "resumo", "aria-live": "polite" });
  const cab = h("div", { class: "linha cab", role: "presentation" });
  const corpo = h("div", { class: "corpo" });
  const colunas = [["nome", "Grupo"], ["esp", "Espécies"], ["r", "Completude"], ...dominios.map((d, i) => [`d${i}`, CURTOS[i]])];
  const botoes = colunas.map(([k, t], n) => h("button", { type: "button", class: n === 0 ? "c-nome" : n === 1 ? "c-esp" : n === 2 ? "c-tot" : "c-dom", title: n > 2 ? dominios[n - 3] : null, onclick: () => { est.dir = est.chave === k ? -est.dir : k === "nome" ? 1 : -1; est.chave = k; desenhar(); } }, t));
  cab.append(...botoes);
  let parar = () => {};
  const linhaGrupo = (g) => {
    const c = calc.get(g.id);
    return h("a", { class: "linha", href: `#g=${g.id}` },
      h("span", { class: "c-nome" }, h("b", {}, g.nome), h("small", {}, rankNome(g.rank))),
      h("span", { class: "c-esp num" }, f(g.especies)),
      h("span", { class: "c-tot" }, barra(c.r), h("em", {}, pc(c.r))),
      c.d.map((r, i) => h("span", { class: "c-dom", title: `${dominios[i]}: ${pc(r)}` }, barra(r))));
  };
  function desenhar() {
    parar();
    const q = est.busca.trim().toLocaleLowerCase("pt-BR");
    const k = CHAVES[est.chave];
    const lista = grupos.filter((g) => (!est.rank || g.rank === est.rank) && g.especies >= est.min && (!q || g.nome.toLocaleLowerCase("pt-BR").includes(q)));
    lista.sort((a, b) => { const x = k(a), y = k(b); return (x < y ? -1 : x > y ? 1 : b.especies - a.especies) * (x === y ? 1 : est.dir); });
    botoes.forEach((b, i) => { const on = colunas[i][0] === est.chave; b.classList.toggle("on", on); b.setAttribute("aria-sort", on ? (est.dir > 0 ? "ascending" : "descending") : "none"); b.dataset.seta = on ? (est.dir > 0 ? "▲" : "▼") : ""; });
    resumo.textContent = `${f(lista.length)} de ${f(grupos.length)} grupos`;
    corpo.replaceChildren();
    parar = lista.length ? incremental(corpo, lista, linhaGrupo) : (corpo.append(h("p", { class: "vazio" }, "Nenhum grupo com esse filtro.")), () => {});
  }
  selRank.onchange = () => { est.rank = selRank.value; desenhar(); };
  inMin.oninput = () => { est.min = Math.max(0, +inMin.value || 0); desenhar(); };
  inBusca.oninput = () => { est.busca = inBusca.value; desenhar(); };
  const lista = h("section", { class: "lista" },
    h("h2", {}, "Ranking dos grupos"),
    h("p", { class: "ajuda" }, "Lista plana de todos os grupos. Clique nos títulos das colunas para ordenar; clique numa linha para abrir a ficha do grupo."),
    h("div", { class: "filtros" },
      h("label", {}, "Busca", inBusca), h("label", {}, "Nível", selRank), h("label", {}, "Mínimo de espécies", inMin), resumo),
    cab, corpo);

  // ---------- Domínio de Valores ----------
  function tabelasValores(v, obj, aplic, semUso) {
    const wrap = h("div", { class: "valores" });
    for (const c of v.campos) {
      const o = obj[c.id] ?? {};
      const a = aplic(c.atributo);
      const linhas = [...new Set([...c.check, ...Object.keys(o).filter((k) => k !== "")])].map((val) => ({ val, n: o[val] ?? 0, nunca: !(val in o) && c.check.includes(val) }));
      linhas.sort((x, y) => y.n - x.n || x.val.localeCompare(y.val));
      const lin = (l) => h("tr", { class: l.nunca ? "nunca" : "" },
        h("td", {}, l.val === "VAZIO" ? "VAZIO (não informado)" : l.val, l.nunca && h("small", {}, semUso)),
        h("td", { class: "num" }, f(l.n)), h("td", { class: "b" }, barra(a ? Math.min(1, l.n / a) : 0)));
      const unidade = linhas.length > 12 ? 12 : linhas.length;
      const resto = linhas.slice(unidade);
      const nuncas = linhas.filter((l) => l.nunca).length;
      const tab = h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Valor"), h("th", { class: "num" }, "Espécies"), h("th", {}, ""))), h("tbody", {}, linhas.slice(0, unidade).map(lin)));
      wrap.append(h("article", { class: nuncas ? "tem-nunca" : "" },
        h("h4", {}, c.nome, h("small", {}, ` ${c.coluna}`)),
        h("p", { class: "cobertura" }, `Com valor: ${pc(razao(o[""] ?? 0, a), 1)} (${f(o[""] ?? 0)} de ${f(a)})`, nuncas ? h("span", { class: "nunca-tag" }, `${semUso}: ${nuncas}`) : null),
        tab,
        resto.length ? h("details", {}, h("summary", {}, `Mais ${f(resto.length)} valores`), h("table", {}, h("tbody", {}, resto.map(lin)))) : null));
    }
    return wrap;
  }
  const valoresGlobal = h("section", { class: "globais" },
    h("h2", {}, "Domínio de Valores"),
    h("p", { class: "ajuda" }, "Para cada campo com lista fechada de valores: quantas espécies usam cada valor e que fração das espécies aplicáveis tem algum valor. Valores permitidos que nunca aparecem ficam destacados."),
    h("p", { class: "carregando" }, "Os valores carregam ao rolar até aqui…"));
  let globalIniciado = false;
  const carregarGlobal = async () => {
    if (globalIniciado) return;
    globalIniciado = true;
    const v = await valores();
    const ix = (id) => atributos.findIndex((x) => x.id === id);
    valoresGlobal.querySelector(".carregando").replaceWith(tabelasValores(v, v.global, (id) => total.a[ix(id)], "nunca usado"));
  };
  const obsGlobal = new IntersectionObserver((e) => { if (e[0].isIntersecting) { obsGlobal.disconnect(); carregarGlobal(); } }, { rootMargin: "300px" });

  // ---------- ficha ----------
  const ficha = h("section", { class: "ficha", hidden: true });
  let ficaToken = 0, pararFilhos = () => {};
  function montarFicha(id) {
    const g = porId.get(id), c = calc.get(id), token = ++ficaToken;
    pararFilhos();
    const anc = [];
    for (let p = g.pai; p != null; p = porId.get(p).pai) anc.unshift(porId.get(p));
    const fils = filhos.get(id) ?? [];
    const ixAll = atributos.map((_, i) => i);
    const sinNv = g.sinonimos + g.nao_validados;
    const filhosCorpo = h("tbody");
    const tabFilhos = h("table", { class: "filhos" }, h("thead", {}, h("tr", {}, h("th", {}, "Subgrupo"), h("th", {}, "Nível"), h("th", { class: "num" }, "Espécies"), h("th", {}, "Completude"))), filhosCorpo);
    const blocoValores = h("div", { class: "carregando" }, "Carregando Domínio de Valores do grupo…");
    ficha.replaceChildren(
      h("button", { type: "button", class: "voltar", onclick: () => { history.pushState(null, "", location.pathname + location.search); aplicarHash(); } }, "Voltar ao ranking"),
      h("nav", { class: "migalhas", "aria-label": "Hierarquia" }, h("ol", {}, anc.map((x) => h("li", {}, h("a", { href: `#g=${x.id}` }, x.nome), h("small", {}, rankNome(x.rank)))), h("li", { "aria-current": "page" }, h("b", {}, g.nome), h("small", {}, rankNome(g.rank))))),
      h("header", { class: "topo-ficha" },
        h("div", {}, h("h2", {}, g.nome), h("p", { class: "sub" }, `${rankNome(g.rank)} · ${f(g.especies)} espécies aceitas na subárvore`)),
        h("div", { class: "grande" }, h("b", {}, pc(c.r)), h("span", {}, `${f(c.p)} de ${f(c.a)} atributos`), barra(c.r, "larga"))),
      h("div", { class: "cartas" },
        h("div", {}, h("span", {}, "Só neste grupo (diretas)"), h("b", {}, g.especies_diretas ? pc(razao(...g.diretas)) : "—"), h("small", {}, g.especies_diretas ? `${f(g.diretas[0])} de ${f(g.diretas[1])} · ${f(g.especies_diretas)} espécies` : "sem espécies diretas")),
        dominios.map((d, i) => h("div", {}, h("span", {}, d), h("b", {}, pc(c.d[i])), barra(c.d[i])))),
      h("div", { class: "duas" },
        h("section", {}, h("h3", {}, "Atributos"),
          dominios.map((d, di) => h("div", { class: "adom" },
            h("h4", {}, d, h("small", {}, ` ${pc(c.d[di])}`)),
            idxDom[di].map((i) => h("div", { class: "alin" }, h("span", {}, atributos[i].nome), barra(razao(g.p[i], g.a[i])),
              h("em", {}, g.a[i] ? `${f(g.p[i])} de ${f(g.a[i])} (${pc(razao(g.p[i], g.a[i]))})` : "não se aplica"))))),
          h("p", { class: "fora" }, `${dados.fora_da_nota[0].nome}: ${dados.fora_da_nota[0].motivo}.`)),
        h("section", {},
          h("h3", {}, "Nomes"),
          h("div", { class: "nomes" },
            h("div", { class: "nome ok" }, h("b", {}, f(g.especies + g.sinonimos)), h("span", {}, "Nome validado")),
            h("div", { class: "nome alerta" }, h("b", {}, f(g.nao_validados)), h("span", {}, "Nome não validado"))),
          h("p", { class: "ajuda" }, `Validados: ${f(g.especies)} aceitos e ${f(g.sinonimos)} sinônimos. Não validados: nomes sem status${sinNv ? "" : "; este grupo não tem nenhum"}.`),
          h("h3", {}, "Subgrupos"),
          fils.length ? tabFilhos : h("p", { class: "ajuda" }, "Sem subgrupos."))),
      h("h3", {}, "Domínio de Valores do grupo"), blocoValores);
    if (fils.length) pararFilhos = incremental(filhosCorpo, fils, (x) => {
      const r = calc.get(x.id).r;
      return h("tr", {}, h("td", {}, h("a", { href: `#g=${x.id}` }, x.nome)), h("td", {}, rankNome(x.rank)), h("td", { class: "num" }, f(x.especies)), h("td", { class: "tot" }, barra(r), h("em", {}, pc(r))));
    }, 40);
    valores().then((v) => {
      if (token !== ficaToken) return;
      const ix = (aid) => atributos.findIndex((x) => x.id === aid);
      const obj = v.grupos[id] ?? {};
      blocoValores.replaceWith(tabelasValores(v, obj, (aid) => g.a[ix(aid)], "sem uso"));
    });
  }

  let salvo = null;
  function aplicarHash() {
    const m = /^#g=(\d+)$/.exec(location.hash);
    const id = m ? +m[1] : null;
    if (id != null && porId.has(id)) {
      if (!lista.hidden) salvo = scrollY;
      lista.hidden = true; ficha.hidden = false;
      montarFicha(id);
      scrollTo(0, ficha.offsetTop - 8);
    } else {
      ficaToken++; pararFilhos();
      const vinha = !lista.hidden;
      ficha.hidden = true; lista.hidden = false;
      if (!vinha) requestAnimationFrame(() => scrollTo(0, salvo ?? lista.offsetTop - 8));
    }
  }
  const aoHash = () => { if (raiz.classList.contains("variante-c") && raiz.isConnected) aplicarHash(); };
  removeEventListener("hashchange", window.__hashC);
  window.__hashC = aoHash;
  addEventListener("hashchange", aoHash);

  raiz.append(abertura, lista, ficha, valoresGlobal);
  desenhar();
  obsGlobal.observe(valoresGlobal);
  if (location.hash.startsWith("#g=")) aplicarHash();
}
