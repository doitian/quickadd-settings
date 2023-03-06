const DICTIONARY_API_KEY_OPTION = "Dictionary API Key";
const WORD_PREFIX_OPTION = "Word Prefix";
const FILTERS = ["today", "tomorrow"];

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [DICTIONARY_API_KEY_OPTION]: {
        type: "text",
        defaultValue: "",
        placeholder: "API Key",
      },
      [WORD_PREFIX_OPTION]: {
        type: "text",
        defaultValue: "define ",
        placeholder: "",
      },
    },
  },
};

function pushAndSquashEmptyLine(lines) {
  if (
    lines.length > 0 &&
    lines[lines.length - 1] !== "" &&
    !lines[lines.length - 1].endsWith("\n")
  ) {
    lines.push("");
  }
}

async function formatPR(app, pr) {
  let audioLink = "";
  if ("sound" in pr) {
    const audioPath = await saveAudio(app, pr.sound.audio);
    audioLink = `![[${audioPath.name}]]`;
  }
  return `\`/ ${pr.mw} /\` ${audioLink}`;
}

function subdirOfAudio(filename) {
  if (filename.startsWith("bix")) {
    return "bix";
  } else if (filename.startsWith("gg")) {
    return "gg";
  }

  const match = filename.match(/^[a-z]/i);
  if (match !== null) {
    return match[0];
  }

  return "number";
}

async function saveAudio(app, filename) {
  const subdir = subdirOfAudio(filename);
  const audioPathParent = `robot/Vocabulary/res/${subdir}`;
  const audioPath = `${audioPathParent}/pr-sound-${filename}.wav`;
  const audioExists = await app.vault.adapter.exists(audioPath);

  if (!audioExists) {
    const url = `https://media.merriam-webster.com/soundc11/${subdir}/${filename}.wav`;
    const audioResp = await requestUrl(url);
    const audioBlob = audioResp.arrayBuffer;

    const parentExists = await app.vault.adapter.exists(audioPathParent);
    if (!parentExists) {
      await app.vault.createFolder(audioPathParent);
    }
    await app.vault.createBinary(audioPath, audioBlob);
  }

  return app.vault.getAbstractFileByPath(audioPath);
}

async function lookup(word, settings) {
  const requestParams = new URLSearchParams({
    key: settings[DICTIONARY_API_KEY_OPTION],
  });
  const url = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURI(
    word
  )}?${requestParams}`;
  const resp = await requestUrl(url);
  return resp.json;
}

function formatVA(seqItem) {
  if ("vrs" in seqItem) {
    return seqItem["vrs"].map((x) => `**${x.va}**`).join("; ") + " ";
  }
  return "";
}

function formatSN(seqItem) {
  if ("sn" in seqItem) {
    const sn = seqItem.sn.replace(/\d+/, "").trim();
    if (sn == "") {
      return "";
    }
    return `**${sn}** `;
  }

  return "";
}

const TAG_MAPPINGS = {
  "{bc}": ": ",
  "{dx_def}": "(",
  "{/dx_def}": ")",
  "{wi}": "_",
  "{/wi}": "_",
  "{it}": "_",
  "{/it}": "_",
  "{dx_ety}": "",
  "{/dx_ety}": "",
};

function linkify(wordPrefix, id) {
  const parts = id.split(":");
  if (parts.length > 1) {
    return `${wordPrefix}${parts[0]}#^${id.replaceAll(":", "-")}`;
  }

  return [wordPrefix, id].join("");
}

function translateTags(text, wordPrefix) {
  for (const key in TAG_MAPPINGS) {
    text = text.replaceAll(key, TAG_MAPPINGS[key]);
  }

  return text.replace(/{([^}]+)}/g, (match, p1) => {
    const parts = p1.split("|");
    if (parts[0] === "dxt") {
      const [stem, homo] = parts[1].split(":");
      return `[[${linkify(
        wordPrefix,
        parts[1]
      )}|${stem.toUpperCase()} entry ${homo}]]`;
    }
    if (parts[0] === "d_link" || parts[0] === "a_link") {
      if (parts.length > 2 && parts[2] !== "" && parts[2] != parts[1]) {
        return `[[${linkify(wordPrefix, parts[2])}|${parts[1]}]]`;
      } else {
        return `[[${linkify(wordPrefix, parts[1])}|${parts[1]}]]`;
      }
    }
    if (parts[0] === "sx") {
      if (parts.length > 2 && parts[2] !== "" && parts[2] != parts[1]) {
        return `[[${linkify(wordPrefix, parts[2])}|${parts[1].toUpperCase()}]]`;
      } else {
        return `[[${linkify(wordPrefix, parts[1])}|${parts[1].toUpperCase()}]]`;
      }
    }
    return match;
  });
}

