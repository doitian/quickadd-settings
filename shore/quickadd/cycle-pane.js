const CYCLE_PANEL_PREV = "Cycle Panel Prev";

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [CYCLE_PANEL_PREV]: {
        type: "toggle",
        defaultValue: false,
      },
    },
  },
};

function getLeaves(app, types) {
  const leaves = [];

  app.workspace.iterateAllLeaves((leaf) => {
    const isMainWindow = leaf.view.containerEl.win == window;
    // const correctViewType = types.contains(leaf.view.getViewType());
    const sameWindow = leaf.view.containerEl.win == activeWindow;

    const correctPane = isMainWindow
      ? sameWindow && leaf.getRoot() == app.workspace.rootSplit
      : sameWindow;

    if (correctPane) {
      leaves.push(leaf);
    }
  });

  return leaves;
}

async function start({ app }, settings) {
  const cyclePrev = settings[CYCLE_PANEL_PREV];

  const active = app.workspace.activeLeaf;
  if (!active) {
    return;
  }

  const leaves = getLeaves(app, ["markdown"]);
  const index = leaves.indexOf(active);
  const newIndex = cyclePrev
    ? (index - 1 + leaves.length) % leaves.length
    : (index + 1) % leaves.length;

  const leaf = leaves[newIndex];
  app.workspace.setActiveLeaf(leaf, true, true);
  leaf.view?.editor?.focus?.();
}
