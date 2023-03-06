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
  const url = (await quickAddApi.inputPrompt("URL", "%.html")).trim();

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

  const document =
    url === "" ? await getVaultDocument(app) : await fetchDocument(url);
  const { title, byline, content } = new Readability(document).parse() || {
    title: document.title,
    byline: null,
    content: document.body,
  };

  const turndownService = new Turndown({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndownService.use(TurndownPluginGfm.gfm);

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
  if (url !== "") {
    const host = url.split("://", 2)[1].split("/", 1)[0];
    metadata["URL"] = `[${host}](${url})`;
    metadata["Host"] = `[[${host}]]`;
  }
  if (byline !== null && byline !== undefined) {
    metadata["Author"] = `[[${byline}]]`;
  }

  const fileContent = [
    "## Metadata\n",
    formatMetadata(metadata),
    "\n## Synopsis\n",
    markdownBody,
  ].join("\n");

  if (url === "") {
    await app.vault.append(app.workspace.getActiveFile(), fileContent);
  } else {
    const fileName = getFileName(
      byline !== null && byline !== undefined ? `${byline} - ${title}` : title
    );
    const filePath = `dock/${fileName}.md`;
    const newFile = await app.vault.create(
      filePath,
      `# ${fileName}\n\n${fileContent}`
    );
    await app.workspace.getLeaf().openFile(newFile);
  }
}

async function getVaultDocument(app) {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  app.vault.append(currentFile, fileContent);

  const htmlFilePath = currentFile.path.replace(/\.md$/, ".html");
  if (!(await app.vault.adapter.exists(htmlFilePath))) {
    new Notice(`🔴error: file ${htmlFilePath} not found`);
    return;
  }

  const htmlFile = app.vault.getAbstractFileByPath(htmlFilePath);
  const html = await app.vault.read(htmlFile);
  return new DOMParser().parseFromString(html, "text/html");
}

async function fetchDocument(url) {
  const html = await request(url);
  return new DOMParser().parseFromString(html, "text/html");
}
