const CAYW_ENDPOINT =
  "http://127.0.0.1:23119/better-bibtex/cayw?selected=1&format=translate&translator=csljson";
const HEADERS = {
  "User-Agent": "Obsidian",
  "Zotero-Allowed-Request": "true",
};
const FOLDER = "robot/Zotero Library";

module.exports = start;

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

function extractStatusTag(tags) {
  for (const tag of ["i", "x", "now", "later", "someday"]) {
    if (tags[tag]) {
      delete tags[tag];
      return tag;
    }
  }

  return "i";
}

function extractRatingTag(tags) {
  for (const tag of [
    "⭐️",
    "⭐️⭐️",
    "⭐️⭐️⭐️",
    "⭐️⭐️⭐️⭐️",
    "⭐️⭐️⭐️⭐️⭐️",
  ]) {
    if (tags[tag]) {
      delete tags[tag];
      return tag.length;
    }
  }

  return 0;
}

function formatAuthor(a) {
  if (a.literal) {
    return a.literal;
  }

  return `${a.given} ${a.family}`;
}

RENAME_KEY = {};

function formatKey(k) {
  if (RENAME_KEY[k]) {
    return RENAME_KEY[k];
  }
  return titleCase(k.replace(/-/g, " "));
}

function formatEntry(entry) {
  const authors = entry.author.map(formatAuthor);
  const authorEtal = authors.length > 1 ? `${authors[0]} et al.` : authors[0];
  const title = titleCase(entry.title);
  const aliasTitle = `${authorEtal} - ${title}`;
  const sourceUrl = `zotero://select/library/items/${entry["item-key"]}`;
  const tags = {};
  for (const k of entry.keywords) {
    tags[k] = k;
  }
  const status = extractStatusTag(tags);
  const rating = extractRatingTag(tags);
  console.log({ keys: Object.keys(tags) });
  const obsidianTags = Object.keys(tags)
    .map((k) => `#${k}`)
    .join(" ");

  const lines = [
    "---",
    "aliases:",
    `- ${JSON.stringify(aliasTitle)}`,
    `- "@${entry.id}"`,
    "---",
    `# ${aliasTitle}`,
    "",
    "## Metadata",
    "",
    `**Citation Key**:: ${entry.id}`,
    "**Source**:: #from/zotero",
    `**Kind**:: #zotero/${entry.type}`,
    `**Status**:: #${status}`,
    `**Title**:: ${title}`,
    `**Authors**:: ${authors.map((a) => `[[${a}]]`).join(", ")}`,
    `**Zotero Link**:: [Open in Zotero](${sourceUrl})`,
    `**Published**:: ${entry.issued["date-parts"][0].join("-")}`,
  ];

  if (entry.URL) {
    const host = entry.URL.split("://", 2)[1].split("/", 1)[0];
    lines.push(`**URL**:: [${host}](${entry.URL})`);
  }

  if (rating > 0) {
    lines.push(`**Rating**:: ${rating}`);
    lines.push(`**Rating Tag**:: #rating/${rating}`);
  }

  if (obsidianTags.length > 0) {
    lines.push(`**Tags**:: ${obsidianTags}`);
  }

  if (entry.publisher) {
    lines.push(`**Publisher**:: [[${entry.publisher}]]`);
  }

  if (entry.language) {
    lines.push(`**Language**:: #lang/${entry.language}`);
  }

  for (const keys of [
    "id",
    "abstract",
    "accessed",
    "author",
    "citation-key",
    "issued",
    "item-key",
    "source",
    "title",
    "title-short",
    "type",
    "URL",
    "keywords",
    "publisher",
    "language",
  ]) {
    delete entry[keys];
  }
  for (const [key, value] of Object.entries(entry)) {
    lines.push(`**${formatKey(key)}**:: ${value}`);
  }

  if (entry.abstract) {
    lines.push("");
    lines.push("## Abstract");
    lines.push("");
    lines.push(entry.abstract);
  }

  return lines.join("\n");
}

async function start() {
  const entries = await requestUrl({ url: CAYW_ENDPOINT, headers: HEADERS })
    .json;
  for (const entry of entries) {
    const content = formatEntry(entry);
    console.log(content);

    // const filePath = `${FOLDER}/${entry.id}.md`;
    // if (await app.vault.adapter.exists(filePath)) {
    //   new Notice(`🔴error: file already exists in ${filePath}`);
    // } else {
    //   await app.vault.create(filePath, content);
    //   new Notice(`🔵info: file created in ${filePath}`);
    // }
  }
}
