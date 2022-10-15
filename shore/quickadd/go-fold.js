const GO_FOLD_PREV = "Go Fold Prev";
const TITLE_RE = /^#[#]*\s/;
const LIST_RE = /^[\s]*[-*]\s/;

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [GO_FOLD_PREV]: {
        type: "toggle",
        defaultValue: false,
      },
    },
  },
};

function lineKind(line) {
  const titleMatch = line.match(TITLE_RE);
  if (titleMatch) {
    return { kind: "title", indentation: titleMatch[0].length };
  }

  const listMatch = line.match(LIST_RE);
  if (listMatch) {
    return {
      kind: "list",
      indentation: listMatch[0].length,
    };
  }

  return { kind: "normal", indentation: 0 };
}

function isSibling(current, target) {
  if (current.kind === "normal") {
    return target.kind !== "normal";
  }

  if (current.kind !== target.kind) {
    return false;
  }

  if (target.indentation < current.indentation) {
    return "break";
  }

  return target.indentation === current.indentation;
}

function navigate(editor, isForward) {
  const step = isForward ? 1 : -1;
  const lineCount = editor.lineCount();

  let line = editor.getCursor().line;
  let inCodeBlock = false;
  const currentLineText = editor.getLine(line);
  const current = lineKind(editor.getLine(line));
  for (line = line + step; line >= 0 && line < lineCount; line += step) {
    const lineText = editor.getLine(line);
    if (lineText.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }
    if (inCodeBlock) {
      continue;
    }

    const target = lineKind(lineText);
    const result = isSibling(current, target);
    if (result === "break") {
      break;
    }
    if (result) {
      editor.setCursor({ line, ch: target.indentation });
      return;
    }
  }
}

async function start({ app, obsidian: { MarkdownView } }, settings) {
  const goPrev = settings[GO_FOLD_PREV];

  const view = app.workspace.getActiveLeafOfViewType(MarkdownView);
  const editor = view?.editor;
  if (editor === undefined) {
    new Notice("🔴error: no active editor");
    return;
  }

  navigate(editor, !goPrev);
}
