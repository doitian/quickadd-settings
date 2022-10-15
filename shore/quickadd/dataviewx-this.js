const DATAVIEW_RE =
  /^%%\+BEGIN: #dataviewx%%[\r\n]+```dataviewx[\r\n]+(.*?)[\r\n]+```[\r\n]+.*?%%\+END%%$/gms;

function replaceAsync(string, searchValue, replacer) {
  try {
    let values = [];
    string.replace(searchValue, function () {
      values.push(replacer.apply(undefined, arguments));
      return "";
    });
    return Promise.all(values).then(function (resolved) {
      return string.replace(searchValue, function () {
        return resolved.shift();
      });
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

async function queryMarkdown(api, query, file) {
  const result = await api.queryMarkdown(query, file);
  if (result.successful) {
    return result.value;
  }
  return result.error;
}

module.exports = async (params) => {
  const {
    app: { workspace, vault },
  } = params;
  const api = app.plugins.plugins["dataview"].api;

  const currentFile = workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  const content = await vault.read(currentFile);
  const exported = await replaceAsync(
    content,
    DATAVIEW_RE,
    async (match, p1) =>
      `%%+BEGIN: #dataviewx%%\n\`\`\`dataviewx\n${p1}\n\`\`\`\n\n${await queryMarkdown(
        api,
        p1,
        currentFile.path
      )}%%+END%%`
  );

  await vault.modify(currentFile, exported);
  new Notice(`🔵info: dataview exported in ${currentFile.name}`);
};
