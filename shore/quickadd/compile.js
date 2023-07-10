module.exports = start;

FRONTMATTERS_RE = /^---\n.*?\n---\n/gs;
COMMENT_BLOCK_RE = /\n?%%.*?%%/gs;
ASSET_EMBED_RE = /!\[\[(.*?\.(?:svg))(?:\|(.*?))?\]\]/g;
CONTENTS_EMBED_RE = /!\[\[(.*?)(?:\|(.*?))?\]\]/g;
METADATA_RE = /\n#+ Metadata\n.*?\n\n/gs;
H1_RE = /^# (?:♯ )?(.*?)$(\n\n)?/gm;
NO_PANDOC_RE = /\n%%no-pandoc%%.*?(?:\n\n|$)/gs;
ONLY_PANDOC_RE = /```pandoc\n(.*?)\n```/gs;
SCENES_MARKER_RE = /<!--scenes-->\n/;

CROSS_REF_RE = /(?:\[\[[^#\]]*#\^(?:lst|fig|sec|eq|tbl)-([-a-zA-Z0-9]+)\]\])+/g;

LST_LABEL_RE =
  /(?<indent>[ \t]*)```([^\n]*)\n(.*?)\n\k<indent>```\n\k<indent>\^lst-([-a-zA-Z0-9]+)/gs;
FIG_LABEL_RE = /\^fig-([-a-zA-Z0-9]+)$/gm;
SEC_LABEL_RE = /\s*\^sec-([-a-zA-Z0-9]+)$/gm;
EQ_LABEL_RE = /\s*\^eq-([-a-zA-Z0-9]+)$/gm;
TBL_LABEL_RE = /^\^tbl-([-a-zA-Z0-9]+)\s+Table: (.+)/gm;

async function replaceAsync(str, pattern, replacerFunction) {
  const replacements = await Promise.all(
    Array.from(str.matchAll(pattern), (match) => replacerFunction(...match))
  );
  let i = 0;
  return str.replace(pattern, () => replacements[i++]);
}

function mimeType(path) {
  if (path.name.endsWith(".svg")) {
    return "image/svg+xml";
  } else if (path.name.endsWith(".png")) {
    return "image/png";
  } else if (path.name.endsWith(".jpg") || path.name.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

async function assetLink({ app }, asset) {
  await app.vault.copy(asset, `tmp/_${asset.name}`);
  return encodeURI('_' + asset.name);
}

async function load(context, file, settings) {
  const app = context.app;
  let contents = await app.vault.read(file);
  const isRoot = settings === null || settings === undefined;
  if (isRoot) {
    settings = app.metadataCache.getFileCache(file)?.frontmatter?.scenes ?? {};
  }

  if (isRoot) {
    contents = contents.replace(H1_RE, "# $1$2");
    contents = contents.replace(SCENES_MARKER_RE, "");
  } else {
    contents = contents.replace(FRONTMATTERS_RE, "");
  }

  contents = contents.replace(METADATA_RE, "\n");
  contents = contents.replace(NO_PANDOC_RE, "");
  contents = contents.replace(ONLY_PANDOC_RE, "$1");
  contents = contents.replace(COMMENT_BLOCK_RE, "").trimStart();

  contents = contents.replace(LST_LABEL_RE, (_, indent, lang, content, id) => {
    if (lang !== "") {
      lang = " ." + lang;
    }
    return `${indent}\`\`\`{#lst:${id}${lang}}\n${content}\n${indent}\`\`\``;
  });
  contents = contents.replace(FIG_LABEL_RE, "{#fig:$1}");
  contents = contents.replace(EQ_LABEL_RE, " {#eq:$1}");
  contents = contents.replace(TBL_LABEL_RE, "\nTable: $2 {#tbl:$1}");

  contents = contents.replace(CROSS_REF_RE, (match) => {
    const ids = match
      .substring(2, match.length - 2)
      .split("]][[")
      .map((text) => text.split("#^")[1].replace(/-/, ":"));
    return `[@${ids.join("; @")}]`;
  });

  contents = await replaceAsync(contents, ASSET_EMBED_RE, async (_, p1, p2) => {
    const assetPath = app.metadataCache.getFirstLinkpathDest(p1, file.path);
    if (assetPath === null) {
      new Notice("🔴error: asset not found: " + p1);
      throw new Error("Asset not found: " + p1);
    }

    const description = p2 ?? "";
    const link = await assetLink(context, assetPath);
    return `![${description}](${link})`;
  });

  contents = await replaceAsync(contents, CONTENTS_EMBED_RE, async (_, p1) => {
    const mdPath = app.metadataCache.getFirstLinkpathDest(p1, file.path);
    if (mdPath === null) {
      new Notice("🔴error: markdown file not found: " + p1);
      throw new Error("Markdown file not found: " + p1);
    }
    return await load(context, mdPath, settings);
  });

  if (isRoot) {
    contents = contents.replace(SEC_LABEL_RE, " {#sec:$1}");
  }

  return contents;
}

async function start({ app, obsidian }) {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  const context = { app, obsidian };
  const contents = await load(context, currentFile);
  const manuscriptPath = "tmp/manuscript.md";
  const manuscript = app.vault.getAbstractFileByPath(manuscriptPath);
  if (manuscript === null) {
    await app.vault.create(manuscriptPath, contents);
  } else {
    await app.vault.modify(manuscript, contents);
  }
  new Notice(`🔵info: saved to ${manuscriptPath}`);
}
