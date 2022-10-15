function notice(text) {
  new Notice(text);
  return text;
}

async function obrEx(cm, params) {
  if (params?.args?.length !== 1) {
    throw new Error(notice("🔴error: ob requires exactly 1 parameter"));
  }

  const command = params.args[0];
  this.app.commands.executeCommandById(command);
}

async function oblEx(cm, params) {
  let commands = Object.keys(this.app.commands.commands);
  for (const keyword of params?.args ?? []) {
    commands = commands.filter((command) => command.includes(keyword));
  }

  console.log(
    `🔵info: obl ${params?.args?.join?.(" ")}\n  ${commands.join("\n  ")}`
  );
}

async function cssEx(cm, params) {
  if (params?.args?.length !== 1) {
    console.log(`🔵info: css ${this.app.customCss.snippets.join("|")}`);
    throw new Error(notice("🔴error: ob requires exactly 1 parameter"));
  }

  const snippet = params.args[0];
  const status = !this.app.customCss.enabledSnippets.has(snippet);
  this.app.customCss.setCssEnabledStatus(snippet, status);
}

// https://github.com/words/ap-style-title-case/blob/master/index.js
const titleCase = (() => {
  const stopwords = "a an and at but by for in nor of on or so the to up yet";
  const defaults = stopwords.split(" ");

  const capitalize = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return function (str, options) {
    const opts = options || {};

    if (!str) return "";

    const stop = opts.stopwords || defaults;
    const keep = opts.keepSpaces;
    const splitter = /(\s+|[-‑–—])/;

    return str
      .split(splitter)
      .map((word, index, all) => {
        if (word.match(/\s+/)) return keep ? word : " ";
        if (word.match(splitter)) return word;

        if (
          index !== 0 &&
          index !== all.length - 1 &&
          stop.includes(word.toLowerCase())
        ) {
          return word.toLowerCase();
        }

        return capitalize(word);
      })
      .join("");
  };
})();

// https://codemirror.net/5/keymap/vim.js
const titleCaseOperator = (() => {
  const cursorIsBefore = function (cur1, cur2) {
    if (cur1.line < cur2.line) {
      return true;
    }
    if (cur1.line == cur2.line && cur1.ch < cur2.ch) {
      return true;
    }
    return false;
  };

  const cursorMin = function (cur1, cur2) {
    return cursorIsBefore(cur1, cur2) ? cur1 : cur2;
  };

  const findFirstNonWhiteSpaceCharacter = function (text) {
    if (!text) {
      return 0;
    }
    var firstNonWS = text.search(/\S/);
    return firstNonWS == -1 ? text.length : firstNonWS;
  };

  return function (cm, args, ranges, oldAnchor, newHead) {
    const selections = cm.getSelections();
    const newSelections = selections.map((s) =>
      titleCase(s, { keepSpaces: true })
    );
    cm.replaceSelections(newSelections);
    if (args.shouldMoveCursor) {
      return newHead;
    } else if (
      !cm.state.vim.visualMode &&
      args.linewise &&
      ranges[0].anchor.line + 1 == ranges[0].head.line
    ) {
      return {
        line: oldAnchor.line,
        ch: findFirstNonWhiteSpaceCharacter(cm.getLine(oldAnchor.line)),
      };
    } else if (args.linewise) {
      return oldAnchor;
    } else {
      return cursorMin(ranges[0].anchor, ranges[0].head);
    }
    return newHead;
  };
})();

function newLineAction(cm, { repeat, after }) {
  const cur = cm.getCursor();
  const lines = "\n".repeat(repeat);
  const insertAtLine = after ? cur.line + 1 : cur.line;
  cm.replaceRange(lines, { line: insertAtLine, ch: 0 });
}

function swapLineAction(_cm, { repeat, down }) {
  const command = down ? "editor:swap-line-down" : "editor:swap-line-up";
  for (let i = 0; i < repeat; i++) {
    this.app.commands.executeCommandById(command);
  }
}

module.exports = async function ({ app, obsidian }) {
  window.Obsidian = obsidian;

  const vim = window.CodeMirrorAdapter?.Vim;
  if (vim === undefined) {
    new Notice(`🔴error: vim mode is disabled`);
    return;
  }

  const ctx = { app };
  vim.defineEx("obr", "", obrEx.bind(ctx));
  vim.defineEx("obl", "", oblEx.bind(ctx));
  vim.defineEx("css", "", cssEx.bind(ctx));
  vim.defineOperator("titleCase", titleCaseOperator.bind(ctx));
  vim.defineAction("newLine", newLineAction.bind(ctx));
  vim.defineAction("swapLine", swapLineAction.bind(ctx));

  vim.map(":Reload", ":obr app:reload");

  vim.map("zo", ":obr editor:toggle-fold");
  vim.map("zc", ":obr editor:toggle-fold");
  vim.map("za", ":obr editor:toggle-fold");
  vim.map("zR", ":obr editor:unfold-all");
  vim.map("zM", ":obr editor:fold-all");
  vim.map("zj", ":obr quickadd:choice:951229bf-39c3-4bc5-9c7e-79e35bf7ed20");
  vim.map("zk", ":obr quickadd:choice:cfb3a2dc-bcd0-49cc-ae29-aad47a895b7a");

  vim.map("]b", ":obr app:go-forward");
  vim.map("[b", ":obr app:go-back");
  vim.mapCommand("]<Space>", "action", "newLine", { after: true });
  vim.mapCommand("[<Space>", "action", "newLine", { after: false });
  vim.mapCommand("]e", "action", "swapLine", { down: true });
  vim.mapCommand("[e", "action", "swapLine", { down: false });

  vim.map("gt", ":obr quickadd:choice:24a59cbd-70db-4a9d-8b45-ae364015e38a");
  vim.map("gT", ":obr quickadd:choice:acbebf41-1c62-4983-92e8-83de5c55b412");

  vim.mapCommand("gz", "operator", "titleCase");

  vim.unmap("<Space>");
  vim.map("<Space><Space>", ":obr switcher:open");
  vim.map("<Space>n", ":nohl");
  vim.map(
    "<Space>h",
    // Find Files Here
    ":obr quickadd:choice:39de731f-f2c7-4494-8c84-9855da33b27c"
  );

  vim.map("f<CR>", ":obr obsidian-linter:lint-file");

  // Let o calls Editor.newlineAndIndentContinueMarkdownList
  CodeMirrorAdapter.commands.newlineAndIndentContinueComment = () => {
    const editor = app.workspace.activeLeaf?.view?.editor;
    if (editor) {
      const cursor = editor.getCursor();
      const eol = { line: cursor.line, ch: editor.getLine(cursor.line).length };
      editor.setCursor(eol);
      editor.newlineAndIndentContinueMarkdownList();
    }
  };
};
