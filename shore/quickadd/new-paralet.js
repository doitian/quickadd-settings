module.exports = start;

const CATEGORIES = ["1 Projects", "2 Areas", "3 Resources", "4 Archive"];

function getFileName(fileName) {
  return fileName
    .replaceAll(":", "")
    .replace(/[/\\?%*|"<>]/g, "-")
    .replace(/[ \.\-]+$/, "");
}

async function start({ app, quickAddApi }) {
  let name = await quickAddApi.inputPrompt("Name", "1/name/");
  const createFolder = name.endsWith("/");
  if (createFolder) {
    name = name.substring(0, name.length - 1);
  }
  const parts = name.split("/");
  if (parts.length > 2) {
    new Notice(`🔴error: invalid input ${name}`);
    return;
  }

  const category =
    parts.length > 1 ? CATEGORIES[parseInt(parts[0], 10) - 1] : CATEGORIES[0];
  name = parts.length > 1 ? parts[1] : parts[0];

  const basename = getFileName(name);

  let firstChar = basename[0].toLowerCase();
  if (firstChar < "a" || firstChar > "z") {
    firstChar = await quickAddApi.inputPrompt("Filing letter", "_", "_");
  }

  const filingFolder = `para/lets/${firstChar}`;
  const parentPath = createFolder
    ? `${filingFolder}/${basename}`
    : filingFolder;
  const newPath = createFolder
    ? `${parentPath}/♯ ${basename}.md`
    : `${parentPath}/${basename}.md`;

  if (await app.vault.adapter.exists(newPath)) {
    new Notice(`🔴error: file already exists in ${newPath}`);
    return;
  }

  if (!(await app.vault.adapter.exists(parentPath))) {
    await app.vault.createFolder(parentPath);
  }

  const now = moment();
  const lines = [
    createFolder ? `# ♯ ${name}` : `# ${name}`,
    "\n## Metadata\n",
    "**Kind**:: #paralet",
    `**PARA**:: [[${category}]]`,
    `**Status**:: #i`,
    `**Zettel**:: #zettel/fleeting`,
    `**Created**:: [[${now.format("YYYY-MM-DD")}]]`,
    "\n## Synopsis\n",
  ];

  const newFile = await app.vault.create(newPath, lines.join("\n"));
  await app.workspace.getLeaf().openFile(newFile);
  new Notice(`🔵info: file created in ${newPath}`);
}
