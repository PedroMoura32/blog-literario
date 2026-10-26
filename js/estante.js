(async () => {
  const app = document.getElementById("app");
  try {
    const [{ site, temas }, estante] = await Promise.all([carregar(), getJSON("data/estante.json")]);
    document.title = `${estante.titulo}: ${site.titulo}`;
    montarTopo(site, temas, "estante");
    montarRodape(site);

    const original = Array.isArray(estante.livros) ? estante.livros : [];
    // Da maior para a menor nota; sem nota vai para o fim. A ordenação é estável, então empates seguem a ordem do arquivo.
    const livros = [...original].sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
    const comNotas = livros.some((lv) => Number.isInteger(lv.nota));
    const paleta = [...temas.filter((t) => t.ativo).map((t) => t.cor), COR_ESTANTE];

    const capa = h("header", { class: "tema-capa", style: estiloTema({ cor: COR_ESTANTE }) },
      arte("tema-estante"),
      h("p", { class: "tema-estilo" }, "Livros lidos"),
      h("h1", {}, estante.titulo),
      h("p", { class: "tema-desc" }, estante.descricao),
      h("p", { class: "tema-fatos" },
        `${livros.length} ${livros.length === 1 ? "livro" : "livros"} na estante${comNotas ? ", do mais bem avaliado para o menos" : ""}. As indicações do blog partem desta lista e nunca repetem um livro que já está aqui.`));

    const cartao = (lv) => {
      const cor = paleta[(aleatorioIndice(lv.id) + original.indexOf(lv)) % paleta.length];
      return h("li", { class: "livro", style: estiloTema({ cor }) },
        h("div", { class: "livro-capa" },
          arte(lv.id),
          h("strong", { class: "livro-titulo" }, lv.titulo),
          h("span", { class: "livro-autor" }, lv.autor)),
        Number.isInteger(lv.nota)
          ? h("p", { class: "livro-nota", "aria-label": `Nota ${lv.nota} de 10` }, h("span", { "aria-hidden": "true" }, `★ ${lv.nota}/10`))
          : null,
        lv.comentario ? h("p", { class: "livro-comentario" }, lv.comentario) : null);
    };

    app.replaceChildren(
      capa,
      livros.length
        ? h("ul", { class: "estante-grade", "aria-label": "Livros lidos" }, livros.map(cartao))
        : mensagem("A estante está vazia", "Os livros lidos aparecem aqui."));
  } catch (e) {
    falha(app, e);
  }

  /* Número estável a partir do id, para dar a cada livro sempre a mesma cor. */
  function aleatorioIndice(id) {
    let n = 0;
    for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
    return n % 97;
  }
})();
