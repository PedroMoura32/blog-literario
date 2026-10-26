#!/usr/bin/env python3
"""Valida os posts em data/posts/<tema>/*.json e reconstrói data/index.json.

Uso:
  python3 scripts/rebuild_index.py                       # valida e reindexa
  python3 scripts/rebuild_index.py --remover-exemplos    # apaga posts com "exemplo": true
  python3 scripts/rebuild_index.py --remover-mais-antigos-que 90   # apaga posts com mais de 90 dias

Se houver qualquer erro de validação, o índice NÃO é gravado e o código de saída é 1.
"""
import argparse
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
DADOS = RAIZ / "data"
FUSO = ZoneInfo("America/Sao_Paulo")

FORMATOS = {"reportagem", "em-1-minuto", "indicacao", "comentarios", "leituras"}
FORMATOS_COM_LIVRO = {"indicacao", "comentarios"}
ESTILOS = {"noticia", "indicacao", "comentarios"}
BLOCOS = {"p", "h2", "h3", "ul", "ol", "callout"}
RE_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")
RE_ARQUIVO = re.compile(r"^(\d{4}-\d{2}-\d{2})-[a-z0-9][a-z0-9-]*\.json$")
RE_COR = re.compile(r"^#[0-9a-fA-F]{6}$")
RE_CITACAO = re.compile(r"[\"“]([^\"“”]+)[\"”]")
LIMITE_CITACAO = 14  # palavras; a regra é "menos de 15 palavras"


