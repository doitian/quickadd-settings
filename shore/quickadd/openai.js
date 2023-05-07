const OPENAI_MODEL_OPTION = "OpenAI Model";
const OPENAI_TOKEN_OPTION = "OpenAI Token";
const OPENAI_ENDPOINT_OPTION = "OpenAI Endpoint";
const OPENAI_TOKEN_ALT_OPTION = "OpenAI Token Alt";
const OPENAI_ENDPOINT_ALT_OPTION = "OpenAI Endpoint Alt";
const OPENAI_PROMPTS_OPTION = "OpenAI Prompts";

const SLEEP_INTERVAL = 100;
const NOTICE_AFTER = 300;
const API_TIMEOUT = 30000;

const BUILTIN_SESSIONS = [
  {
    title: "Adhoc",
    session: "\n### .User\n${input}",
  },
];

const COMPLETION_METHODS = [
  {
    title: "+callout",
  },
  {
    title: "+in-place",
  },
  {
    title: "+new-file",
  },
];

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
      [OPENAI_ENDPOINT_OPTION]: {
        type: "text",
        defaultValue: "https://api.openai.com",
        placeholder: "URI",
      },
      [OPENAI_TOKEN_ALT_OPTION]: {
        type: "text",
        defaultValue: "",
        placeholder: "TOKEN",
      },
      [OPENAI_ENDPOINT_ALT_OPTION]: {
        type: "text",
        defaultValue: "https://api.openai.com",
        placeholder: "URI",
      },
      [OPENAI_PROMPTS_OPTION]: {
        type: "text",
        // Example: https://kb.iany.me/para/lets/c/ChatGPT+Sessions/ChatGPT+Prompts
        defaultValue: "para/lets/c/ChatGPT Sessions/ChatGPT Prompts.md",
        placeholder: "TOKEN",
      },
    },
  },
};

function getToken(settings) {
  if (settings[OPENAI_ENDPOINT_OPTION].startsWith("https://")) {
    return settings[OPENAI_TOKEN_OPTION];
  }
  return settings[OPENAI_TOKEN_ALT_OPTION];
}

function getEndpoint(settings) {
  if (settings[OPENAI_ENDPOINT_OPTION].startsWith("https://")) {
    return settings[OPENAI_ENDPOINT_OPTION];
  }
  return settings[OPENAI_ENDPOINT_ALT_OPTION];
}

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
    const parts = section.split("\n### .");
    const title = parts[0].trim().split("\n", 1)[0].trim();
    const prompt = {
      title,
      session: `## Session\n\n### .${parts.slice(1).join("\n### .").trim()}`,
    };
    prompts.push(prompt);
  }
  return prompts;
}

async function callApi(messages, settings, options) {
  const payload = {
    model: settings[OPENAI_MODEL_OPTION],
    messages,
    ...options,
  };

  try {
    const req = {
      url: `${getEndpoint(settings)}/v1/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken(settings)}`,
      },
      body: JSON.stringify(payload),
    };
    const resp = await requestUrl(req);
    return resp.json.choices[0].message.content;
  } catch (ex) {
    const message = `🔴error: ${ex}`;
    new Notice(message);
    return message;
  }
}

