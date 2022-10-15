const TODOIST_TOKEN_OPTION = "Todoist Token";
const FILTERS = ["today", "tomorrow"];

module.exports = {
  entry: start,
  settings: {
    name: "QuickAdd Scripts",
    author: "Ian",
    options: {
      [TODOIST_TOKEN_OPTION]: {
        type: "text",
        defaultValue: "",
        placeholder: "TOKEN",
      },
    },
  },
};

function taskCompareFn(a, b) {
  const dueA = a.due.datetime || `${a.due.date}Z`;
  const dueB = b.due.datetime || `${b.due.date}Z`;
  return dueA === dueB ? b.priority - a.priority : dueA < dueB ? -1 : 1;
}

function scheduled(task) {
  const due = window.moment(task["due"]["datetime"]).local();
  return due.format(" HH:mm");
}

function formatLabels(task, labels) {
  labels = task["label_ids"].map((id) => labels[id]).join(" #");
  return labels.length > 0 ? " #" + labels : "";
}

async function fetchLabels(settings) {
  const resp = await requestUrl({
    url: "https://api.todoist.com/rest/v1/labels",
    headers: { Authorization: `Bearer ${settings[TODOIST_TOKEN_OPTION]}` },
  });

  const labels = {};
  for (let label of await resp.json) {
    labels[label.id] = label.name;
  }

  return labels;
}

async function start(params, settings) {
  const { app, quickAddApi } = params;

  const leaf = this.app.workspace.activeLeaf;
  if (!leaf || !leaf.view || !leaf.view.editor) {
    new Notice("🔴error: no active editor");
    return;
  }
  const editor = leaf.view.editor;

  const filter = await quickAddApi.suggester(FILTERS, FILTERS);

  const requestParams = new URLSearchParams({ filter: filter });
  const resp = await requestUrl({
    url: `https://api.todoist.com/rest/v1/tasks?${requestParams}`,
    headers: { Authorization: `Bearer ${settings[TODOIST_TOKEN_OPTION]}` },
  });
  const tasks = resp.json.sort(taskCompareFn);
  const labels = await fetchLabels(settings);

  const lines = ["\n## Daily Plan\n"];
  for (let task of tasks) {
    const id = task.url.split("id=")[1];
    const priority = 5 - task.priority;
    if ("datetime" in task.due) {
      if (task.content.startsWith("* ┈")) {
        lines.push(`\n${task.content.substr(2)}\n`);
      } else {
        lines.push(
          `- [ ]${scheduled(task)} #p${priority} ${task.content}${formatLabels(
            task,
            labels
          )} [«↪»](${task.url}) ^todoist-${id}`
        );
      }
    } else {
      lines.push(
        `- [ ] #p${priority} ${task.content}${formatLabels(
          task,
          labels
        )} [«↪»](${task.url}) ^todoist-${id}`
      );
    }

    if (task.description !== "") {
      lines.push("");
      lines.push("    " + task.description.replace(/\r*\n/, "$&    "));
      lines.push("");
    }
  }

  editor.replaceRange(lines.join("\n"), editor.getCursor());
}
