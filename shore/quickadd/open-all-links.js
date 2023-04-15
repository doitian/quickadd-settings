function openSelectionLinks({ app, activeFile }, selection) {
  const linkRegex = /(?:\[\[([^\]]+)\]\])/g;

  for (const match of selection.matchAll(linkRegex)) {
    const linkText = match[1].split("|")[0].trim();
    const linkFile = app.metadataCache.getFirstLinkpathDest(
      linkText,
      activeFile.path
    );
    if (linkFile !== null) {
      app.workspace.getLeaf("tab").openFile(linkFile, { active: false });
    }
  }
}

module.exports = async ({ app }) => {
  const leaf = app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const selection = editor.getSelection();

  if (selection.trim() === '') {
    new Notice("🟡warning: no selection, in preview mode?");
    return;
  }

  const context = { app, activeFile: app.workspace.getActiveFile() };
  openSelectionLinks(context, selection);
};
