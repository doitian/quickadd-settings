// Insert Bibliography to the note by scanning all the citations like `[@citation]`.
const JSON_RPC_ENDPOINT = "http://localhost:23119/better-bibtex/json-rpc";
const HEADERS = {
  "User-Agent": "Obsidian",
  "Zotero-Allowed-Request": "true",
};

module.exports = async (params) => {
  const {
    app: { workspace, vault },
  } = params;

  const leaf = this.app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }

  const editor = leaf.view.editor;
  const lineCount = editor.lineCount();
  const citekeys = new Set();
  const replacer = (match, p1) => {
    const keys = p1.split("; @");
    for (const key of keys) {
      citekeys.add(key);
    }
    const inner = keys.map((k) => `[[#^${k}|⦗@${k}⦘]]`).join("; ");
    return `(${inner})`;
  };

  for (let line = 0; line < lineCount; ++line) {
    const text = editor.getLine(line);
    const newText = text.replace(/\[@([^@\]]+(?:; @[^@\]]+)*)\]/g, replacer);
    if (text !== newText) {
      editor.setLine(line, newText);
    }
  }

  const sortedKeys = Array.from(citekeys.values()).sort();
  for (const key of sortedKeys) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method: "item.bibliography",
      params: [[key], { id: "apa", contentType: "text" }],
      id: 1,
    });

    const response = (
      await requestUrl({
        url: JSON_RPC_ENDPOINT,
        method: "POST",
        contentType: "application/json",
        headers: HEADERS,
        body: payload,
        throw: true,
      })
    ).json;

    editor.replaceRange("\n", { line: editor.lineCount(), ch: 0 });

    if ("error" in response) {
      new Notice("🔴error: " + response.error.message);
    } else {
      const bib = response.result.trim();
      editor.replaceRange(`- [[${key}|⦗@${key}⦘]] ${bib} ^${key}\n`, {
        line: editor.lineCount(),
        ch: 0,
      });
    }
  }

  new Notice("🔵info: bibiography generated");
};
