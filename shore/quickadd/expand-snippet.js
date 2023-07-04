const FALLBACK_COMMAND = "Fallback Command";

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [FALLBACK_COMMAND]: {
        type: "text",
        defaultValue: "editor:follow-link",
        placeholder: "COMMAND",
      },
    },
  },
};

function insertBeforeCursor(editor, text) {
  editor.replaceSelection(text + editor.getSelection(), editor.getCursor());
}

function insertAfterCursor(editor, text) {
  editor.replaceRange(text, editor.getCursor());
}

async function todaySuggester(editor) {
  insertBeforeCursor(editor, `[[${moment().format("YYYY-MM-DD")}]]`);
}

async function pageSuggester(editor) {
  insertBeforeCursor(editor, "[[");
  insertAfterCursor(editor, "]]");
}

async function tagSuggester(editor) {
  insertBeforeCursor(editor, "#");
}

function choicesSuggester(choices) {
  return async (editor, quickAddApi) => {
    const selected = await quickAddApi.suggester(choices, choices);
    insertBeforeCursor(editor, selected);
  };
}

const PropertySuggesters = {
  Created: todaySuggester,
  Archived: todaySuggester,
  Published: todaySuggester,
  Status: choicesSuggester(["#i", "#now", "#later", "#someday", "#x"]),
  Zettel: choicesSuggester([
    "#zettel/fleeting",
    "#zettel/literature",
    "#zettel/permanent",
    "#zettel/index",
    "#zettel/keyword",
  ]),
  PARA: choicesSuggester([
    "[[1 Projects]]",
    "[[2 Areas]]",
    "[[3 Resources]]",
    "[[4 Archive]]",
  ]),
  Topic: pageSuggester,
  Topics: pageSuggester,
  Parent: pageSuggester,
  Highlights: pageSuggester,
  Kind: tagSuggester,
};

const Snippets = {
  ddate: () => moment().format("YYYY-MM-DD"),
  ttime: () => moment().format("HH:mm:ss"),
  zzettel: () => moment().format("YYYYMMDDHHmm"),
  ttitle: ({ file }) => file.basename,
  vvsharp: () => "♯",
  vvsec: () => "§",
  vvah: () => "➤",
  vvspace: () => "␣",
  vveop: () => "∎",
  vvreturn: () => "↩︎",
  vvref: () => "※",
  "kk=>": () => "⇒",
  "kk==": () => "⇔",
  ttitle: ({ file }) =>
    file.name.substring(0, file.name.length - file.extension.length - 1),
  ffname: ({ file }) => file.name,
  ffpath: ({ file }) => file.path,
};

const SnippetsRegExp = new RegExp(`(${Object.keys(Snippets).join("|")})$`);

function lastIndexOfGroup(str, group) {
  return Math.max(...group.map((ch) => str.lastIndexOf(ch)));
}

async function suggestPropertyValue(editor, quickAddApi, key) {
  if (key in PropertySuggesters) {
    await PropertySuggesters[key](editor, quickAddApi);
  }
}

function fallback({ app, editor }, settings) {
  if (editor?.cm?.cm?.state?.vim?.insertMode) {
    // no fallback in insert mode
    return;
  }

  app.commands.executeCommandById(settings[FALLBACK_COMMAND]);
}

function pageProperties(page) {
  const topProperties = Object.keys(page).filter(
    (key) => key.toLowerCase() === key
  );
  topProperties.remove("file");
  return topProperties.concat(
    Object.keys(page.file).map((key) => `file.${key}`)
  );
}

function getPageProperty(page, key, stringifyYaml) {
  if (key.startsWith("file.")) {
    return formatPageProperty(page.file[key.slice(5)], stringifyYaml);
  }
  return formatPageProperty(page[key], stringifyYaml);
}

function formatPageProperty(value, stringifyYaml) {
  if (Array.isArray(value)) {
    const children = value.map(formatPageProperty);
    for (const child of children) {
      if (child.includes("\n")) {
        return children.join("");
      }
    }
    return children.join(" ");
  }

  if (typeof value === "object") {
    if ("text" in value && "symbol" in value) {
      return `${value.symbol} ${value.task ? `[${value.status}] ` : ""}${
        value.text
      }\n`;
    }
  }

  const display = value.toString();
  if (display === "[object Object]") {
    const yaml = stringifyYaml(value);
    return `\`\`\`yaml\n${yaml.trimRight()}\n\`\`\`\n`;
  }
  return display;
}

const CALLOUT_TYPES = [
  "note",
  "abstract",
  "summary",
  "tldr",
  "info",
  "todo",
  "tip",
  "hint",
  "important",
  "success",
  "check",
  "done",
  "question",
  "help",
  "faq",
  "warning",
  "caution",
  "attention",
  "failure",
  "fail",
  "missing",
  "danger",
  "error",
  "bug",
  "example",
  "quote",
  "cite",
  "file",
  "code",
  "bot",
];

