async function cacheImport(name, url) {
  if (!(name in window)) {
    const module = (await import(url)).default;
    window[name] = module;
  }

  return window[name];
}

module.exports = async ({ app, quickAddApi, obsidian: { MarkdownView } }) => {
  const view = app.workspace.getActiveLeafOfViewType(MarkdownView);
  const editor = view?.editor;
  if (editor === undefined) {
    new Notice("🔴error: no active editor");
    return;
  }

  const Turndown = await cacheImport(
    "Turndown",
    "https://unpkg.com/turndown@6.0.0?module"
  );

  const defaultInput = view.file.basename;
  const userSelection = editor.getSelection().trim();
  let userInput = userSelection;
  if (userInput === "") {
    userInput = (await quickAddApi.inputPrompt("Keyword", defaultInput)).trim();
  }
  if (userInput === "") {
    userInput = defaultInput;
  }

  const requestParams = new URLSearchParams({
    format: "json",
    action: "query",
    prop: "extracts",
    redirects: "",
    origin: "*",
    titles: userInput,
  });
  const url = `https://en.wikipedia.org/w/api.php?${requestParams}`;
  const resp = await requestUrl(url);

  console.log(url);
  console.log(resp.json);

  const page = Object.values(resp.json.query?.pages ?? {})[0];
  if (page === undefined) {
    new Notice(`🔴error: no pages found for ${userInput}`);
    return;
  }

  const markdownBody = new Turndown({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  }).turndown(page.extract);

  const now = moment();
  const title = `Wikipedia Authors - ${page.title}`;
  const lines = [
    `# ${title}\n`,
    "# Metadata\n",
    "**Source**:: #from/clipper",
    "**Zettel**:: #zettel/fleeting",
    "**Status**:: #x",
    "**Host**:: [[en.wikipedia.org]]",
    `**URL**:: [en.wikipedia.org](https://en.wikipedia.org/wiki/${page.title.replaceAll(
      " ",
      "_"
    )})`,
    `**Created**:: [[${now.format("YYYY-MM-DD")}]]`,
    "",
    "# Content\n",
    markdownBody,
  ];

  editor.replaceSelection(
    userSelection === ""
      ? `[[${title}]]`
      : `[[${title}|${userSelection}]]`,
    editor.getCursor()
  );

  // create the new file
  const filePath = `robot/Wikipedia Library/${title}.md`;
  if (await app.vault.adapter.exists(filePath)) {
    new Notice(`🔴error: file already exists in ${filePath}`);
  } else {
    await app.vault.create(filePath, lines.join("\n"));
    new Notice(`🔵info: file created in ${filePath}`);
  }
};
