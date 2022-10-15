const HEADERS = {
  "User-Agent": "Obsidian",
  "Zotero-Allowed-Request": "true",
};

module.exports = start;

function getEntries(app, dv) {
  if (dv !== undefined) {
    return dv.pages('"robot/Zotero Library"').array();
  } else {
    const folder = app.vault.getAbstractFileByPath("robot/Zotero Library");
    return folder.children.map((file) => ({
      file: {
        name: file.basename,
        path: file.path,
      },
    }));
  }
}

function displayPage(page) {
  if ("aliases" in page) {
    return [page.file.name, page.aliases[0]].join("\n");
  }
  return page.file.name;
}

function insertBeforeCursor(editor, text) {
  editor.replaceSelection(text + editor.getSelection(), editor.getCursor());
}

async function start({ app, quickAddApi, obsidian: { Platform } }, settings) {
  const leaf = this.app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;

  const dv = app.plugins.plugins["dataview"]?.api;
  const entries = getEntries(app, dv);
  if (!Platform.isMobile) {
    entries.unshift({
      cayw: "http://127.0.0.1:23119/better-bibtex/cayw?format=pandoc&brackets=1",
      file: {
        name: "🔍 Cite as You Write",
      },
    });
  }

  const selected = await quickAddApi.suggester(displayPage, entries);
  if (selected === undefined) {
    return;
  }

  if ("cayw" in selected) {
    try {
      const content = await request({ url: selected.cayw, headers: HEADERS });
      insertBeforeCursor(editor, content);
    } catch (error) {
      new Notice(`🔴error: failed to call cayw ${error}`);
      return;
    }
  } else {
    insertBeforeCursor(editor, `[@${selected.file.name}]`);
  }
}
