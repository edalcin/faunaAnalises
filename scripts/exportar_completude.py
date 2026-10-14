"""Exporta os JSON da análise "Completude de cada grupo da fauna brasileira" a partir do fauna.sqlite.

Uso: python scripts/exportar_completude.py [fauna.sqlite] [pasta de saída]
Padrão: dados/fauna.sqlite -> site/completude/data/{completude,valores}.json e data/especies/<filo>.json

Regras (mapa wayfinder edalcin/faunaAnalises#1):
- Unidade: espécie aceita (is_synonym = 0), rank ESPECIE ou SUB_ESPECIE.
- 18 atributos em 4 domínios; preenchido = conteúdo útil; "não se aplica" sai do denominador.
- Grupo = nó de lista_node (como em exportar_grafo.py); nota do grupo = Σ preenchidos ÷ Σ aplicáveis
  da subárvore; "diretas" = espécies cujo grupo mais próximo é este.
- Domínios de Valores: os CHECK dos 18 atributos, lidos de dados/modeloERctf.md; espécie conta uma vez
  por valor. "% com valor" usa os aplicáveis do atributo ligado; VAZIO não conta como valor.
- Espécies (#9): um arquivo por filo (id do grupo raiz) com [nome, grupo mais próximo, 18 chars
  p = preenchido, f = faltante, n = não se aplica]; espécies sem grupo ficam fora.
"""
import html
import json
import re
import sqlite3
import sys
from pathlib import Path

raiz = Path(__file__).absolute().parents[1]
db = Path(sys.argv[1]) if len(sys.argv) > 1 else raiz / "dados/fauna.sqlite"
saida = Path(sys.argv[2]) if len(sys.argv) > 2 else raiz / "site/completude/data"

ATRIBUTOS = [  # (id, nome, domínio)
    ("autor", "Autor", 0), ("ano", "Ano", 0), ("disponibilidade", "Disponibilidade", 0),
    ("pai", "Táxon-pai", 0), ("id_externo", "ID externo", 0),
    ("origem", "Origem", 1), ("endemismo", "Endemismo", 1), ("ambiente", "Ambiente", 1),
    ("uf", "UF de ocorrência", 1), ("paises", "Países", 1), ("dom_bio", "Domínio biogeográfico", 1),
    ("forma_vida", "Forma de vida", 2), ("substrato", "Substrato", 2), ("hospedeiro", "Hospedeiro", 2),
    ("vernaculo", "Nome vernáculo", 2),
    ("publicacao", "Publicação original", 3), ("material_tipo", "Material-tipo", 3), ("voucher", "Voucher", 3),
]
DOMINIOS = ["Núcleo taxonômico", "Distribuição geográfica e ecológica",
            "Atributos biológicos e hospedeiros", "Referências, vouchers e mídia"]
A = {a[0]: i for i, a in enumerate(ATRIBUTOS)}
PARASITA = {"ECTOPARASITO", "ENDOPARASITO", "ECTOPARASITOIDE", "ENDOPARASITOIDE", "HIPERPARASITOIDE"}

