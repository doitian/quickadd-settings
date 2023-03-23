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
        defaultValue: "para/lets/c/ChatGPT Sessions/ChatGPT Prompts.md"
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
    const titleAndCallout = parts[0].trim().split("\n", 1)[0].split(" !");
    const prompt = {
      title: titleAndCallout[0],
      callout: titleAndCallout.length > 1 ? titleAndCallout[1] : "info",
      session: parts.slice(1).join("\n### ").trim()
    };
    prompts.push(prompt);
  }
  return prompts;
}

async function callApi(messages, settings) {
  const payload = {
    model: settings[OPENAI_MODEL_OPTION],
    messages,
  };

  try {
    const resp = await requestUrl({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings[OPENAI_TOKEN_OPTION]}`,
      },
      body: JSON.stringify(payload),
    });

    return resp.json.choices[0].message.content;
  } catch (ex) {
    const message = `🔴error: ${ex}`;
    new Notice(message);
    return message;
  }
}

async function sendSession(input, settings) {
  const messages = [];

  for (const message of input.split("\n### ").slice(1)) {
    const splitPos = message.indexOf("\n");
    const role = message.substring(0, splitPos).trim().toLowerCase();
    const content = message.substring(splitPos + 1).trim();
    messages.push({ role, content });
  }

  return await callApi(messages, settings);
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

  if (selection === "" && input.indexOf("#chatgpt-session") >= 0) {
    const sessionResp = await sendSession(input, settings);
    const lastLine = editor.lastLine();
    editor.replaceRange(`\n\n### Assistant\n\n${sessionResp.trim()}\n`, {
      line: lastLine + 1,
      pos: 0,
    });
    return;
  }

  const prompts = await getPrompts(app, settings);

  if (prompts.length === 0) {
    console.log(`🔵info: no prompts found`);
    return;
  }

  const selected = await quickAddApi.suggester(
    prompts.map((p) => p["title"]),
    prompts
  );

  const respContent = await sendSession(
    selected.session.replaceAll("{input}", input),
    settings
  );

  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const pos = { line: Math.max(from.line, to.line) + 1, ch: 0 };
  const callout = `\n\n> [!${selected.callout}] ${
    selected.title
  }\n> ${respContent.trim().replace(/\r*\n/g, "$&> ")}\n\n`;
  editor.replaceRange(callout, pos);
}
