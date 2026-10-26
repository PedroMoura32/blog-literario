(async () => {
  const app = document.getElementById("app");
  try {
    const { t: slug } = params();
    const { site, temas, posts } = await carregar();
    const tema = RE_SLUG.test(slug || "") ? temas.find((x) => x.slug === slug && x.ativo) : null;

    if (!tema) {
      montarTopo(site, temas, null);
      montarRodape(site);
      app.replaceChildren(mensagem("Seção não encontrada", h("p", {}, h("a", { href: "index.html" }, "Voltar para a capa"))));
      return;
    }

    document.title = `${tema.nome}: ${site.titulo}`;
    montarTopo(site, temas, tema.slug);
    montarRodape(site);

    const todos = posts.filter((p) => p.tema === tema.slug);
    const vivos = todos.filter((p) => !expirado(p, tema));
    const arquivados = todos.length - vivos.length;
    const estado = { formato: "todos", arquivadas: false };

    const capa = h("header", { class: "tema-capa", style: estiloTema(tema) },
      arte(`tema-${tema.slug}`),
      h("p", { class: "tema-estilo" }, ESTILOS[tema.estilo] || ""),
      h("h1", {}, tema.nome),
      h("p", { class: "tema-desc" }, tema.descricao),
      h("p", { class: "tema-fatos" },
        `${vivos.length} ${vivos.length === 1 ? "matéria" : "matérias"} em destaque. Cada uma fica na capa por ${tema.validade_dias} dias.`));

    const lista = h("div", { class: "lista" });
    const filtros = h("div", { class: "filtros", role: "group", "aria-label": "Filtrar por formato" });

    const formatos = ["todos", ...tema.formatos.filter((f) => todos.some((p) => p.formato === f))];
    for (const f of formatos) {
      const botao = h("button", { type: "button", class: "chip", "aria-pressed": f === "todos" ? "true" : "false" },
        f === "todos" ? "Todos" : FORMATOS[f]);
      botao.addEventListener("click", () => {
        estado.formato = f;
        filtros.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", b === botao ? "true" : "false"));
        desenhar();
      });
      filtros.append(botao);
    }

    if (arquivados > 0) {
      const caixa = h("input", { type: "checkbox" });
      caixa.addEventListener("change", () => { estado.arquivadas = caixa.checked; desenhar(); });
      filtros.append(h("label", {}, caixa, `Incluir arquivadas (${arquivados})`));
    }

    function desenhar() {
      const itens = (estado.arquivadas ? todos : vivos).filter((p) => estado.formato === "todos" || p.formato === estado.formato);
      lista.replaceChildren(...(itens.length
        ? itens.map((p) => linha(p, tema, expirado(p, tema)))
        : [h("div", { class: "mensagem" }, h("p", {}, "Nenhuma matéria neste filtro por enquanto."))]));
    }

    app.replaceChildren(...[capa, todos.length ? filtros : null, lista].filter(Boolean));
    desenhar();
  } catch (e) {
    falha(app, e);
  }
})();
