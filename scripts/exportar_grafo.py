"""Exporta o JSON da análise "Quem cuida de cada grupo" a partir do fauna.sqlite.

Uso: python scripts/exportar_grafo.py [dados/fauna.sqlite] [site/grafo/data/grafo.json]

Regras (decididas no mapa https://github.com/edalcin/faunabr/issues/1; termos do glossário CONTEXT.md do FaunaBR):
- grupo = nó de lista_node com táxon não sinônimo; pai = ancestral mais próximo que também é nó.
- cobertura = coordenação do nó coordenado mais próximo (o próprio ou o ancestral mais próximo).
- atividade = última edição (ALTERACAO/INCLUSAO/REMOCAO/MOVIMENTACAO) de um coordenador
  em registros da subárvore do nó coordenado.
- estado: ativo <= ATIVO anos; risco <= RISCO anos; orfao acima disso ou sem coordenação;
  agregador = sem coordenação no nó nem acima, mas com coordenação em subgrupos.
- data de referência = última data do historico (data do dump).
Nunca exporta e-mail nem login.
"""
import json
import sqlite3
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ATIVO, RISCO = 1, 3  # anos
EDICAO = ("ALTERACAO", "INCLUSAO", "REMOCAO", "MOVIMENTACAO")

raiz = Path(__file__).absolute().parents[1]
db = Path(sys.argv[1]) if len(sys.argv) > 1 else raiz / "dados/fauna.sqlite"
saida = Path(sys.argv[2]) if len(sys.argv) > 2 else raiz / "site/grafo/data/grafo.json"

c = sqlite3.connect(f"file:{db.absolute().as_posix()}?mode=ro", uri=True)
q = lambda s, *a: c.execute(s, a).fetchall()

ref = date.fromisoformat(q("select max(data) from historico")[0][0][:10])
parent = dict(q("select id, parent_fk from taxon_base"))
taxa = {r[0]: r[1:] for r in q(
    """select tb.id, tn.name_cache, tn.rank from taxon_base tb
       join taxon_name_base tn on tn.id = tb.taxon_name_base_fk where coalesce(tb.is_synonym, 0) = 0""")}
no_de_taxon = {tid: nid for nid, tid in q("select id, taxon_base_fk from lista_node where taxon_base_fk is not null")
               if tid in taxa}


def ancestrais(tid):
    t = parent.get(tid)
    while t is not None:
        yield t
        t = parent.get(t)


grupos = {}
for tid, nid in no_de_taxon.items():
    pai = next((no_de_taxon[a] for a in ancestrais(tid) if a in no_de_taxon), None)
    grupos[nid] = {"id": nid, "nome": taxa[tid][0], "rank": taxa[tid][1], "pai": pai, "tid": tid,
                   "especies": 0, "especies_diretas": 0}

for tid, (_, rank) in taxa.items():  # espécies aceitas na subárvore; "diretas" = o grupo mais próximo é este
    if rank == "ESPECIE":
        nos = [no_de_taxon[a] for a in (tid, *ancestrais(tid)) if a in no_de_taxon]
        for n in nos:
            grupos[n]["especies"] += 1
        if nos:
            grupos[nos[0]]["especies_diretas"] += 1

perm = [(u, n, p) for u, n, p in q("select usuario_fk, lista_node_fk, perfil from permissao_acesso_lista") if n in grupos]
coords = {}
for u, n, p in perm:
    if p == "COORDENADOR":
        coords.setdefault(n, set()).add(u)

# última edição de cada coordenador dentro da subárvore do nó que coordena
tid_coord = {grupos[n]["tid"]: n for n in coords}
ultima = {}
for u, tid, d in q(f"""select h.usuario_fk, d.taxon_base_fk, max(h.data) from historico h
                       join dados_lista_brasil d on d.id = h.dados_lista_brasil_fk
                       where h.tipo in {EDICAO} group by 1, 2"""):
    for a in (tid, *ancestrais(tid)):
        n = tid_coord.get(a)
        if n is not None and u in coords[n] and d > ultima.get((u, n), ""):
            ultima[(u, n)] = d

# grupos com coordenação em algum descendente (para o estado agregador)
com_coord_abaixo = set()
for n in coords:
    p = grupos[n]["pai"]
    while p is not None and p not in com_coord_abaixo:
        com_coord_abaixo.add(p)
        p = grupos[p]["pai"]


def coordenado_mais_proximo(n):
    while n is not None and n not in coords:
        n = grupos[n]["pai"]
    return n


for n, g in grupos.items():
    cn = coordenado_mais_proximo(n)
    ult = None
    if cn is None:
        estado = "agregador" if n in com_coord_abaixo else "orfao"
    else:
        ult = max((ultima.get((u, cn), "") for u in coords[cn]), default="")[:10] or None
        anos = None if ult is None else (ref - date.fromisoformat(ult)).days / 365.25
        estado = "orfao" if anos is None or anos > RISCO else "risco" if anos > ATIVO else "ativo"
    g.update(coordenado_por=cn, ultima_edicao=ult, estado=estado, proprio=n in coords)
    del g["tid"]

usuarios = {u: {"id": u, "nome": " ".join((nome or "").split()), "instituicao": sig or inst} for u, nome, sig, inst in q(
    """select u.id, u.nome_completo, i.sigla, i.nome from usuario u left join instituicao i on i.id = u.instituicao_fk""")}
usados = sorted({u for u, _, _ in perm})

estados = Counter(g["estado"] for g in grupos.values())
assert sum(estados.values()) == len(grupos)
assert all(g["coordenado_por"] is None for g in grupos.values() if g["estado"] == "agregador")

saida.parent.mkdir(parents=True, exist_ok=True)
saida.write_text(json.dumps({
    "referencia": ref.isoformat(),
    "cortes_anos": {"ativo": ATIVO, "risco": RISCO},
    "grupos": list(grupos.values()),
    "usuarios": [usuarios[u] for u in usados],
    "vinculos": [{"u": u, "g": n, "perfil": p, "ultima_edicao": (ultima.get((u, n)) or "")[:10] or None}
                 for u, n, p in perm],
}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{saida}: referência {ref}, {len(grupos)} grupos {dict(estados)}, {len(usados)} taxonomistas, {len(perm)} vínculos")
