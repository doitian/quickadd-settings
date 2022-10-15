module.exports = async ({ app, quickAddApi }) => {
  const dv = app.plugins.plugins["dataview"]?.api;
  if (dv === undefined) {
    new Notice("🔴error: Dataview is not available");
    return;
  }

  const pages = dv
    .pages()
    .sort((a) => -a.file.mtime.ts)
    .limit(10);

  const leaf = app.workspace.getLeaf();
  const selectedFile = await quickAddApi.suggester(
    (page) => `${page.file.name}\n${page.file.folder}/`,
    pages
  );
  if (selectedFile !== undefined) {
    leaf.openFile(app.vault.getAbstractFileByPath(selectedFile.file.path));
  }
};
