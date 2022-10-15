OPTION_EDIT_ALTERNATIVE_NEXT_COMMAND = "editAlternativeNextCommand";
COMMAND_GO_BACK = "app:go-back";
COMMAND_GO_FORWARD = "app:go-forward";

module.exports = async function ({ app }) {
  const nextCommandName =
    window[OPTION_EDIT_ALTERNATIVE_NEXT_COMMAND] === COMMAND_GO_FORWARD
      ? COMMAND_GO_FORWARD
      : COMMAND_GO_BACK;

  window[OPTION_EDIT_ALTERNATIVE_NEXT_COMMAND] =
    nextCommandName === COMMAND_GO_FORWARD
      ? COMMAND_GO_BACK
      : COMMAND_GO_FORWARD;

  app.commands.executeCommandById(nextCommandName);
};