# Domínios de Valores: (id, tabela.coluna no modelo, nome, atributo ligado, consulta hub -> valor)
CAMPOS = [
    ("origem", "distribuicao.origem", "Origem", "origem",
     "select di.dados_lista_brasil_fk, di.origem from distribuicao di where di.origem is not null"),
    ("ambiente", "ambiente.tipo", "Ambiente", "ambiente",
     """select di.dados_lista_brasil_fk, a.tipo from distribuicao di
        join ambiente_distribuicao x on x.distribuicao_fk = di.id join ambiente a on a.id = x.ambiente_fk"""),
    ("uf", "abrangencia_geografica.estado", "UF de ocorrência", "uf",
     """select di.dados_lista_brasil_fk, g.estado from distribuicao di
        join distribuicao_abrangencia x on x.distribuicao_fk = di.id
        join abrangencia_geografica g on g.id = x.abrangencia_geografica_fk"""),
    ("pais", "pais.nome", "Países", "paises",
     """select di.dados_lista_brasil_fk, p.nome from distribuicao di
        join distribuicao_paises x on x.distribuicao_fk = di.id join pais p on p.id = x.paises_fk"""),
    ("dom_marinho", "dom_bio_marinho.nome_marinho", "Domínio marinho", "dom_bio",
     """select di.dados_lista_brasil_fk, m.nome_marinho from distribuicao di
        join distribuicao_dom_bio_marinho x on x.distribuicao_fk = di.id join dom_bio_marinho m on m.id = x.dom_bio_marinho_fk"""),
    ("dom_epicontinental", "dom_bio_epicontinental.nome", "Domínio epicontinental", "dom_bio",
     """select di.dados_lista_brasil_fk, e.nome from distribuicao di
        join distribuicao_dom_bio_epicontin x on x.distribuicao_fk = di.id
        join dom_bio_epicontinental e on e.id = x.dom_bio_epicontinental_fk"""),
    ("bacia", "abrangencia_hidrografica.bacias_hidrograficas", "Bacia hidrográfica", "dom_bio",
     """select di.dados_lista_brasil_fk, b.bacias_hidrograficas from distribuicao di
        join distribuicao_hidrografica x on x.distribuicao_fk = di.id
        join abrangencia_hidrografica b on b.id = x.abrangencia_hidrografica_fk"""),
    ("regiao_marinha", "abrangencia_marinha.regioes_marinhas", "Região marinha", "dom_bio",
     """select di.dados_lista_brasil_fk, r.regioes_marinhas from distribuicao di
        join distribuicao_marinha x on x.distribuicao_fk = di.id join abrangencia_marinha r on r.id = x.abrangencia_marinha_fk"""),
    ("forma_vida", "forma_vida.tipo", "Forma de vida", "forma_vida",
     """select x.dados_lista_brasil_fk, f.tipo from dados_lista_brasil_forma_vida x join forma_vida f on f.id = x.forma_vida_fk"""),
    ("substrato", "substrato.tipo", "Substrato", "substrato",
     """select x.dados_lista_brasil_fk, s.tipo from dados_lista_brasil_substrato x join substrato s on s.id = x.substrato_fk"""),
    ("tipo_primario", "primario.tipo_primario", "Material-tipo primário", "material_tipo",
     "select dados_lista_brasil_fk, trim(tipo_primario) from primario where trim(coalesce(tipo_primario, '')) <> ''"),
    ("tipo_secundario", "secundario.tipo_secudario", "Material-tipo secundário", "material_tipo",
     "select dados_lista_brasil_fk, trim(tipo_secudario) from secundario where trim(coalesce(tipo_secudario, '')) <> ''"),
    ("tipo_coletivo", "coletivo.tipo_coletivo", "Material-tipo coletivo", "material_tipo",
     "select dados_lista_brasil_fk, trim(tipo_coletivo) from coletivo where trim(coalesce(tipo_coletivo, '')) <> ''"),
]
SEM_VALOR = {"VAZIO"}  # aparece como valor, mas não conta em "% com valor"


def check(modelo):
    """Listas CHECK de `dados/modeloERctf.md`, seção "Domínios de valores (CHECK)"."""
    return {m[1]: re.findall(r"`([^`]+)`", m[2])
            for m in re.finditer(r"^- `([a-z_]+\.[a-z_]+)`: (.+)$", modelo.read_text(encoding="utf-8"), re.M)}


def util(x):
    """Texto HTML escapado com conteúdo depois de remover tags e entidades."""
    if x is None:
        return False
    s = re.sub(r"<[^>]*>", "", html.unescape(x))
    return html.unescape(s).replace("\xa0", " ").strip() != ""


def cheio(x):
    return x is not None and str(x).strip() != ""


c = sqlite3.connect(f"file:{db.absolute().as_posix()}?mode=ro", uri=True)
q = lambda s, *a: c.execute(s, a).fetchall()
checks = check(db.parent / "modeloERctf.md")

ref = q("select max(data) from historico")[0][0][:10]
parent = dict(q("select id, parent_fk from taxon_base"))
aceitos_sup = {r[0]: r[1:] for r in q(
    """select tb.id, tn.name_cache, tn.rank from taxon_base tb
       join taxon_name_base tn on tn.id = tb.taxon_name_base_fk where coalesce(tb.is_synonym, 0) = 0""")}
no_de_taxon = {tid: nid for nid, tid in q("select id, taxon_base_fk from lista_node where taxon_base_fk is not null")
               if tid in aceitos_sup}


