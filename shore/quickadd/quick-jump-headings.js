const HEADING_REGEX = /^#{1,6}\s+.*/gm;

async function start({ app, quickAddApi }) {
  const leaf = app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const activeFile = app.workspace.getActiveFile();
  const text = await app.vault.read(activeFile);

  const headings = [];

  for (let lineNumber = 0; lineNumber < editor.lineCount(); ++lineNumber) {
    const lineContent = editor.getLine(lineNumber);
    if (lineContent.match(HEADING_REGEX)) {
      headings.push({ cursor: { line: lineNumber, ch: 0 }, text: lineContent });
    }
  }

  const jumpTo = await quickAddApi.suggester((h) => h.text, headings);
  if (jumpTo !== undefined) {
    editor.setCursor(jumpTo.cursor);
  }
}

module.exports = start;
