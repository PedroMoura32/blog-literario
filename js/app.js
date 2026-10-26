/* Utilidades compartilhadas. Sem build, sem dependências.
   Todo conteúdo vindo dos JSON é inserido como texto (nunca innerHTML). */

const TZ = "America/Sao_Paulo";
const FORMATOS = {
  "reportagem": "Reportagem",
  "em-1-minuto": "Em 1 minuto",
  "indicacao": "Indicação",
  "comentarios": "O que dizem",
  "leituras": "Leituras",
};
const ESTILOS = { "noticia": "Notícias", "indicacao": "Indicações", "comentarios": "O que dizem" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const RE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const RE_COR = /^#[0-9a-fA-F]{6}$/;
const NS_SVG = "http://www.w3.org/2000/svg";
const COR_ESTANTE = "#5A1830";

function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  return el;
}

function s(tag, attrs, ...filhos) {
  const el = document.createElementNS(NS_SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  el.append(...filhos.flat().filter(Boolean));
  return el;
}

async function getJSON(caminho) {
  const r = await fetch(caminho, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${caminho} respondeu ${r.status}`);
  return r.json();
}

async function carregar() {
  const [site, temas, posts] = await Promise.all([
    getJSON("data/site.json"), getJSON("data/temas.json"), getJSON("data/index.json"),
  ]);
  posts.sort((a, b) => (a.data === b.data ? b.id.localeCompare(a.id) : b.data.localeCompare(a.data)));
  return { site, temas, posts };
}

function params() { return Object.fromEntries(new URLSearchParams(location.search)); }

/* ---------- datas (sempre no fuso de Brasília) ---------- */

function hojeISO() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }

function diasEntre(a, b) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 864e5);
}

function dataLonga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("pt-BR", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function dataCurta(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

function dataRelativa(iso) {
  const n = diasEntre(iso, hojeISO());
  if (n <= 0) return "hoje";
  if (n === 1) return "ontem";
  if (n < 7) return `há ${n} dias`;
  return dataCurta(iso);
}

function expirado(post, tema) { return diasEntre(post.data, hojeISO()) > tema.validade_dias; }

/* ---------- cor do tema ---------- */

/* Escolhe tinta escura ou branca conforme o contraste: o ponto de virada fica perto de 0,22 de luminância. */
function corTexto(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.22 ? "#2b1118" : "#ffffff";
}

function estiloTema(tema) {
  const cor = RE_COR.test(tema.cor || "") ? tema.cor : "#7b1e3a";
  return `--tema:${cor};--tema-ink:${corTexto(cor)}`;
}

/* ---------- capas geradas: SVG determinístico a partir do id ----------
   O mesmo id sempre gera o mesmo desenho. As cores vêm do tema (variáveis CSS),
   então a arte acompanha o bloco onde estiver. Nenhuma imagem de terceiros. */

function aleatorio(texto) {
  let a1 = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    a1 = Math.imul(a1 ^ texto.charCodeAt(i), 3432918353);
    a1 = (a1 << 13) | (a1 >>> 19);
  }
  let a = (Math.imul(a1 ^ (a1 >>> 16), 2246822507) ^ Math.imul(a1 ^ (a1 >>> 13), 3266489909)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TINTA = "var(--tema-ink)";
const MEIO = "color-mix(in srgb, var(--tema-ink) 38%, var(--tema))";
const SUAVE = "color-mix(in srgb, var(--tema-ink) 16%, var(--tema))";
const CLARO = "color-mix(in srgb, #ffffff 60%, var(--tema))";
const preenche = (cor) => `fill:${cor}`;
const traco = (cor, w) => `fill:none;stroke:${cor};stroke-width:${w}`;
const CORES = [TINTA, MEIO, SUAVE, CLARO];

/* Sorteia uma cor diferente da anterior, para que dois vizinhos nunca se confundam. */
function outraCor(r, anterior) {
  let k = Math.floor(r() * 4);
  if (k === anterior) k = (k + 1 + Math.floor(r() * 3)) % 4;
  return k;
}

const MOTIVOS = [
  /* Lombadas de livros numa prateleira, uma ou outra inclinada. */
  function lombadas(r) {
    const els = [], base = 200;
    let x = -8 + r() * 14, ult = -1;
    while (x < 410) {
      const w = 24 + Math.floor(r() * 30), alt = 80 + Math.floor(r() * 100);
      ult = outraCor(r, ult);
      const faixa = (ult + 2) % 4;
      const inclina = r() < 0.14;
      const partes = [
        s("rect", { x, y: base - alt, width: w, height: alt, rx: 3, style: preenche(CORES[ult]) }),
        s("rect", { x, y: base - alt + 14, width: w, height: 6, style: preenche(CORES[faixa]) }),
        s("rect", { x, y: base - alt + 26, width: w, height: 3, style: preenche(CORES[faixa]) }),
        s("rect", { x: x + w * 0.22, y: base - alt * 0.58, width: w * 0.56, height: 22, rx: 2, style: preenche(CORES[faixa]) }),
      ];
      els.push(inclina
        ? s("g", { transform: `rotate(${(r() < 0.5 ? -1 : 1) * (7 + Math.floor(r() * 7))} ${x + w} ${base})` }, ...partes)
        : s("g", {}, ...partes));
      x += w + 3;
    }
    els.push(s("rect", { x: 0, y: base, width: 400, height: 10, style: preenche(TINTA) }));
    return els;
  },
  /* Marcadores de página pendurados no alto, com a ponta em V. */
  function marcadores(r) {
    const els = [];
    let x = 14 + r() * 24, ult = -1;
    while (x < 390) {
      const w = 22 + Math.floor(r() * 18), comp = 120 + Math.floor(r() * 150), v = 14 + Math.floor(r() * 10);
      ult = outraCor(r, ult);
      els.push(s("path", {
        d: `M${x} 0H${x + w}V${comp}L${x + w / 2} ${comp - v}L${x} ${comp}Z`,
        style: preenche(CORES[ult]),
      }));
      if (r() < 0.6) els.push(s("rect", { x: x + w * 0.42, y: 0, width: w * 0.16, height: comp - v - 8, style: preenche(CORES[(ult + 2) % 4]) }));
      x += w + 10 + Math.floor(r() * 26);
    }
    els.push(s("circle", { cx: 40 + r() * 320, cy: 210 + r() * 50, r: 22 + r() * 26, style: preenche(CLARO) }));
    return els;
  },
  /* Pilha de folhas, cada uma girada um pouco, com linhas de texto na de cima. */
  function folhas(r) {
    const els = [], cx = 170 + r() * 90, cy = 120 + r() * 50, n = 5;
    for (let i = 0; i < n; i++) {
      const ang = (r() - 0.5) * 34, w = 210 + r() * 40, alt = 150 + r() * 30;
      els.push(s("rect", {
        x: cx - w / 2, y: cy - alt / 2, width: w, height: alt, rx: 6,
        transform: `rotate(${ang.toFixed(1)} ${cx} ${cy})`,
        style: `fill:${i === n - 1 ? CLARO : CORES[i % 3 + 1]};stroke:${TINTA};stroke-width:2.5`,
      }));
    }
    for (let i = 0; i < 5; i++) {
      const y = cy - 46 + i * 24, comp = 70 + r() * 90;
      els.push(s("line", { x1: cx - 90, y1: y, x2: cx - 90 + comp, y2: y, style: `stroke:${TINTA};stroke-width:5;stroke-linecap:round` }));
    }
    return els;
  },
  /* Linhas de texto, algumas grifadas: as entrelinhas. */
  function entrelinhas(r) {
    const els = [];
    const x0 = 24 + r() * 40;
    for (let i = 0; i < 9; i++) {
      const y = 26 + i * 30, comp = 130 + r() * 190, grifa = r() < 0.3;
      if (grifa) els.push(s("rect", { x: x0 - 6, y: y - 13, width: comp + 12, height: 26, rx: 4, style: preenche(CLARO) }));
      els.push(s("line", { x1: x0, y1: y, x2: x0 + comp, y2: y, style: `stroke:${grifa ? TINTA : MEIO};stroke-width:${grifa ? 7 : 5};stroke-linecap:round` }));
    }
    els.push(s("circle", { cx: 300 + r() * 80, cy: 40 + r() * 120, r: 36 + r() * 30, style: traco(TINTA, 3) }));
    return els;
  },
  /* Fases da lua: leitura de noite. */
  function luas(r) {
    const els = [], fase = Math.floor(r() * 8);
    for (let i = 0; i < 5; i++) {
      const cx = 44 + i * 78 + (r() - 0.5) * 10, cy = 60 + (i % 2) * 64 + r() * 20, raio = 26 + r() * 10;
      const f = (fase + i * 2) % 8;
      els.push(s("circle", { cx, cy, r: raio, style: preenche(CLARO) }));
      if (f % 8 !== 4) {
        const deslocamento = ((f % 4) + 1) * raio * 0.45 * (f < 4 ? 1 : -1);
        els.push(s("circle", { cx: cx + deslocamento, cy, r: raio * 1.02, style: "fill:var(--tema)" }));
      }
      els.push(s("circle", { cx, cy, r: raio, style: traco(TINTA, 2.5) }));
    }
    els.push(s("circle", { cx: 80 + r() * 240, cy: 232, r: 90 + r() * 40, style: preenche(SUAVE) }));
    return els;
  },
];

function arte(id) {
  const r = aleatorio(id);
  const motivo = MOTIVOS[Math.floor(r() * MOTIVOS.length)];
  return s("svg", { class: "arte", viewBox: "0 0 400 300", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true", focusable: "false" }, ...motivo(r));
}

/* ---------- texto seguro ---------- */

function urlSegura(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : null;
  } catch { return null; }
}

function inline(txt) {
  const saida = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let i = 0, m;
  while ((m = re.exec(txt))) {
    if (m.index > i) saida.push(txt.slice(i, m.index));
    const t = m[0];
    if (t.startsWith("**")) saida.push(h("strong", {}, t.slice(2, -2)));
    else if (t.startsWith("*")) saida.push(h("em", {}, t.slice(1, -1)));
    else if (t.startsWith("`")) saida.push(h("code", {}, t.slice(1, -1)));
    else {
      const [, rotulo, url] = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const seguro = urlSegura(url);
      saida.push(seguro ? h("a", { href: seguro, target: "_blank", rel: "noopener noreferrer" }, rotulo) : rotulo);
    }
    i = m.index + t.length;
  }
  if (i < txt.length) saida.push(txt.slice(i));
  return saida;
}

function renderBlocos(corpo) {
  return corpo.map((b) => {
    switch (b.tipo) {
      case "p": return h("p", {}, inline(b.texto));
      case "h2": return h("h2", {}, b.texto);
      case "h3": return h("h3", {}, b.texto);
      case "ul": return h("ul", {}, b.itens.map((t) => h("li", {}, inline(t))));
      case "ol": return h("ol", {}, b.itens.map((t) => h("li", {}, inline(t))));
      case "callout":
        return h("aside", { class: "callout" },
          b.titulo ? h("strong", { class: "callout-titulo" }, b.titulo) : null,
          h("p", {}, inline(b.texto)));
      default: return null;
    }
  });
}

/* ---------- peças de interface ---------- */

function linkPost(p) { return `post.html?t=${p.tema}&id=${p.id}`; }

function meta(p) {
  return h("span", { class: "meta" },
    h("span", { class: "selo" }, FORMATOS[p.formato] || p.formato),
    p.exemplo ? h("span", { class: "selo" }, "Exemplo") : null,
    h("span", {}, dataRelativa(p.data)),
    h("span", {}, `${p.tempo_leitura_min} min de leitura`));
}

/* "Sobre Título, de Autor", quando a matéria é sobre um livro. */
function livroDe(p) {
  if (!p.livro) return null;
  return h("span", { class: "livro-linha" }, "Sobre ", h("em", {}, p.livro.titulo), `, de ${p.livro.autor}`);
}

function etiquetaTema(tema) {
  return h("span", { class: "tema-tag" }, h("i", { class: "quadrado" }), tema.nome);
}

function miniatura(p) { return h("span", { class: "miniatura" }, arte(p.id)); }

function linha(p, tema, arquivada) {
  return h("a", { class: "linha" + (arquivada ? " arquivada" : ""), href: linkPost(p), style: estiloTema(tema) },
    miniatura(p),
    h("span", { class: "linha-corpo" },
      etiquetaTema(tema),
      h("strong", { class: "linha-titulo" }, p.titulo),
      livroDe(p),
      h("span", { class: "linha-resumo" }, p.resumo),
      meta(p)));
}

function montarTopo(site, temas, ativo) {
  const destino = document.querySelector("#topo .wrap");
  const hoje = hojeISO();
  let atualizado = "";
  if (site.atualizado_em) {
    atualizado = `Atualizado em ${dataCurta(site.atualizado_em.slice(0, 10))} às ${site.atualizado_em.slice(11, 16)}`;
  }
  destino.replaceChildren(
    h("div", { class: "topo-linha" }, h("span", {}, dataLonga(hoje)), h("span", {}, atualizado)),
    h("div", { class: "marca-linha" },
      h("a", { class: "marca", href: "index.html", "aria-label": `${site.titulo}, página inicial` }, site.titulo),
      h("p", { class: "marca-sub" }, site.subtitulo)),
    h("nav", { class: "nav", "aria-label": "Seções" },
      h("a", { href: "index.html", "aria-current": ativo === "capa" ? "page" : null }, h("i", { class: "quadrado capa-quadrado" }), "Capa"),
      h("a", { href: "estante.html", style: estiloTema({ cor: COR_ESTANTE }), "aria-current": ativo === "estante" ? "page" : null },
        h("i", { class: "quadrado" }), "Estante"),
      temas.filter((t) => t.ativo).map((t) =>
        h("a", { href: `tema.html?t=${t.slug}`, style: estiloTema(t), "aria-current": ativo === t.slug ? "page" : null },
          h("i", { class: "quadrado" }), t.nome))));
}

function montarRodape(site) {
  document.querySelector("#rodape .wrap").replaceChildren(
    h("p", {}, "Textos preparados por IA a partir de fontes públicas e reescritos com palavras próprias. Cada matéria lista as fontes. As capas são desenhadas pelo próprio site, sem usar imagens de terceiros."),
    h("p", {}, site.dedicatoria ? `${site.titulo}, um caderno de leituras. ${site.dedicatoria}` : `${site.titulo}, um caderno de leituras.`));
}

function mensagem(titulo, ...texto) {
  return h("div", { class: "mensagem" }, h("h1", {}, titulo), texto.map((t) => (typeof t === "string" ? h("p", {}, t) : t)));
}

function falha(app, erro) {
  app.replaceChildren(mensagem(
    "Não consegui abrir esta edição",
    erro.message,
    location.protocol === "file:"
      ? h("p", {}, "Você abriu o arquivo direto do computador. O navegador bloqueia a leitura dos dados nesse modo. Na pasta do projeto, rode ", h("code", {}, "python3 -m http.server 8000"), " e abra http://localhost:8000.")
      : "Atualize a página. Se continuar, confira se data/index.json existe no repositório."));
}