def ancestrais(tid):
    t = parent.get(tid)
    while t is not None:
        yield t
        t = parent.get(t)


def nos(tid):
    """Grupos da subárvore a que o táxon pertence, do mais próximo ao mais distante."""
    return [no_de_taxon[a] for a in (tid, *ancestrais(tid)) if a in no_de_taxon]


N = len(ATRIBUTOS)
grupos = {}
for tid, nid in no_de_taxon.items():
    pai = next((no_de_taxon[a] for a in ancestrais(tid) if a in no_de_taxon), None)
    grupos[nid] = {"id": nid, "nome": aceitos_sup[tid][0], "rank": aceitos_sup[tid][1], "pai": pai,
                   "especies": 0, "especies_diretas": 0, "p": [0] * N, "a": [0] * N, "diretas": [0, 0],
                   "sinonimos": 0, "nao_validados": 0}

# --- espécies aceitas e seus atributos -------------------------------------------------------------
esp = q("""select tb.id, tb.dados_lista_brasil_fk, tb.parent_fk, tb.disponibilidade, tn.autor, tn.ano,
                  h.zoo_bank, h.species_id, h.bibliografia_referencia, json_type(h.campos_json, '$.bibliografia.main'),
                  h.voucher_fauna, h.hospedeiro_fk, di.origem, di.endemica_brasil, tn.name_cache
           from taxon_base tb join taxon_name_base tn on tn.id = tb.taxon_name_base_fk
           left join dados_lista_brasil h on h.id = tb.dados_lista_brasil_fk
           left join distribuicao di on di.id = h.distribuicao_fk
           where tb.is_synonym = 0 and tn.rank in ('ESPECIE', 'SUB_ESPECIE')""")
hubs = {e[1] for e in esp if e[1] is not None}

valores = {}  # campo -> hub -> set(valores)
for cid, _, _, _, sql in CAMPOS:
    v = valores[cid] = {}
    for hub, val in q(sql):
        if hub in hubs:
            v.setdefault(hub, set()).add(val)

com_hosp = {k for (k,) in q("""select hospedeiro_fk from hospedeiro_vegetal union select hospedeiro_fk from animal_host_name_hospedeiro
                               union select hospedeiro_fk from hospedeiro_hospedeiros_animais
                               union select id from hospedeiro where indeterminado = 1""")}
vernaculo = {k for (k,) in q("select dados_lista_brasil_fk from nm_vernaculo where trim(coalesce(nome, '')) <> ''")}
ANO = re.compile(r"^\d{4}$")


def atributos(e):
    tid, hub, pai, disp, autor, ano, zoo, sid, bib, csl, vouch, hosp, origem, endem, _ = e
    val = lambda cid: valores[cid].get(hub, ())
    formas = val("forma_vida")
    r = [None] * N
    r[A["autor"]] = cheio(autor)
    r[A["ano"]] = ano is not None and bool(ANO.match(str(ano).strip()))
    r[A["disponibilidade"]] = cheio(disp)
    r[A["pai"]] = pai is not None
    r[A["id_externo"]] = (cheio(zoo) and zoo.strip().lower() != "none") or cheio(sid)
    r[A["origem"]] = origem is not None
    r[A["endemismo"]] = endem is not None
    r[A["ambiente"]] = bool(set(val("ambiente")) - SEM_VALOR)
    r[A["uf"]] = bool(val("uf"))
    if endem is not None and not endem:  # países só para não endêmicas
        r[A["paises"]] = bool(set(val("pais")) - {"BRAZIL"})
    r[A["dom_bio"]] = any(val(k) for k in ("dom_marinho", "dom_epicontinental", "bacia", "regiao_marinha"))
    r[A["forma_vida"]] = bool(formas)
    r[A["substrato"]] = bool(val("substrato"))
    if PARASITA & set(formas):  # hospedeiro só para parasitas
        r[A["hospedeiro"]] = hosp in com_hosp
    r[A["vernaculo"]] = hub in vernaculo
    r[A["publicacao"]] = util(bib) or csl == "object"
    r[A["material_tipo"]] = any(val(k) for k in ("tipo_primario", "tipo_secundario", "tipo_coletivo"))
    r[A["voucher"]] = util(vouch)
    return r


