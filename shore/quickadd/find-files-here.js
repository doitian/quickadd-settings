module.exports = start;

function isFolder(choice) {
  return (
    choice !== undefined && choice.file !== null && "children" in choice.file
  );
}

function fileName(file) {
  return file.ext === "md" ? file.basename : file.name;
}

function makeItem(file) {
  if (file.path === "/") {
    return { file, display: "/" };
  }

  return {
    file,
    display: "children" in file ? file.name + "/" : fileName(file),
  };
}

async function start({ app, quickAddApi }) {
  const currentFile = app.workspace.getActiveFile();
  if (!currentFile) {
    new Notice("🔴error: no active file");
    return;
  }

  let selected = makeItem(currentFile.parent);

  while (isFolder(selected)) {
    const candidates = [
      {
        display: `🏠 ${selected.file.path}`,
        file: null,
      },
    ].concat(
      [...selected.file.children]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(makeItem)
    );
    if (selected.file.path !== "/") {
      candidates.push({
        display: "../",
        file: selected.file.parent,
      });
    }
    selected = await quickAddApi.suggester((item) => item.display, candidates);
  }

  if (selected !== undefined && selected.file !== null) {
    await app.workspace.getLeaf().openFile(selected.file);
  }
}
