function deriveDateFromFile(file) {
  if (file === undefined || file === null) {
    return;
  }
  const match = file.basename.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (match) {
    return moment(match[0], "YYYY-MM-DD");
  }
}

function makeJournalContent(date) {
  return [
    `# Journal on ${date.format("ddd, MMM D, YYYY")}\n`,
    "## Metadata\n",
    `**Date**:: [[${date.format("YYYY-MM-DD")}]]`,
    "**Kind**:: #journal",
    "",
    "## Journal\n",
  ].join("\n");
}

function makeDailyContent(date) {
  const yyyymmdd = date.format("YYYY-MM-DD");

  return [
    `![[${date.format("gggg-[W]ww")}#^index]]\n`,
    `# ${date.format("ddd, MMM D, YYYY")}\n`,
    '**Kind**:: #periodic/daily',
    `**Week**:: [[${date.format("gggg-[W]ww")}]]\n`,
    `- [ ] Plan the date ${date.format("ddd, MMM D, YYYY")}`,
    `    ![[Journal ${yyyymmdd}#Daily Plan]]\n`,
    `- [ ] Review the date ${date.format("ddd, MMM D, YYYY")}`,
    `    ![[Journal ${yyyymmdd}#Daily Review]]\n`,
    '## Journal',
    `**Journal**:: [[Journal ${yyyymmdd}]]`,
    `![[Journal ${yyyymmdd}#Journal]]`,
    `![[Journal ${yyyymmdd}#Completed Tasks]]`
  ].join("\n");
}

module.exports = async ({ app }) => {
  const activeFile = app.workspace.getActiveFile();
  const date = deriveDateFromFile(activeFile) ?? moment();
  const yyyymmdd = date.format("YYYY-MM-DD");
  const journalPath = `journal/Journal ${yyyymmdd}.md`;

  if (activeFile !== undefined && activeFile !== null && activeFile.path === journalPath) {
    // open daily note
    const dailyPath = `periodic/${yyyymmdd}.md`;
    let dailyFile = app.vault.getAbstractFileByPath(dailyPath);
    if (!(await app.vault.adapter.exists(dailyPath))) {
      dailyFile = await app.vault.create(dailyPath, makeDailyContent(date));
    }
    await app.workspace.getLeaf().openFile(dailyFile);
    return;
  }

  let journalFile = app.vault.getAbstractFileByPath(journalPath);
  if (!(await app.vault.adapter.exists(journalPath))) {
    journalFile = await app.vault.create(journalPath, makeJournalContent(date));
  }
  await app.workspace.getLeaf().openFile(journalFile);
};
