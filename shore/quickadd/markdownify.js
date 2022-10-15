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

async function cacheImport(name, url) {
  if (!(name in window)) {
    window[name] = (await import(url)).default;
  }

  return window[name];
}

async function start({ app, quickAddApi }) {
  const url = (
    await quickAddApi.inputPrompt(
      "URL",
      "%.html",
      "https://thebitcoinmanual.com/articles/what-is-psbt/"
    )
  ).trim();

  const Turndown = await cacheImport(
    "Turndown",
    "https://unpkg.com/turndown@6.0.0?module"
  );
  const Readability = await cache(
    "Readability",
    "https://unpkg.com/@tehshrike/readability@0.2.0"
  );

  const document =
    url === "" ? await getVaultDocument(app) : await fetchDocument(url);
  const { title, byline, content } = new Readability(document).parse();

  const markdownBody = new Turndown({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  }).turndown(content);

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
    metadata["Website"] = `[[${host}]]`;
  }
  if (byline !== null && byline !== undefined) {
    metadata["Author"] = `[[${byline}]]`;
  }

  const fileContent = [formatMetadata(metadata), "", markdownBody].join("\n");

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
