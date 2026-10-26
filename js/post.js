(async () => {
  const app = document.getElementById("app");
  try {
    const { t: slug, id } = params();
    const { site, temas, posts } = await carregar();
    const tema = RE_SLUG.test(slug || "") ? temas.find((x) => x.slug === slug) : null;
    const idValido = RE_SLUG.test(id || "");

    montarTopo(site, temas, tema ? tema.slug : null);
    montarRodape(site);

    const naoAchou = () => app.replaceChildren(
      mensagem("Matéria não encontrada", "Ela pode ter saído da capa ou o link está incompleto.",
        h("p", {}, h("a", { href: tema ? `tema.html?t=${tema.slug}` : "index.html" }, tema ? `Ver tudo em ${tema.nome}` : "Voltar para a capa"))));

    if (!tema || !idValido) return naoAchou();

    let post;
    try { post = await getJSON(`data/posts/${tema.slug}/${id}.json`); } catch { return naoAchou(); }

    document.title = `${post.titulo}: ${site.titulo}`;
    const indice = posts.find((p) => p.id === id && p.tema === tema.slug);
    const info = indice || { ...post, id, tema: tema.slug, tempo_leitura_min: 1 };
    const relacionados = posts.filter((p) => p.tema === tema.slug && p.id !== id).slice(0, 3);

    app.replaceChildren(h("div", { style: estiloTema(tema) },
      h("div", { class: "leitura", "aria-hidden": "true" }),
      h("nav", { class: "migalhas", "aria-label": "Você está em" },
        h("a", { href: "index.html" }, "Capa"), h("span", { "aria-hidden": "true" }, "/"),
        h("a", { href: `tema.html?t=${tema.slug}` }, tema.nome)),
      h("header", { class: "artigo-hero" },
        arte(id),
        meta(info),
        h("h1", { class: "artigo-titulo" }, post.titulo),
        livroDe(info)),
      h("article", { class: "artigo" },
        h("p", { class: "artigo-lead" }, post.resumo),
        h("div", { class: "corpo" }, renderBlocos(post.corpo)),
        h("section", { class: "fontes", "aria-labelledby": "titulo-fontes" },
          h("h2", { id: "titulo-fontes" }, "Fontes"),
          h("ol", {}, post.fontes.map((f) => {
            const url = urlSegura(f.url);
            return h("li", {},
              url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, f.titulo) : f.titulo,
              url ? h("span", { class: "host" }, new URL(url).hostname.replace(/^www\./, "")) : null);
          })),
          h("p", { class: "aviso" }, "Texto reescrito por IA a partir das fontes acima. Datas de lançamento e disponibilidade podem mudar: confira na página da fonte.")),
        relacionados.length
          ? h("section", { class: "relacionados", "aria-labelledby": "titulo-rel" },
              h("h2", { class: "rotulo", id: "titulo-rel" }, `Mais em ${tema.nome}`),
              h("div", { class: "lista" }, relacionados.map((p) => linha(p, tema, expirado(p, tema)))))
          : null)));
    window.scrollTo(0, 0);
  } catch (e) {
    falha(app, e);
  }
})();
