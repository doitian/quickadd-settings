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
  const tomorrow = moment(date).add(1, "days");
  const yesterday = moment(date).subtract(1, "days");
  return [
    `# Journal on ${date.format("ddd, MMM D, YYYY")}\n`,
    "## Metadata\n",
    `**Date**:: [[${date.format("YYYY-MM-DD")}]]`,
    `**Next**:: [[Journal ${tomorrow.format("YYYY-MM-DD")}]]`,
    `**Prev**:: [[Journal ${yesterday.format("YYYY-MM-DD")}]]`,
    "**Kind**:: #journal",
    "",
    "## Journal\n",
  ].join("\n");
}

function makeDailyContent(date) {
  const yyyymmdd = date.format("YYYY-MM-DD");
  const tomorrow = moment(date).add(1, "days");
  const yesterday = moment(date).subtract(1, "days");

  return [
    `![[${date.format("gggg-[W]ww")}#^index]]\n`,
    `# ${date.format("ddd, MMM D, YYYY")}\n`,
    "**Kind**:: #periodic/daily",
    `**Week**:: [[${date.format("gggg-[W]ww")}]]`,
    `**Next**:: [[${tomorrow.format("YYYY-MM-DD")}]]`,
    `**Prev**:: [[${yesterday.format("YYYY-MM-DD")}]]`,
    "",
    `- [ ] Plan the date ${date.format("ddd, MMM D, YYYY")}`,
    `![[Journal ${date.format("YYYY-MM-DD")}#Daily Plan]]`,
    `- [ ] Review the date ${date.format("ddd, MMM D, YYYY")}`,
    `![[Journal ${date.format("YYYY-MM-DD")}#Daily Review]]\n`,
    "## Journal",
    `**Journal**:: [[Journal ${yyyymmdd}]]`,
    `![[Journal ${yyyymmdd}#Journal]]`,
    `![[Journal ${yyyymmdd}#Completed Tasks]]`,
  ].join("\n");
}

module.exports = async ({ app }) => {
  const activeFile = app.workspace.getActiveFile();
  const date = deriveDateFromFile(activeFile) ?? moment();
  const yyyymmdd = date.format("YYYY-MM-DD");
  const agedJournalPath = `journal/aged/Journal ${yyyymmdd}.md`;
  const journalPath = `journal/Journal ${yyyymmdd}.md`;

  if (
    activeFile !== undefined &&
    activeFile !== null &&
    (activeFile.path === journalPath || activeFile.path === agedJournalPath)
  ) {
    // open daily note
    const dailyPath = `periodic/${yyyymmdd}.md`;
    let dailyFile = app.vault.getAbstractFileByPath(dailyPath);
    if (!(await app.vault.adapter.exists(dailyPath))) {
      dailyFile = await app.vault.create(dailyPath, makeDailyContent(date));
    }
    await app.workspace.getLeaf().openFile(dailyFile);
    return;
  }

  if (await app.vault.adapter.exists(agedJournalPath)) {
    await app.workspace
      .getLeaf()
      .openFile(app.vault.getAbstractFileByPath(agedJournalPath));
    return;
  }

  let journalFile = app.vault.getAbstractFileByPath(journalPath);
  if (!(await app.vault.adapter.exists(journalPath))) {
    journalFile = await app.vault.create(journalPath, makeJournalContent(date));
  }
  await app.workspace.getLeaf().openFile(journalFile);
};
