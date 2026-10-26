(async () => {
  const app = document.getElementById("app");
  try {
    const { site, temas, posts } = await carregar();
    document.title = `${site.titulo}: ${site.subtitulo}`;
    montarTopo(site, temas, "capa");
    montarRodape(site);

    const ativos = temas.filter((t) => t.ativo);
    const porSlug = new Map(ativos.map((t) => [t.slug, t]));
    const vivos = posts.filter((p) => porSlug.has(p.tema) && !expirado(p, porSlug.get(p.tema)));

    app.replaceChildren();
    if (!vivos.length) {
      app.append(mensagem(
        "A primeira edição está a caminho",
        "As matérias aparecem aqui depois da próxima rodada da automação, de manhã cedo.",
        h("p", {}, "Enquanto isso, a ", h("a", { href: "estante.html" }, "Estante"), " já está aberta.")));
      return;
    }

    const busca = h("input", {
      type: "search", class: "busca", autocomplete: "off",
      placeholder: "Buscar por livro, autor ou assunto", "aria-label": "Buscar por livro, autor ou assunto",
    });
    const palco = h("div", { id: "palco" });
    app.append(h("div", { class: "busca-wrap" }, busca), palco);

    const diaTopo = vivos[0].data;
    const doDia = vivos.filter((p) => p.data === diaTopo);
    const manchete = doDia.find((p) => p.destaque) || doDia[0];

    // Carrossel "Em 1 minuto"; sem matérias nesse formato, mostra as mais recentes.
    let historiasItens = vivos.filter((p) => p.formato === "em-1-minuto" && p !== manchete).slice(0, 6);
    let historiasTitulo = "Em 1 minuto";
    if (!historiasItens.length) {
      historiasItens = vivos.filter((p) => p !== manchete).slice(0, 4);
      historiasTitulo = "Mais recentes";
    }
    const jaNaCapa = new Set([manchete, ...historiasItens]);

    const normalizar = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const casa = (p, q) => normalizar([p.titulo, p.resumo, ...(p.tags || []), p.livro ? `${p.livro.titulo} ${p.livro.autor}` : ""].join(" ")).includes(normalizar(q));

    const chevron = (direcao) => s("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" },
      s("path", { d: direcao < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7" }));

    function blocoManchete() {
      const t = porSlug.get(manchete.tema);
      return h("a", { class: "manchete", href: linkPost(manchete), style: estiloTema(t) },
        arte(manchete.id),
        h("div", { class: "manchete-topo" },
          h("span", {}, t.nome),
          h("span", { class: "selo" }, FORMATOS[manchete.formato]),
          manchete.exemplo ? h("span", { class: "selo" }, "Exemplo") : null),
        h("div", {},
          h("h2", { class: "manchete-titulo" }, manchete.titulo),
          h("p", { class: "manchete-resumo" }, manchete.resumo),
          livroDe(manchete),
          h("span", { class: "meta" },
            h("span", {}, dataRelativa(manchete.data)),
            h("span", {}, `${manchete.tempo_leitura_min} min de leitura`))));
    }

    function blocoHistorias() {
      const itens = historiasItens;
      if (!itens.length) return null;

      const cartoes = itens.map((p) => {
        const t = porSlug.get(p.tema);
        return h("a", { class: "historia", href: linkPost(p), style: estiloTema(t) },
          arte(p.id),
          h("div", { class: "historia-topo" }, h("span", {}, t.nome), p.exemplo ? h("span", { class: "selo" }, "Exemplo") : null),
          h("div", {},
            h("h3", {}, p.titulo),
            p.pontos && p.pontos.length
              ? h("ul", {}, p.pontos.map((x) => h("li", {}, x)))
              : h("p", { class: "historia-resumo" }, p.resumo),
            meta(p)));
      });

      const trilho = h("div", { class: "trilho", tabindex: "0", role: "region", "aria-label": historiasTitulo }, cartoes);
      const barras = itens.map(() => h("i", {}));
      const passo = () => (cartoes[0] ? cartoes[0].getBoundingClientRect().width + 12 : 1);
      const atualizar = () => {
        const atual = Math.min(itens.length - 1, Math.max(0, Math.round(trilho.scrollLeft / passo())));
        barras.forEach((b, k) => b.classList.toggle("on", k <= atual));
      };
      trilho.addEventListener("scroll", atualizar, { passive: true });

      const mover = (d) => trilho.scrollBy({ left: d * passo(), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      const anterior = h("button", { type: "button", class: "seta", "aria-label": "Anterior" }, chevron(-1));
      const proxima = h("button", { type: "button", class: "seta", "aria-label": "Próxima" }, chevron(1));
      anterior.addEventListener("click", () => mover(-1));
      proxima.addEventListener("click", () => mover(1));
      atualizar();

      return h("section", { class: "historias", "aria-labelledby": "titulo-historias" },
        h("div", { class: "historias-topo" },
          h("h2", { class: "rotulo", id: "titulo-historias" }, historiasTitulo),
          itens.length > 1 ? h("div", { class: "progresso", "aria-hidden": "true" }, barras) : null,
          itens.length > 1 ? h("div", { class: "setas" }, anterior, proxima) : null),
        trilho);
    }

    function blocoDestaque(p, t) {
      return h("a", { class: "bloco", href: linkPost(p), style: estiloTema(t) },
        arte(p.id),
        h("h3", {}, p.titulo),
        h("p", {}, p.resumo),
        livroDe(p),
        meta(p));
    }

    function item(p, t) {
      return h("a", { class: "item", href: linkPost(p), style: estiloTema(t) },
        miniatura(p),
        h("span", { class: "item-corpo" }, h("strong", { class: "item-titulo" }, p.titulo), livroDe(p), meta(p)));
    }

    function secao(t) {
      const todos = vivos.filter((p) => p.tema === t.slug);
      const lista = todos.filter((p) => !jaNaCapa.has(p)).slice(0, 3);
      if (!lista.length) return null;
      const [lider, ...resto] = lista;
      return h("section", { class: "secao", style: estiloTema(t) },
        h("div", { class: "secao-topo" },
          h("h2", { class: "etiqueta" }, t.nome),
          h("a", { class: "ver-tudo", href: `tema.html?t=${t.slug}` }, `Ver tudo (${todos.length})`)),
        h("div", { class: "secao-corpo" },
          blocoDestaque(lider, t),
          resto.length ? h("div", { class: "lista-lateral" }, resto.map((p) => item(p, t))) : null));
    }

    function desenharCapa() {
      palco.replaceChildren(
        h("div", { class: "bento" }, blocoManchete(), blocoHistorias()),
        ...ativos.map(secao).filter(Boolean));
    }

    function desenharBusca(q) {
      const achados = vivos.filter((p) => casa(p, q));
      palco.replaceChildren(...[
        h("p", { class: "contagem", role: "status" },
          achados.length ? `${achados.length} ${achados.length === 1 ? "matéria" : "matérias"} para “${q}”` : `Nada encontrado para “${q}”. Tente outra palavra.`),
        achados.length ? h("div", { class: "lista" }, achados.map((p) => linha(p, porSlug.get(p.tema)))) : null,
      ].filter(Boolean));
    }

    busca.addEventListener("input", () => {
      const q = busca.value.trim();
      if (q) desenharBusca(q); else desenharCapa();
    });
    desenharCapa();
  } catch (e) {
    falha(app, e);
  }
})();
