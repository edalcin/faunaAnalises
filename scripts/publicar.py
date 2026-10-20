"""Publica site/ em DESTINO, com ?v=<commit atual> em todos os links e imports versionados.

Uso: python scripts/publicar.py [destino]
O ?v= é trocado só na cópia publicada; os arquivos do repositório não mudam.
"""
import re, shutil, subprocess, sys
from pathlib import Path

DESTINO = Path(sys.argv[1] if len(sys.argv) > 1 else r"S:\appsdata\web.dalc.in\faunabr")
SITE = Path(__file__).resolve().parent.parent / "site"

git = lambda *a: subprocess.run(["git", *a], cwd=SITE, capture_output=True, text=True, check=True).stdout.strip()
if git("status", "--porcelain", "--", "."):
    sys.exit("site/ tem mudanças sem commit: faça o commit antes de publicar.")
if not DESTINO.is_dir():
    sys.exit(f"Destino não existe: {DESTINO}")
v = git("rev-parse", "--short", "HEAD")

shutil.copytree(SITE, DESTINO, dirs_exist_ok=True)
n = 0
for f in DESTINO.rglob("*"):
    if f.suffix in (".html", ".js") and "vendor" not in f.parts:
        s = f.read_text(encoding="utf-8")
        t = re.sub(r"\?v=[0-9a-f]{7,}\b", f"?v={v}", s)
        if t != s:
            f.write_text(t, encoding="utf-8", newline="")
            n += 1
print(f"Publicado em {DESTINO} com ?v={v} ({n} arquivos com versão).")
