# /// script
# dependencies = ["psycopg[binary]"]
# ///
"""Copia um banco PostgreSQL (restaurado do dump do CTFB) para um arquivo SQLite.

Uso: uv run pg2sqlite.py "postgresql://postgres:SENHA@127.0.0.1:5433/fauna" fauna.sqlite

Copia: tabelas e matviews (dados), PK, UNIQUE, FK, índices btree simples.
Não copia: views, funções, triggers, CHECK, defaults (sintaxe específica do PostgreSQL).
Só o schema public: carga (staging), historico (auditoria em massa), postgrest e ipt_fauna
(views de publicação) ficam de fora — não têm dado de espécie que não esteja em public.
Tipos: int/bool -> INTEGER; float -> REAL; resto -> TEXT (timestamp/date/interval em ISO,
json/hstore/arrays como JSON).
"""
import sqlite3
import sys

import psycopg

DSN, OUT = sys.argv[1], sys.argv[2]
SCHEMAS = ["public"]
BATCH = 50_000

INT = {"int2", "int4", "int8", "bool"}
REAL = {"float4", "float8", "numeric"}
RAW = {"text", "varchar", "bpchar", "name"}


def q(ident):
    return '"' + ident.replace('"', '""') + '"'


def sqlite_type(typname):
    return "INTEGER" if typname in INT else "REAL" if typname in REAL else "TEXT"


def select_expr(col, typname, category):
    c = f"q.{q(col)}"
    if typname in INT or typname in RAW:
        return c
    if typname in REAL:
        return f"{c}::float8"
    if typname == "hstore":
        return f"hstore_to_json({c})::text"
    if category == "A":
        return f"to_json({c})::text"
    return f"{c}::text"


pg = psycopg.connect(DSN, autocommit=True)
pg.execute("SET search_path = public")
lite = sqlite3.connect(OUT)
lite.executescript(
    "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA foreign_keys=OFF;"
    "PRAGMA cache_size=-1000000; PRAGMA temp_store=MEMORY;"
)

rels = pg.execute(
    """select c.oid, n.nspname, c.relname, c.relkind, coalesce(m.ispopulated, true)
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       left join pg_matviews m on m.schemaname=n.nspname and m.matviewname=c.relname
       where n.nspname = any(%s) and c.relkind in ('r','m') order by 2,3""",
    (SCHEMAS,),
).fetchall()

# --- DDL ---------------------------------------------------------------
cons = {}
for ctype, ns, rel, cols, fns, frel, fcols, ondel, onupd in pg.execute(
    """select con.contype, ns.nspname, cl.relname,
         array(select a.attname::text from unnest(con.conkey) with ordinality k(n,o)
               join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.n order by k.o),
         fns.nspname, fcl.relname,
         array(select a.attname::text from unnest(con.confkey) with ordinality k(n,o)
               join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.n order by k.o),
         con.confdeltype, con.confupdtype
       from pg_constraint con
       join pg_class cl on cl.oid=con.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
       left join pg_class fcl on fcl.oid=con.confrelid
       left join pg_namespace fns on fns.oid=fcl.relnamespace
       where con.contype in ('p','u','f') and ns.nspname = any(%s) and cl.relkind='r'
       order by con.conname""",
    (SCHEMAS,),
):
    cons.setdefault((ns, rel), []).append((ctype, cols, fns, frel, fcols, ondel, onupd))