async function sendSession(input, settings) {
  const options = {};
  const messages = [];

  input.split("\n").forEach((item) => {
    if (item.startsWith("**") && item.indexOf("**:: ") > 0) {
      const keyValue = item.split("**:: ");
      const key = keyValue[0].substring(2);
      let value = keyValue[1].trim();
      try {
        value = JSON.parse(value);
      } catch (e) {
        // ignore
      }
      options[key] = value;
    }
  });

  for (const message of input.split("\n### .").slice(1)) {
    const splitPos = message.indexOf("\n");
    const role = message.substring(0, splitPos).trim().toLowerCase();
    if (!role.startsWith("x")) {
      const content = message.substring(splitPos + 1).trim();
      messages.push({ role, content });
    }
  }

  if (messages.length === 0) {
    const err = "🔴error: no messages found";
    new Notice(err);
    console.log(`${err}\n${input}`);
    return err;
  }

  const promise = callApi(messages, settings, options);
  let isDone = false;
  let notice = null;
  const startTime = Date.now();
  let elapsed = 0;
  promise.finally(() => {
    isDone = true;
    if (notice !== null) {
      notice.hide();
    }
  });

  while (!isDone || elapsed > API_TIMEOUT) {
    const elapsed = Date.now() - startTime;
    if (notice === null) {
      if (elapsed >= NOTICE_AFTER) {
        notice = new Notice("🔵info: ai running", API_TIMEOUT);
      }
    } else {
      notice.setMessage(`🔵info: ai running ${(elapsed / 1000).toFixed(2)}s`);
    }
    await sleep(SLEEP_INTERVAL);
  }

  if (!isDone) {
    return Promise.reject("api timeout");
  }

  return await promise;
}

async function start(params, settings) {
  const { app, quickAddApi } = params;

  if (!settings[OPENAI_ENDPOINT_OPTION].startsWith("https://")) {
    console.log(`🔵info: OPENAI_API_HOST=${getEndpoint(settings)}`);
  }

  const leaf = app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;
  const cursorFrom = editor.getCursor("from");
  const cursorTo = editor.getCursor("to");
  const activeFile = app.workspace.getActiveFile();
  const selection = editor.getSelection();
  const input = selection !== "" ? selection : await app.vault.read(activeFile);

  if (selection === "" && input.indexOf("#ai-session") >= 0) {
    const sessionResp = await sendSession(input, settings);
    const lastLine = editor.lastLine();
    editor.replaceRange(`\n\n###. Assistant\n\n${sessionResp.trim()}\n`, {
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

  const choices = prompts.concat(BUILTIN_SESSIONS).concat(COMPLETION_METHODS);
  let selected = {};
  while (!("session" in selected)) {
    if ("title" in selected) {
      settings.completionMethod = selected.title;
    }
    selected = await quickAddApi.suggester((p) => p["title"], choices);
    if (selected === undefined) {
      return;
    }
  }

  const variableRegex = /\$\{[a-zA-Z]+\}/g;
  const variables = {
    "${input}": input,
  };
  for (const match of selected.session.matchAll(variableRegex)) {
    variables.found = true;
    if (!(match[0] in variables)) {
      variables[match[0]] = await quickAddApi.inputPrompt(match[0]);
    }
  }

  const session = selected.session.replace(
    variableRegex,
    (match) => variables[match]
  );
  const respContent = await sendSession(session, settings);

  if (settings.completionMethod === "+new-file") {
    let linkText = input;
    if (input.startsWith("[[") && input.endsWith("]]")) {
      linkText = input.substring(2, input.length - 2);
    }

    if (input === linkText) {
      editor.replaceSelection(`[[${input}]]`);
    }
    await app.workspace.openLinkText(linkText, activeFile.path);
    const from = { line: editor.lineCount() + 1, ch: 0 };
    const newEditor = app.workspace.activeLeaf.view.editor;
    editor.replaceRange(
      [
        `# ${linkText}\n`,
        "## Metadata\n",
        "**Status**:: #i",
        "**Zettel**:: #zettel/fleeting",
        "**Kind**:: #ai-session",
        `**Created**:: [[${quickAddApi.date.now()}]]`,
        `**Parent**:: [[${activeFile.name}]]`,
        "",
        session.trim(),
        "",
        "### .Assistant\n",
        respContent,
      ].join("\n"),
      from
    );
  } else if (settings.completionMethod === "+in-place") {
    editor.replaceRange(respContent, cursorFrom, cursorTo);
  } else {
    const pos = { line: Math.max(cursorFrom.line, cursorTo.line) + 1, ch: 0 };
    const callout = `\n\n> [!bot] ${selected.title}\n> ${respContent
      .trim()
      .replace(/\r*\n/g, "$&> ")}\n\n`;
    editor.replaceRange(callout, pos);
  }
}
