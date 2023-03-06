const OPENAI_MODEL_OPTION = "OpenAI Model";
const OPENAI_TOKEN_OPTION = "OpenAI Token";
const OPENAI_PROMPTS_OPTION = "OpenAI Prompts";

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [OPENAI_MODEL_OPTION]: {
        type: "text",
        defaultValue: "gpt-3.5-turbo",
        placeholder: "TOKEN",
      },
      [OPENAI_TOKEN_OPTION]: {
        type: "text",
        defaultValue: "",
        placeholder: "TOKEN",
      },
      [OPENAI_PROMPTS_OPTION]: {
        type: "text",
        defaultValue: "para/lets/a/AIGC/ChatGPT Prompts.md",
        placeholder: "TOKEN",
      },
    },
  },
};

async function getPrompts(app, settings) {
  const prompts = [];
  const promptsFile = app.vault.getAbstractFileByPath(
    settings[OPENAI_PROMPTS_OPTION]
  );
  if (promptsFile === null) {
    new Notice("🔴error: prompts not found");
    return prompts;
  }

  const content = await app.vault.read(promptsFile);

  for (const section of content.split("\n## ").slice(2)) {
    const parts = section.split("\n### ");
    const prompt = { title: parts[0].trim() };
    for (const field of parts.slice(1)) {
      const trimmedField = field.trim();
      const newlinePos = trimmedField.indexOf("\n");
      if (newlinePos > 0) {
        const fieldName = trimmedField.substring(0, newlinePos).toLowerCase();
        prompt[fieldName] = trimmedField.substring(newlinePos + 1).trim();
      }
    }
    prompts.push(prompt);
  }
  return prompts;
}

async function start(params, settings) {
  const { app, quickAddApi } = params;

  const leaf = app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const selection = editor.getSelection();
  const input =
    selection !== ""
      ? selection
      : await app.vault.read(app.workspace.getActiveFile());

  const prompts = await getPrompts(app, settings);

  if (prompts.length === 0) {
    console.log(`🔵info: no prompts found`);
    return;
  }

  const selected = await quickAddApi.suggester(
    prompts.map((p) => p["title"].split(" !", 1)[0]),
    prompts
  );

  const payload = {
    model: settings[OPENAI_MODEL_OPTION],
    messages: [],
  };

  for (const key in selected) {
    if (key !== "title") {
      payload["messages"].push({
        role: key,
        content: selected[key].replace("{SELECTION}", input),
      });
    }
  }

  const resp = await requestUrl({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings[OPENAI_TOKEN_OPTION]}`,
    },
    body: JSON.stringify(payload),
  });

  const respContent = resp.json.choices[0].message.content;

  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const pos = { line: Math.max(from.line, to.line) + 1, ch: 0 };
  const calloutTitleType = selected["title"].split(" !");
  const calloutTitle = calloutTitleType[0];
  const calloutType =
    calloutTitleType.length > 1 ? calloutTitleType[1] : "info";
  const callout = `\n> [!${calloutType}] ${calloutTitle}\n> ${respContent
    .trim()
    .replace(/\r*\n/g, "$&> ")}\n\n`;
  editor.replaceRange(callout, pos);
}