def ler_json(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def url_ok(u):
    return isinstance(u, str) and re.match(r"^https?://[^\s]+$", u) is not None


def normalizar(txt):
    """Minúsculas, sem acento e sem pontuação, para comparar títulos."""
    base = unicodedata.normalize("NFD", str(txt))
    base = "".join(c for c in base if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", base.lower()).strip()


def validar_temas(temas, erros):
    slugs = set()
    if not isinstance(temas, list) or not temas:
        erros.append("data/temas.json deve ser uma lista com ao menos um tema")
        return slugs
    for i, t in enumerate(temas):
        r = f"temas.json[{i}]"
        if not isinstance(t, dict):
            erros.append(f"{r}: deve ser um objeto")
            continue
        slug = t.get("slug")
        if not isinstance(slug, str) or not RE_SLUG.match(slug):
            erros.append(f"{r}: slug inválido (use minúsculas, números e hífen)")
        elif slug in slugs:
            erros.append(f"{r}: slug repetido ({slug})")
        else:
            slugs.add(slug)
        for campo in ("nome", "descricao"):
            if not isinstance(t.get(campo), str) or not t[campo].strip():
                erros.append(f"{r}: '{campo}' obrigatório")
        if t.get("estilo") not in ESTILOS:
            erros.append(f"{r}: estilo deve ser um de {sorted(ESTILOS)}")
        fm = t.get("formatos")
        if not isinstance(fm, list) or not fm or any(f not in FORMATOS for f in fm):
            erros.append(f"{r}: formatos deve ser lista com valores de {sorted(FORMATOS)}")
        for campo in ("validade_dias", "janela_horas", "max_posts_por_dia"):
            v = t.get(campo)
            if not isinstance(v, int) or isinstance(v, bool) or v < 1:
                erros.append(f"{r}: '{campo}' deve ser inteiro >= 1")
        if not isinstance(t.get("cor"), str) or not RE_COR.match(t["cor"]):
            erros.append(f"{r}: cor deve ser hexadecimal, ex.: #7B1E3A")
        if not isinstance(t.get("ativo"), bool):
            erros.append(f"{r}: 'ativo' deve ser true ou false")
    return slugs


def validar_estante(estante, erros):
    """Valida data/estante.json e devolve o conjunto de títulos já lidos (normalizados)."""
    lidos = set()
    r = "data/estante.json"
    if not isinstance(estante, dict):
        erros.append(f"{r}: deve ser um objeto")
        return lidos
    livros = estante.get("livros")
    if not isinstance(livros, list):
        erros.append(f"{r}: 'livros' deve ser uma lista")
        return lidos
    ids = set()
    for i, lv in enumerate(livros):
        rr = f"{r} livros[{i}]"
        if not isinstance(lv, dict):
            erros.append(f"{rr}: deve ser um objeto")
            continue
        lid = lv.get("id")
        if not isinstance(lid, str) or not RE_SLUG.match(lid):
            erros.append(f"{rr}: 'id' inválido (minúsculas, números e hífen)")
        elif lid in ids:
            erros.append(f"{rr}: id repetido ({lid})")
        else:
            ids.add(lid)
        for campo in ("titulo", "autor"):
            if not isinstance(lv.get(campo), str) or not lv[campo].strip():
                erros.append(f"{rr}: '{campo}' obrigatório")
        nota = lv.get("nota")
        if nota is not None and (not isinstance(nota, int) or isinstance(nota, bool) or not 1 <= nota <= 5):
            erros.append(f"{rr}: 'nota' deve ser inteiro de 1 a 5, ou null")
        com = lv.get("comentario")
        if com is not None and (not isinstance(com, str) or len(com) > 280):
            erros.append(f"{rr}: 'comentario' deve ser texto de até 280 caracteres, ou null")
        if isinstance(lv.get("titulo"), str):
            lidos.add(normalizar(lv["titulo"]))
    return lidos


def limpar_marcacao(txt):
    txt = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", txt)
    return txt.replace("**", "").replace("`", "").strip()


def pontos_do_post(corpo):
    """Primeiros itens da primeira lista do post, sem marcação (usados na capa)."""
    for b in corpo:
        if isinstance(b, dict) and b.get("tipo") in ("ul", "ol"):
            return [limpar_marcacao(x)[:140] for x in b.get("itens", [])[:3] if isinstance(x, str)]
    return []


def texto_do_bloco(b):
    if b.get("tipo") in ("ul", "ol"):
        return " ".join(b.get("itens", []))
    return " ".join(str(b.get(k, "")) for k in ("titulo", "texto"))


def textos_do_post(p, corpo):
    saida = [p.get("titulo", ""), p.get("resumo", "")]
    saida += [texto_do_bloco(b) for b in corpo if isinstance(b, dict)]
    return [t for t in saida if isinstance(t, str)]


def validar_livro(p, r, formato, lidos, erros):
    """Posts de indicação e de comentários precisam dizer de qual livro falam."""
    livro = p.get("livro")
    if formato in FORMATOS_COM_LIVRO:
        if not isinstance(livro, dict) or not all(isinstance(livro.get(k), str) and livro[k].strip() for k in ("titulo", "autor")):
            erros.append(f"{r}: formato '{formato}' exige 'livro': {{\"titulo\": ..., \"autor\": ...}}")
            return None
        if formato == "indicacao" and normalizar(livro["titulo"]) in lidos:
            erros.append(f"{r}: '{livro['titulo']}' já está na Estante; indique um livro que ainda não foi lido")
    elif livro is not None:
        if not isinstance(livro, dict) or not all(isinstance(livro.get(k), str) and livro[k].strip() for k in ("titulo", "autor")):
            erros.append(f"{r}: 'livro' deve ter 'titulo' e 'autor' (texto)")
            return None
    if isinstance(livro, dict):
        return {"titulo": livro["titulo"].strip(), "autor": livro["autor"].strip()}
    return None


def validar_post(p, caminho, tema, hoje, lidos, erros):
    r = str(caminho.relative_to(RAIZ))
    if not isinstance(p, dict):
        erros.append(f"{r}: deve ser um objeto")
        return None
    m = RE_ARQUIVO.match(caminho.name)
    if not m:
        erros.append(f"{r}: nome do arquivo deve ser AAAA-MM-DD-slug.json")
        return None
    titulo = p.get("titulo")
    if not isinstance(titulo, str) or not (5 <= len(titulo.strip()) <= 140):
        erros.append(f"{r}: 'titulo' obrigatório (5 a 140 caracteres)")
    resumo = p.get("resumo")
    if not isinstance(resumo, str) or not (20 <= len(resumo.strip()) <= 300):
        erros.append(f"{r}: 'resumo' obrigatório (20 a 300 caracteres)")
    formato = p.get("formato")
    if formato not in FORMATOS:
        erros.append(f"{r}: formato deve ser um de {sorted(FORMATOS)}")
    elif formato not in tema["formatos"]:
        erros.append(f"{r}: formato '{formato}' não permitido no tema '{tema['slug']}' ({tema['formatos']})")
    d = p.get("data")
    try:
        dd = date.fromisoformat(d)
        if dd > hoje + timedelta(days=1):
            erros.append(f"{r}: data no futuro ({d})")
        if d != m.group(1):
            erros.append(f"{r}: data ({d}) difere do prefixo do arquivo ({m.group(1)})")
    except (TypeError, ValueError):
        erros.append(f"{r}: 'data' deve ser AAAA-MM-DD")
        dd = None
    corpo = p.get("corpo")
    if not isinstance(corpo, list) or not corpo:
        erros.append(f"{r}: 'corpo' deve ser lista de blocos")
        corpo = []
    for j, b in enumerate(corpo):
        if not isinstance(b, dict) or b.get("tipo") not in BLOCOS:
            erros.append(f"{r}: corpo[{j}] com tipo inválido (use {sorted(BLOCOS)})")
            continue
        if b["tipo"] in ("ul", "ol"):
            it = b.get("itens")
            if not isinstance(it, list) or not it or any(not isinstance(x, str) or not x.strip() for x in it):
                erros.append(f"{r}: corpo[{j}] precisa de 'itens' (lista de textos)")
        elif not isinstance(b.get("texto"), str) or not b["texto"].strip():
            erros.append(f"{r}: corpo[{j}] precisa de 'texto'")
        for campo in ("texto", "titulo"):
            v = b.get(campo, "")
            if isinstance(v, str) and re.search(r"<\s*/?\s*[a-zA-Z]+[^>]*>", v):
                erros.append(f"{r}: corpo[{j}].{campo} contém HTML; use texto puro")
    fontes = p.get("fontes")
    if not isinstance(fontes, list) or not (1 <= len(fontes) <= 12):
        erros.append(f"{r}: 'fontes' deve ter de 1 a 12 itens")
    else:
        for j, f in enumerate(fontes):
            if not isinstance(f, dict) or not isinstance(f.get("titulo"), str) or not f["titulo"].strip() or not url_ok(f.get("url")):
                erros.append(f"{r}: fontes[{j}] precisa de 'titulo' e 'url' http(s)")
    tags = p.get("tags", [])
    if not isinstance(tags, list) or any(not isinstance(t, str) for t in tags):
        erros.append(f"{r}: 'tags' deve ser lista de textos")
        tags = []

    # Regras de conteúdo que dá para checar por máquina.
    for txt in textos_do_post(p, corpo):
        if "![" in txt:
            erros.append(f"{r}: imagens não são permitidas (nada de capas copiadas)")
            break
    for txt in textos_do_post(p, corpo):
        for citacao in RE_CITACAO.findall(txt):
            if len(re.findall(r"\w+", citacao)) > LIMITE_CITACAO:
                erros.append(f"{r}: citação entre aspas com mais de {LIMITE_CITACAO} palavras ('{citacao[:40]}…'); reescreva com palavras próprias")

    livro = validar_livro(p, r, formato, lidos, erros)
    if dd is None or not isinstance(titulo, str) or not isinstance(resumo, str):
        return None
    palavras = len(re.findall(r"\w+", " ".join(texto_do_bloco(b) for b in corpo if isinstance(b, dict))))
    item = {
        "id": caminho.stem,
        "tema": tema["slug"],
        "titulo": titulo.strip(),
        "resumo": resumo.strip(),
        "formato": formato,
        "data": d,
        "tempo_leitura_min": max(1, round(palavras / 200)),
        "destaque": bool(p.get("destaque", False)),
        "exemplo": bool(p.get("exemplo", False)),
        "tags": tags[:8],
    }
    if livro:
        item["livro"] = livro
    if formato == "em-1-minuto":
        item["pontos"] = pontos_do_post(corpo)
    return item


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--remover-exemplos", action="store_true")
    ap.add_argument("--remover-mais-antigos-que", type=int, metavar="DIAS")
    args = ap.parse_args()

    hoje = datetime.now(FUSO).date()
    erros = []
    try:
        temas = ler_json(DADOS / "temas.json")
        site = ler_json(DADOS / "site.json")
        estante = ler_json(DADOS / "estante.json")
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERRO ao ler dados base: {e}")
        return 1
    for campo in ("titulo", "subtitulo"):
        if not isinstance(site.get(campo), str) or not site[campo].strip():
            erros.append(f"data/site.json: '{campo}' obrigatório")
    slugs = validar_temas(temas, erros)
    lidos = validar_estante(estante, erros)
    por_slug = {t["slug"]: t for t in temas if isinstance(t, dict) and t.get("slug") in slugs}

    removidos = []
    itens = []
    pasta_posts = DADOS / "posts"
    for pasta in sorted(p for p in pasta_posts.iterdir() if p.is_dir()) if pasta_posts.exists() else []:
        if pasta.name not in por_slug:
            erros.append(f"data/posts/{pasta.name}: pasta sem tema correspondente em temas.json")
            continue
        for arq in sorted(pasta.glob("*.json")):
            try:
                bruto = ler_json(arq)
            except json.JSONDecodeError as e:
                erros.append(f"{arq.relative_to(RAIZ)}: JSON inválido ({e})")
                continue
            m = RE_ARQUIVO.match(arq.name)
            apagar = False
            if args.remover_exemplos and isinstance(bruto, dict) and bruto.get("exemplo"):
                apagar = True
            if args.remover_mais_antigos_que and m:
                if (hoje - date.fromisoformat(m.group(1))).days > args.remover_mais_antigos_que:
                    apagar = True
            if apagar:
                arq.unlink()
                removidos.append(str(arq.relative_to(RAIZ)))
                continue
            item = validar_post(bruto, arq, por_slug[pasta.name], hoje, lidos, erros)
            if item:
                itens.append(item)

    if erros:
        print(f"{len(erros)} erro(s) de validação. O índice NÃO foi atualizado:")
        for e in erros:
            print(f"  - {e}")
        return 1

    itens.sort(key=lambda x: (x["data"], x["id"]), reverse=True)
    with open(DADOS / "index.json", "w", encoding="utf-8") as f:
        json.dump(itens, f, ensure_ascii=False, indent=2)
        f.write("\n")
    site["atualizado_em"] = datetime.now(FUSO).isoformat(timespec="minutes")
    with open(DADOS / "site.json", "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2)
        f.write("\n")

    for r in removidos:
        print(f"removido: {r}")
    print(f"OK: {len(itens)} post(s) indexado(s) em {len(por_slug)} tema(s); {len(lidos)} livro(s) na Estante.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
