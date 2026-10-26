(async () => {
  const app = document.getElementById("app");
  try {
    const [{ site, temas }, estante] = await Promise.all([carregar(), getJSON("data/estante.json")]);
    document.title = `${estante.titulo}: ${site.titulo}`;
    montarTopo(site, temas, "estante");
    montarRodape(site);

    const livros = Array.isArray(estante.livros) ? estante.livros : [];
    const paleta = [...temas.filter((t) => t.ativo).map((t) => t.cor), COR_ESTANTE];
    const estrelas = (n) => "★".repeat(n) + "☆".repeat(5 - n);

    const capa = h("header", { class: "tema-capa", style: estiloTema({ cor: COR_ESTANTE }) },
      arte("tema-estante"),
      h("p", { class: "tema-estilo" }, "Livros lidos"),
      h("h1", {}, estante.titulo),
      h("p", { class: "tema-desc" }, estante.descricao),
      h("p", { class: "tema-fatos" },
        `${livros.length} ${livros.length === 1 ? "livro" : "livros"} na estante. As indicações do blog partem desta lista e nunca repetem um livro que já está aqui.`));

    const cartao = (lv, i) => {
      const cor = paleta[(aleatorioIndice(lv.id) + i) % paleta.length];
      return h("li", { class: "livro", style: estiloTema({ cor }) },
        h("div", { class: "livro-capa" },
          arte(lv.id),
          h("strong", { class: "livro-titulo" }, lv.titulo),
          h("span", { class: "livro-autor" }, lv.autor)),
        Number.isInteger(lv.nota)
          ? h("p", { class: "livro-nota", "aria-label": `Nota ${lv.nota} de 5` }, h("span", { "aria-hidden": "true" }, estrelas(lv.nota)))
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
