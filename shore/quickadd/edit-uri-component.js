module.exports = start;

async function start(params) {
  const { app, quickAddApi } = params;

  const leaf = app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const selection = editor.getSelection();
  const edited = await quickAddApi.wideInputPrompt(
    "selection",
    null,
    decodeURIComponent(selection)
  );
  if (edited !== undefined) {
    editor.replaceRange(
      encodeURIComponent(edited),
      editor.getCursor("from"),
      editor.getCursor("to"),
      selection
    );
  }
}
