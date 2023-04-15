module.exports = start;

function formatMetadata(metadata) {
  return Object.entries(metadata)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      return `**${key}**:: ${value}`;
    })
    .join("\n");
}

function getFileName(fileName) {
  if (fileName === "") {
    return "Untitled";
  }

  return fileName
    .replaceAll(":", "")
    .replace(/[/\\?%*|"<>]/g, "-")
    .replace(/[- .]+$/, "");
}

async function cacheImport(name, url, importDefault = true) {
  if (!(name in window)) {
    const module = await import(url);
    window[name] = importDefault ? module.default : module;
  }

  return window[name];
}

async function start({ app, quickAddApi }) {
  const urlInput = await quickAddApi.inputPrompt("URL", "%.html");
  if (urlInput === undefined) {
    // canceled
    return;
  }

  const readVault = urlInput.startsWith(" ");
  const url = urlInput.trim();

  const Turndown = await cacheImport(
    "Turndown",
    "https://unpkg.com/turndown@6.0.0?module"
  );
  const TurndownPluginGfm = await cacheImport(
    "TurndownPluginGfm",
    "https://unpkg.com/turndown-plugin-gfm@1.0.2?module",
    false
  );
  const Readability = await cacheImport(
    "Readability",
    "https://unpkg.com/@tehshrike/readability@0.2.0"
  );

  const turndownService = new Turndown({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndownService.use(TurndownPluginGfm.gfm);
  const services = { turndownService, Readability };

  if (url === ".") {
    await downloadAllLinksInActiveFile(app, services);
    return;
  }

  const document = readVault
    ? await getVaultDocument(app, url)
    : await fetchDocument(url);
  const { title, byline, content } = markdownify(document, url, services);

  if (url === "") {
    await app.vault.append(app.workspace.getActiveFile(), content);
  } else {
    const newFile = await saveDocument("dock", { title, byline, content });
    await app.workspace.getLeaf().openFile(newFile);
  }
}

function markdownify(document, url, { turndownService, Readability }) {
  const { title, byline, content } = new Readability(document).parse() || {
    title: document.title,
    byline: null,
    content: document.body,
  };
  const markdownBody = turndownService.turndown(content);

  const metadata = {
    Created: `[[${new Date().toISOString().split("T")[0]}]]`,
    Status: "#i",
    Zettel: "#zettel/fleeting",
    Source: "#from/clipper",
  };
  if (title.trim() !== "") {
    metadata["Title"] = title.trim();
  }
  const host = url.split("://", 2)[1].split("/", 1)[0];
  metadata["URL"] = `[${host}](${url})`;
  metadata["Host"] = `[[${host}]]`;
  if (byline !== null && byline !== undefined) {
    metadata["Author"] = `[[${byline}]]`;
  }

  return {
    title,
    byline,
    content: [
      "## Metadata\n",
      formatMetadata(metadata),
      "\n## Synopsis\n",
      markdownBody,
    ].join("\n"),
  };
}

// https://stackoverflow.com/a/55606029/667158
function setBaseURI(dom, url) {
  if (dom.head.getElementsByTagName("base").length == 0) {
    let baseEl = dom.createElement("base");
    baseEl.setAttribute("href", url);
    dom.head.append(baseEl);
  }

  return dom;
}

async function getVaultDocument(app, url) {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  const htmlFilePath = currentFile.path.replace(/\.md$/, ".html");
  if (!(await app.vault.adapter.exists(htmlFilePath))) {
    new Notice(`🔴error: file ${htmlFilePath} not found`);
    return;
  }

  const htmlFile = app.vault.getAbstractFileByPath(htmlFilePath);
  const html = await app.vault.read(htmlFile);
  return setBaseURI(new DOMParser().parseFromString(html, "text/html"), url);
}

async function fetchDocument(url) {
  const html = await request(url);
  return setBaseURI(new DOMParser().parseFromString(html, "text/html"), url);
}

async function saveDocument(inFolder, { title, byline, content }) {
  const fileName = getFileName(
    byline !== null && byline !== undefined ? `${byline} - ${title}` : title
  );
  const filePath = `${inFolder}/${fileName}.md`;
  return await app.vault.create(filePath, `# ${fileName}\n\n${content}`);
}

async function downloadAllLinksInActiveFile(
  app,
  { turndownService, Readability }
) {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  const index = await app.vault.read(currentFile);
  const regex = /\[(.*?)\]\((.*?)\)/g;
  for (const match of index.matchAll(regex)) {
    console.log(match);
    const title = match[1];
    const url = match[2];
    const document = await fetchDocument(url);
    const { byline, content } = markdownify(document, url, {
      turndownService,
      Readability,
    });
    const newFile = await saveDocument(currentFile.parent.path, {
      title,
      byline,
      content,
    });

    new Notice(`🔵info: created ${newFile.path}`);
  }
}