campo_atr = {cid: A[atr] for cid, _, _, atr, _ in CAMPOS}
total = {"p": [0] * N, "a": [0] * N}
val_global = {cid: {} for cid, *_ in CAMPOS}
val_grupo = {}  # gid -> campo -> valor -> n ("" = espécies aplicáveis com algum valor)
sem_grupo = 0
por_filo = {}  # id do grupo raiz -> [[nome, grupo mais próximo, "pfn…"]]
for e in esp:
    r = atributos(e)
    ns = nos(e[0])
    if not ns:
        sem_grupo += 1
    else:
        por_filo.setdefault(ns[-1], []).append([e[-1], ns[0], "".join("n" if x is None else "pf"[not x] for x in r)])
    for i, x in enumerate(r):
        if x is not None:
            total["a"][i] += 1
            total["p"][i] += x
    for k, n in enumerate(ns):
        g = grupos[n]
        g["especies"] += 1
        for i, x in enumerate(r):
            if x is not None:
                g["a"][i] += 1
                g["p"][i] += x
        if k == 0:
            g["especies_diretas"] += 1
            g["diretas"][0] += sum(x for x in r if x is not None)
            g["diretas"][1] += sum(x is not None for x in r)
    for cid, *_ in CAMPOS:
        vs = valores[cid].get(e[1])
        if not vs:
            continue
        aplic = r[campo_atr[cid]] is not None
        chaves = [*vs, ""] if aplic and vs - SEM_VALOR else list(vs)
        for dest in [val_global[cid], *(val_grupo.setdefault(n, {}).setdefault(cid, {}) for n in ns)]:
            for v in chaves:
                dest[v] = dest.get(v, 0) + 1

# --- nomes validados e não validados (sinônimos e sem status, só contagem) ---------------------------
nomes = {"aceitos": len(esp), "sinonimos": 0, "nao_validados": {}}
for tid, sin, disp in q("""select tb.id, tb.is_synonym, tb.disponibilidade from taxon_base tb
                           join taxon_name_base tn on tn.id = tb.taxon_name_base_fk
                           where tn.rank in ('ESPECIE', 'SUB_ESPECIE') and coalesce(tb.is_synonym, 1) = 1"""):
    if sin == 1:
        nomes["sinonimos"] += 1
    else:
        nv = nomes["nao_validados"]
        nv[disp or "SEM_VALOR"] = nv.get(disp or "SEM_VALOR", 0) + 1
    for n in nos(tid):
        grupos[n]["sinonimos" if sin == 1 else "nao_validados"] += 1

assert len(esp) == sum(grupos[n]["especies_diretas"] for n in grupos) + sem_grupo
assert all(p <= a for g in grupos.values() for p, a in zip(g["p"], g["a"]))

saida.mkdir(parents=True, exist_ok=True)
compacto = dict(ensure_ascii=False, separators=(",", ":"))
(saida / "completude.json").write_text(json.dumps({
    "referencia": ref,
    "dominios": DOMINIOS,
    "atributos": [{"id": i, "nome": nome, "dominio": d} for i, nome, d in ATRIBUTOS],
    "fora_da_nota": [{"nome": "Imagens", "motivo": "sem dados no CTFB"}],
    "nomes": nomes,
    "total": total,
    "sem_grupo": sem_grupo,
    "grupos": list(grupos.values()),
}, **compacto), encoding="utf-8")
(saida / "valores.json").write_text(json.dumps({
    "campos": [{"id": cid, "coluna": col, "nome": nome, "atributo": atr,
                "check": checks[col]} for cid, col, nome, atr, _ in CAMPOS],
    "global": val_global,
    "grupos": val_grupo,
}, **compacto), encoding="utf-8")
(saida / "especies").mkdir(exist_ok=True)
for f in (saida / "especies").glob("*.json"):
    f.unlink()
for filo, lista in por_filo.items():
    (saida / "especies" / f"{filo}.json").write_text(json.dumps(lista, **compacto), encoding="utf-8")

nota = sum(total["p"]) / sum(total["a"])
print(f"{saida}: referência {ref}, {len(esp)} espécies aceitas ({sem_grupo} sem grupo), {len(grupos)} grupos, "
      f"completude {nota:.1%}, {nomes['sinonimos']} sinônimos, não validados {nomes['nao_validados']}")
