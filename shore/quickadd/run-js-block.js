module.exports = start;

async function start(params) {
  const { app, obsidian } = params;
  const leaf = this.app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const cursor = editor.getCursor();
  const lastLine = editor.lastLine();

  let fromLine = cursor.line;
  while (fromLine >= 0) {
    const text = editor.getLine(fromLine);
    if (text.startsWith("```javascript")) {
      fromLine += 1;
      break;
    }
    fromLine -= 1;
  }
  if (fromLine < 0) {
    new Notice("🔴error: no JavaScript block found");
    return;
  }

  const lines = [];
  let toLine = fromLine;
  while (toLine <= lastLine) {
    const text = editor.getLine(toLine);
    if (text === "```") {
      toLine -= 1;
      break;
    }
    lines.push(text);
    toLine += 1;
  }

  const eob = { line: toLine === lastLine ? toLine + 1 : toLine + 2, ch: 0 };
  if (eob.line > lastLine) {
    editor.replaceRange("\n", eob);
  }

  const append = (text) => {
    editor.replaceRange(text + "\n", eob);
  };

  const AsyncFunction = (async function () {}).constructor;
  await (new AsyncFunction(lines.join("\n"))).call(this);
}
