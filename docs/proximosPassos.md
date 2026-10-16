# Próximos Passos — estado do projeto e pendências

> Ponto de entrada de qualquer nova sessão. Ao final de cada sessão, atualizar (i) a data do estado, (ii) o estado do repositório, (iii) o que foi feito e (iv) as próximas ações. Caminhos relativos à raiz do repositório.

**Estado em:** 2026-10-14 — duas análises publicadas em <https://web.dalc.in/faunabr/>: "Quem cuida de cada grupo da fauna brasileira" e "Completude de cada grupo da fauna brasileira" (com drill-down por espécie).

**Estado do repositório:** `main`, sincronizado com `origin/main` (público: [edalcin/faunaAnalises](https://github.com/edalcin/faunaAnalises)). `dados/` (dump + SQLite) e `site/*/data/` (JSON gerado) ficam fora do git.

**Projeto irmão:** [faunabr](https://github.com/edalcin/faunabr) — pesquisa de arquitetura e glossário (`CONTEXT.md`). As decisões desta primeira análise estão no mapa wayfinder [faunabr#1](https://github.com/edalcin/faunabr/issues/1) (fechado) e nas pesquisas `faunabr/docs/research/inatividade-coordenadores.md` e `faunabr/docs/research/biblioteca-grafo.md`.

---

## 1. O que foi feito

| Data | Onde | O que |
|---|---|---|
| 2026-10-13 | `dados/fauna.sqlite` | Dump `backup_fauna_2026_09_09.dump` (PostgreSQL custom, 907 MB) restaurado em `postgres:18` no Docker local e convertido para SQLite (18 GB) por `scripts/pg2sqlite.py`. 94 tabelas + 3 matviews; contagem de linhas idêntica ao PostgreSQL; `integrity_check` ok; 0 violações de FK; índice FTS5 trigram `taxon_name_fts`. Schemas fora de `public` viram prefixo (`historico__log`). |
| 2026-10-13 | `scripts/exportar_grafo.py` | Exportador SQLite → `site/grafo/data/grafo.json` (~3 s). Regras: coordenador mais próximo; atividade = edição na subárvore; estados ativo ≤ 1 ano / em risco 1–3 / órfão > 3 ou sem coordenação / agregador. Data de referência = última data do `historico`. Nunca exporta e-mail/login. |
| 2026-10-13 | `site/` | Site estático sem build (HTML + ES modules + CSS; Cytoscape.js 3.34.3 vendorizado). Página inicial em cartões; `grafo/` com lista, busca com sugestões, grafo de foco (grupo ou taxonomista) com zoom/reset, painel explicativo e aba Árvore radial com Voltar/Raiz; `grafo/metodo.html` com o método. Tema claro/escuro. |
| 2026-10-13 | web.dalc.in | Publicado em <https://web.dalc.in/faunabr/> (cópia de `site/` para `S:\appsdata\web.dalc.in\faunabr`). Números: 4.154 grupos — 3.924 ativos, 83 em risco, 144 órfãos (3,5%), 3 agregadores; 6.047 espécies em grupos órfãos. |
| 2026-10-13 | `dados/fauna.sqlite` | Limpeza: removidos os schemas auxiliares `carga`, `historico` (log de gatilhos, 26,4 M linhas), `postgrest` e `ipt_fauna` (19 tabelas). Ficaram as 78 tabelas de `public` + FTS5; 19,3 GB → 1,3 GB. Contagem das 78 tabelas idêntica ao backup; `integrity_check` ok; 98 FKs, 0 violações; `grafo.json` regenerado idêntico. Backup completo em `dados/fauna_backup_2026-10-13.sqlite`. `pg2sqlite.py` agora só converte `public`. `dados/modeloERctf.md` atualizado. |
| 2026-10-13 | repositório | Arquivos separados do `faunabr` para este repositório; `README.md` com pipeline e publicação. |
| 2026-10-14 | `scripts/exportar_completude.py` | Exportador SQLite → `site/completude/data/completude.json` (grupos, ~1 MB) e `valores.json` (Domínio de Valores global e por grupo, ~2,3 MB); ~10 s. Regras no mapa wayfinder "Completude de cada grupo da fauna brasileira". Números: 137.866 espécies aceitas, completude 57,3% (1.286.630 de 2.246.777 atributos), 21.734 sinônimos, 499 nomes não validados, 1 aceita sem grupo. |
| 2026-10-14 | `site/completude/` | Página publicada (variante A do protótipo, reescrita): matriz grupos × 18 atributos, gaveta do grupo, Domínio de Valores global; `metodo.html`; cartão em `site/index.html`. `prototipo/` removido (fonte nos commits 322ff98 e a398082). |
| 2026-10-14 | `site/completude/` | Drill-down por espécie (#9, #10): seção "Espécies" no painel lateral do grupo ("gaveta" no código) — subárvore inteira, nota crescente, filtro por atributo faltante, busca por nome, rolagem infinita. Exportador gera `data/especies/<filo>.json` (31 arquivos, 6,9 MB; Arthropoda 5,8 MB, 1,2 MB gzip), carregado sob demanda. Método atualizado. |
| 2026-10-14 | `site/completude/` | Painel lateral: botão "Ver as N espécies" no topo; seções "Os 18 atributos", "Domínio de Valores" e "Espécies" (nesta ordem) colapsáveis com `<details>`, abertas por padrão. |
| 2026-10-14 | `site/comum/` | Cabeçalho de todas as páginas: marca (serif 1,2rem) e, abaixo, "Criado por Eduardo Dalcin - 2026 · Código no GitHub" (serif 1rem), ambos na cor do texto. Inserido por `comum.js`; saiu do rodapé. Repositório tornado público. |
| 2026-10-14 | `site/*.html` | Código de rastreamento Matomo (`matomo.dalc.in`, site 12) antes de `</head>` nas 5 páginas públicas. |

## 2. Onde paramos

Mapa wayfinder [Completude de cada grupo da fauna brasileira](https://github.com/edalcin/faunaAnalises/issues/1) fechado: destino atingido em <https://web.dalc.in/faunabr/completude/>. Sem issues abertas. Próximo passo: escolher o tema da próxima análise e abrir novo mapa wayfinder.

**Publicação:** copiar `site/` para `S:\appsdata\web.dalc.in\faunabr`. O HTML não fica em cache no Cloudflare; JS/CSS ficam 4 h (`max-age=14400`). Para o browser pegar a versão nova sem purgar o cache, trocar o `?v=<commit>` nos links de JS/CSS do `index.html` alterado (feito em `grafo/`). Commit/push **não** publica — a cópia é manual. Última publicação: `grafo/` em 2026-10-16 (commit `8e16500`: aba Taxonomistas — coordenação direta (espécies sem outro coordenador abaixo, divididas ÷N), abrangência, faixa de pontos log, "Encontre seu nome", agrupamento por classe, atividade; painel da pessoa mostra os dois números).

## 3. Pendências e ideias

- [ ] **Próximas análises da série** — Cada uma: nova pasta `site/<slug>/`, exportador em `scripts/`, cartão em `site/index.html`, página de método própria.
- [ ] **Atualização com novo dump** — o pipeline é manual (README §Pipeline). Considerar um script único (dump → SQLite → JSON → cópia) se a atualização ficar frequente.
- [ ] **Usuários "(inativo)"** — alguns `usuario.nome_completo` do CTFB trazem "(inativo)", embora `status` seja ATIVO para todos. Avaliar se isso deve pesar no estado do grupo.
- [ ] **Views do PostgreSQL** — as 26 views, funções e triggers não foram para o SQLite. Reescrever as que uma análise precisar.
- [ ] **Campanha de edição de 2026** — mai–ago/2026 faz quase todo coordenador parecer ativo; revisar os estados quando houver dump posterior.