ACTION = {"a": "NO ACTION", "r": "RESTRICT", "c": "CASCADE", "n": "SET NULL", "d": "SET DEFAULT"}
meta = {}  # (schema, table) -> (relation sql, [(col, expr)], populated)
for oid, s, t, kind, populated in rels:
    attrs = pg.execute(
        """select a.attname, ty.typname, ty.typcategory, a.attnotnull
           from pg_attribute a join pg_type ty on ty.oid=a.atttypid
           where a.attrelid=%s and a.attnum>0 and not a.attisdropped order by a.attnum""",
        (oid,),
    ).fetchall()
    pk = next((c[1] for c in cons.get((s, t), []) if c[0] == "p"), [])
    lines = []
    for col, typ, cat, notnull in attrs:
        decl = f"{q(col)} {sqlite_type(typ)}"
        if pk == [col] and sqlite_type(typ) == "INTEGER":
            decl += " PRIMARY KEY"
        elif notnull:
            decl += " NOT NULL"
        lines.append(decl)
    for ctype, cols, fns, frel, fcols, ondel, onupd in cons.get((s, t), []):
        cl = ", ".join(q(c) for c in cols)
        if ctype == "p" and not (len(cols) == 1 and f"{q(cols[0])} INTEGER PRIMARY KEY" in lines):
            lines.append(f"PRIMARY KEY ({cl})")
        elif ctype == "u":
            lines.append(f"UNIQUE ({cl})")
        elif ctype == "f":
            lines.append(
                f"FOREIGN KEY ({cl}) REFERENCES {q(frel)} "
                f"({', '.join(q(c) for c in fcols)}) "
                f"ON DELETE {ACTION[ondel]} ON UPDATE {ACTION[onupd]}"
            )
    lite.execute(f"CREATE TABLE {q(t)} ({', '.join(lines)})")
    if populated:
        src = f"{q(s)}.{q(t)}"
    else:  # matview sem dados: roda a query de definição
        src = "(" + pg.execute("select pg_get_viewdef(%s)", (oid,)).fetchone()[0].rstrip().rstrip(";") + ")"
    meta[(s, t)] = (src, [(c, select_expr(c, ty, cat)) for c, ty, cat, _ in attrs])

# --- dados ---------------------------------------------------------------
bad = []
for _, s, t, _, _ in rels:
    src, cols = meta[(s, t)]
    sel = ", ".join(e for _, e in cols)
    ins = f"INSERT INTO {q(t)} VALUES ({','.join('?' * len(cols))})"
    n = 0
    with pg.transaction(), pg.cursor(name="c") as cur:
        cur.itersize = BATCH
        cur.execute(f"select {sel} from {src} q")
        lite.execute("BEGIN")
        while rows := cur.fetchmany(BATCH):
            lite.executemany(ins, rows)
            n += len(rows)
        lite.execute("COMMIT")
    expected = pg.execute(f"select count(*) from {src} q").fetchone()[0]
    flag = "" if n == expected else f"  <-- DIVERGE (pg={expected})"
    if flag:
        bad.append(t)
    print(f"{t:45} {n:>10}{flag}", flush=True)

# --- índices -------------------------------------------------------------
for k, (ns, tbl, uniq, cols) in enumerate(
    pg.execute(
        """select ns.nspname, t.relname, ix.indisunique,
             array(select a.attname::text from unnest(ix.indkey::int2[]) with ordinality k(n,o)
                   join pg_attribute a on a.attrelid=ix.indrelid and a.attnum=k.n order by k.o)
           from pg_index ix join pg_class i on i.oid=ix.indexrelid
           join pg_class t on t.oid=ix.indrelid join pg_namespace ns on ns.oid=t.relnamespace
           join pg_am am on am.oid=i.relam
           where ns.nspname = any(%s) and t.relkind in ('r','m') and am.amname='btree'
             and not ix.indisprimary and ix.indisvalid and ix.indpred is null and ix.indexprs is null
             and not exists (select 1 from pg_constraint c where c.conindid=ix.indexrelid)""",
        (SCHEMAS,),
    )
):
    lite.execute(
        f"CREATE {'UNIQUE ' if uniq else ''}INDEX ix_{k} ON {q(tbl)} ({', '.join(q(c) for c in cols)})"
    )

# Busca por substring/case-insensitive em nomes científicos: WHERE taxon_name_fts MATCH 'panthera leo'
lite.executescript(
    """CREATE VIRTUAL TABLE taxon_name_fts USING fts5(name_cache, autor, content='taxon_name_base',
         content_rowid='id', tokenize='trigram');
       INSERT INTO taxon_name_fts(rowid, name_cache, autor) SELECT id, name_cache, autor FROM taxon_name_base;"""
)

fk_bad = lite.execute("PRAGMA foreign_key_check").fetchall()
lite.execute("ANALYZE")
lite.commit()
print(f"\ntabelas divergentes: {bad or 'nenhuma'}; violações de FK: {len(fk_bad)}")
