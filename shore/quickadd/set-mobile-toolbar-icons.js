// Find choice in .obsidian/plugins/quickadd/data.json
const MAPPING = {
  // Find Files Here
  "quickadd:choice:39de731f-f2c7-4494-8c84-9855da33b27c": "folder-open",
  // Edit...
  "quickadd:choice:ffbdc0a7-db3f-47b0-b53e-feb0c2e9a1f7": "edit",
  // New...
  "quickadd:choice:2fc70047-bb78-4801-906e-1a62deb8daf0": "file-plus",
  // Expand Snippet
  "quickadd:choice:2feb13d4-c9ec-4826-b43f-02b33251789a": "form-input",
  // Open Journal
  "quickadd:choice:e30520a5-a0bb-466b-80a3-57b2ebb9ce55": "calendar",
};

// Do things not related to vimrc
async function setCommandIcons(app) {
  for (const [command, icon] of Object.entries(MAPPING)) {
    if (command in app.commands.commands) {
      app.commands.commands[command].icon = icon;
    }
  }
}

module.exports = async ({ app, obsidian }) => {
  if (obsidian.Platform.isMobile) {
    setCommandIcons(app);
  }
};