async function start(
  { app, quickAddApi, obsidian: { MarkdownView, stringifyYaml } },
  settings
) {
  const view = app.workspace.getActiveLeafOfViewType(MarkdownView);
  const editor = view?.editor;
  if (editor === undefined) {
    new Notice("🔴error: no active editor");
    return;
  }
  const dv = app.plugins.plugins["dataview"]?.api;

  if (editor?.cm?.cm?.state?.vim?.insertMode === false) {
    fallback({ app, editor }, settings);
    return;
  }

  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const textBefore = line.slice(0, cursor.ch);

  if (textBefore.length === 0) {
    fallback({ app, editor }, settings);
    return;
  }

  if (textBefore.endsWith("**::")) {
    const parts = textBefore.split("**");
    const key = parts[parts.length - 2];
    insertBeforeCursor(editor, " ");
    await suggestPropertyValue(editor, quickAddApi, key);
    return;
  }

  if (textBefore === "::") {
    const keys = Object.keys(PropertySuggesters);
    const key = await quickAddApi.suggester(keys, keys);
    editor.replaceRange(
      `**${key}**:: `,
      { line: cursor.line, ch: 0 },
      { line: cursor.line, ch: 2 }
    );
    await suggestPropertyValue(editor, quickAddApi, key);
    return;
  }


  if (textBefore.endsWith(":")) {
    const keyStartPosition = {
      line: cursor.line,
      ch: lastIndexOfGroup(textBefore, ["(", "["]) + 1,
    };
    const keyEndPosition = { line: cursor.line, ch: cursor.ch - 1 };
    const key = line.slice(keyStartPosition.ch, keyEndPosition.ch);
    editor.replaceRange("**:: ", keyEndPosition, cursor);
    editor.replaceRange("**", keyStartPosition);
    await suggestPropertyValue(editor, quickAddApi, key);
    return;
  }

  if (textBefore.endsWith(":: ")) {
    const keyStartPosition = {
      line: cursor.line,
      ch: lastIndexOfGroup(textBefore, ["(", "["]) + 1,
    };
    const keyEndPosition = { line: cursor.line, ch: cursor.ch - 3 };
    let key = line.slice(keyStartPosition.ch, keyEndPosition.ch);
    if (key.startsWith("**") && key.endsWith("**")) {
      key = key.substring(2, key.length - 2);
    } else {
      editor.replaceRange("**:: ", keyEndPosition, cursor);
      editor.replaceRange("**", keyStartPosition);
    }
    await suggestPropertyValue(editor, quickAddApi, key);
    return;
  }

  if (textBefore === "> [!") {
    const calloutType = await quickAddApi.suggester(
      CALLOUT_TYPES,
      CALLOUT_TYPES
    );
    insertBeforeCursor(editor, calloutType);
    return;
  }

  if (dv !== undefined && textBefore.endsWith("]].")) {
    const wikilinkStartPosition = textBefore.lastIndexOf("[[");
    if (wikilinkStartPosition !== -1) {
      const pageName = textBefore
        .slice(wikilinkStartPosition + 2, -3)
        .split("|")[0];
      const page =
        pageName !== "" ? dv.page(pageName) : dv.page(view.file.path);
      if (page !== undefined) {
        const keys = pageProperties(page);
        const propertyValues = keys.map((key) =>
          getPageProperty(page, key, stringifyYaml)
        );
        const propertyValue = await quickAddApi.suggester(
          (v, index) =>
            `${keys[index]}:: ${
              v.contains("\n") ? v.split("\n", 2)[0] + "…" : v
            }`,
          propertyValues
        );
        if (propertyValue !== undefined) {
          editor.replaceRange(
            propertyValue,
            {
              line: cursor.line,
              ch: wikilinkStartPosition,
            },
            cursor
          );
        }
      }
    }
  }

  if (textBefore === "tpl") {
    editor.replaceRange("", { line: cursor.line, ch: 0 }, cursor);
    app.commands.executeCommandById("insert-template");
    return;
  }

  if (dv !== undefined && textBefore.endsWith("etal")) {
    const page = dv.page(view.file.path);
    let authors = page.authors ?? page.author ?? [];
    if (!Array.isArray(authors)) {
      authors = [authors];
    }

    let briefAuthors = "";
    if (authors.length === 1) {
      briefAuthors = authors[0].path;
    } else if (authors.length > 1) {
      briefAuthors = authors[0].path + " et al.";
    }

    editor.replaceRange(
      briefAuthors,
      { line: cursor.line, ch: cursor.ch - 4 },
      cursor
    );
    return;
  }

  if (dv !== undefined && textBefore.endsWith("dv=")) {
    const expression = await quickAddApi.inputPrompt("dv=");
    const result = dv.evaluate(expression);
    if (result.successful) {
      editor.replaceRange(
        `${result.value}`,
        { line: cursor.line, ch: cursor.ch - 3 },
        cursor
      );
    } else {
      new Notice(`🔴error: ${result.error}`);
    }
    return;
  }

  const found = textBefore.match(SnippetsRegExp);
  if (found !== null) {
    const key = found[0];
    const snippetContext = { app, file: view.file };
    const replacement = Snippets[key](snippetContext);
    editor.replaceRange(
      replacement,
      { line: cursor.line, ch: cursor.ch - key.length },
      cursor
    );
    return;
  }

  fallback({ app, editor }, settings);
}
