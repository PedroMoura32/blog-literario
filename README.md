# Entrelinhas

Caderno de livros, autores e boas leituras. Site estático (HTML, CSS e JS puros, sem build), alimentado por uma tarefa agendada que pesquisa os temas todo dia de manhã e grava as matérias como arquivos JSON. Feito a partir do projeto Radar, com outro nome, outro visual e uma página nova: a Estante.

## Estrutura

```
index.html        capa (manchete, cartões "Em 1 minuto" que deslizam, seções por tema, busca)
tema.html         página de uma seção (?t=slug), com filtro por formato e arquivadas
post.html         página de uma matéria (?t=slug&id=...)
estante.html      a Estante: os livros já lidos, com nota (de 1 a 10) e comentário quando houver
css/style.css     todo o visual (vinho e creme; modo escuro; celular com barra fixa embaixo)
js/               app.js (utilidades e capas geradas em SVG), capa.js, tema.js, post.js, estante.js
fonts/            Fraunces e Source Serif 4 (licença OFL)
data/
  site.json       título e subtítulo do blog
  temas.json      seções: cor, estilo, formatos, validade, consultas, fontes
  estante.json    livros lidos (quem edita é o Pedro, na conversa)
  index.json      índice gerado pelo script (não edite à mão)
  posts/<tema>/   uma matéria por arquivo AAAA-MM-DD-slug.json
scripts/rebuild_index.py   valida os posts e a Estante e gera o índice
CLAUDE.md         contrato do agente que roda todo dia
BACKLOG.md        ideias para depois
```

## Seções

| seção | o que traz |
|---|---|
| Mercado | notícias do mercado de livros e lançamentos |
| Autores | novidades dos autores que já estão na Estante |
| Indicações | uma sugestão de leitura por dia, a partir da Estante |
| O que comentam | o que leitores e críticos dizem de um livro, com links |

## Ver no computador

```
python3 -m http.server 8000
```

Abra http://localhost:8000. (Abrir o `index.html` direto não funciona: o navegador bloqueia a leitura dos JSON.)

## Publicar no GitHub Pages

1. No repositório, abra Settings, Pages.
2. Em "Build and deployment", escolha "Deploy from a branch", branch `main`, pasta `/ (root)`, e salve.
3. O endereço sai como `https://SEU-USUARIO.github.io/blog-literario/`.

O GitHub Pages grátis exige repositório público. As páginas têm `noindex` para não aparecerem em buscadores, mas qualquer pessoa com o link consegue abrir. Por isso nada de dados pessoais aqui: só títulos e autores dos livros.

## A Estante

Os livros ficam em `data/estante.json`. Cada livro tem `id`, `titulo`, `autor`, `nota` (1 a 10 ou `null`) e `comentario` (até 280 caracteres ou `null`). Para acrescentar um livro ou uma nota, é só pedir na conversa. O script `rebuild_index.py` confere o arquivo e **recusa publicar uma indicação de livro que já está na Estante**.

## Capas geradas

Cada matéria e cada livro da Estante ganha uma capa em SVG desenhada pelo navegador a partir do `id` e da cor da seção. O mesmo `id` sempre gera o mesmo desenho, e nenhuma imagem de terceiros é usada (nada de capas de livros copiadas).

## Trocar temas

Edite `data/temas.json`. Para uma seção nova, copie um bloco existente, mude `slug`, `nome`, `cor` e `consultas`, e crie a pasta `data/posts/<slug>/`. `"ativo": false` esconde a seção sem apagar o histórico.