function formatSEQItem(seqItem, wordPrefix, indent) {
  const prefix = " ".repeat(indent) + "> ";
  const lines = [];

  const va = formatVA(seqItem);
  const sn = formatSN(seqItem);
  lines.push(va + sn + translateTags(seqItem.dt[0][1], wordPrefix));

  for (const vis of seqItem.dt.slice(1)) {
    if (vis[0] === "vis") {
      let isFirst = true;
      for (const visItem of vis[1]) {
        lines.push(translateTags(visItem.t, wordPrefix).replace(/^/gm, prefix));
        if ("aq" in visItem) {
          lines.push(prefix + "— " + visItem.aq.auth);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function pushDROS(lines, dros, wordPrefix) {
  lines.push("#### Phrases\n");
  for (const dro of dros) {
    lines.push(`- **${dro.drp.replace("*", "")}**`);
    for (const defItem of dro.def) {
      for (const sseq of defItem.sseq) {
        for (const seqItem of sseq) {
          lines.push(`    - ${formatSEQItem(seqItem[1], wordPrefix, 4)}`);
        }
      }
    }
  }
}

async function format(app, explanation, settings) {
  const wordPrefix = settings[WORD_PREFIX_OPTION];
  const stem = explanation[0].meta.id.split(":")[0];

  const homographs = explanation.filter(
    (x) => x.meta.id.split(":")[0] === stem
  );
  const phrases = explanation.slice(homographs.length);

  const lines = [
    "---",
    `aliases: ["${stem}"]`,
    "---",
    `# ${stem}`,
    "",
    "**Kind**:: #vocabulary",
    `**URL**:: [merriam-webster.com](https://www.merriam-webster.com/dictionary/${encodeURI(
      stem
    )})`,
    "",
    "## Definition",
  ];

  for (let index = 0; index < homographs.length; ++index) {
    const item = homographs[index];

    lines.push("");
    if (homographs.length > 1) {
      lines.push(`### ${item.fl} ^${item.meta.id.replace(":", "-")}`);
      lines.push(`\`${index + 1}/${homographs.length}\` #${item.fl}`);
    } else {
      lines.push(`### ${item.fl}`);
      lines.push(`#{item.fl}`);
    }

    if ("hwi" in item && "prs" in item.hwi) {
      for (const pr of item.hwi.prs) {
        lines.push(await formatPR(app, pr));
      }
    }

    if ("ins" in item) {
      const ins = item.ins.map((x) =>
        "il" in x ? `_${x.il}_ ${x["if"]}` : x["if"]
      );
      lines.push(ins.join("; ").replaceAll("*", ""));
    }

    for (const sseqOutter of item.def) {
      const { sseq } = sseqOutter;
      for (let seq_index = 1; seq_index <= sseq.length; ++seq_index) {
        const seq = sseq[seq_index - 1];
        if (seq.length === 1) {
          lines.push(
            `${seq_index}. ${formatSEQItem(seq[0][1], wordPrefix, 4)}`
          );
        } else {
          lines.push(`${seq_index}. `);
          for (const seqItem of seq) {
            lines.push(`    - ${formatSEQItem(seqItem[1], wordPrefix, 8)}`);
          }
        }
      }

      if ("uros" in item) {
        pushAndSquashEmptyLine(lines);
        for (const uro of item.uros) {
          let pr = "";
          if ("prs" in uro) {
            pr = " " + (await formatPR(app, uro.prs[0]));
          }
          lines.push(`- **${uro.ure.replace("*", "")}** #${uro.fl}${pr}`);
          if ("prs" in uro) {
            for (const pr of uro["prs"].slice(1)) {
              lines.push("    " + (await formatPR(app, pr)));
            }
          }
        }
      }

      if ("dros" in item) {
        pushAndSquashEmptyLine(lines);
        pushDROS(lines, item.dros, wordPrefix);
      }

      if ("et" in item) {
        pushAndSquashEmptyLine(lines);
        lines.push("#### Etymology");
        for (const et of item.et) {
          lines.push("");
          lines.push(translateTags(et[1], wordPrefix));
        }
      }
    }
  }

  if (phrases.length > 0) {
    lines.push(`## Phrases Containing ${stem}\n`);
    for (const phrase of phrases) {
      const id = phrase.meta.id;
      const name = id.split(":")[0];
      lines.push(`- [[${linkify(wordPrefix, id)}|${name}]]`);
    }
  }

  return [stem, lines];
}

async function start(params, settings) {
  const { app, quickAddApi } = params;

  const wordInput = await quickAddApi.inputPrompt("lookup");
  if (wordInput === null || wordInput.trim() === "") {
    return;
  }
  const word = wordInput.trim();
  // const word = "friend";

  let wordPath = `robot/Vocabulary/${settings[WORD_PREFIX_OPTION]}${word}.md`;
  const wordExists = await app.vault.adapter.exists(wordPath);
  if (!wordExists) {
    const [stem, lines] = await format(
      app,
      await lookup(word, settings),
      settings
    );
    wordPath = `robot/Vocabulary/${settings[WORD_PREFIX_OPTION]}${stem}.md`;
    await app.vault.create(wordPath, lines.join("\n"));
  } else {
    // Updates file content for debugging
    // const [stem, lines] = await format(
    //   app,
    //   await lookup(word, settings),
    //   settings
    // );
    // wordPath = `robot/Vocabulary/${settings[WORD_PREFIX_OPTION]}${stem}.md`;
    // await app.vault.modify(
    //   app.vault.getAbstractFileByPath(wordPath),
    //   lines.join("\n")
    // );
  }

  const wordFile = app.vault.getAbstractFileByPath(wordPath);
  await app.workspace.getLeaf().openFile(wordFile);
}
