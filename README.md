#!/usr/bin/env bash
: <<':'
# Obsidian QuickAdd Plugin Settings

[QuickAdd](https://github.com/chhoumann/quickadd) is a plugin for [Obsidian](https://obsidian.md/).

> Quickly add new pages or content to your vault.

This is how QuickAdd describes itself. Indeed, it is also a framework to extend Obsidian with custom commands via macros and JavaScript.

## Settings Structure

- `.obsidian/plugins/quickadd/data.json`: The plugin settings file.
- `shore/quickadd/*.js`: The JavaScript files for the macros.

## Features

- `openai.js`: Choose prompts from a library ([example](https://kb.iany.me/para/lets/c/ChatGPT+Sessions/ChatGPT+Prompts)) and call ChatGPT API.
- `open-all-links.js`: Open all links in selection in new tabs.
- `cycle-pane.js`: Add new commands to cycle between panes, like [phibr0/cycle-through-panes](https://github.com/phibr0/cycle-through-panes).
- `dataviewx-all.js`: Run `dataviewx-this.js` on all files in the vault.
- `dataviewx-this.js`: Export DataView result into markdown in place.
- `edit-alternative-file.js`: Toggle between last two opened files.
- `edit-uri-component.js`: Edit the decoded form in the pop-out window.
- `expand-snippet.js`: Quickly expand snippets.
- `find-files-here.js`: Find files in the same folder of the active file.
- `go-fold.js`: Navigate between headers and lists.
- `insert-todoist-tasks.js`: Fetch Todoist tasks and insert into the active file.
- `insert-wikipedia-page.js`: Save the WikiPedia page and insert a link to the page in the active file.
- `markdownify.js`: Convert an HTML file in the vault to Markdown, or download the URL and save the page as Markdown.
- `new-paralet.js`: Create a new topic in the folder para.
- `open-journal.js`: Open daily journal file.
- `open-recent-updated-files.js`: List recent updated files.
- `run-js-block.js`: Execute a JavaScript code block under cursor.
- `set-mobile-toolbar-icons.js`: Set icons for custom commands.
- `vimrc.js`: Extend the Vim mode by adding ex commands and key mappings.
- `lookup.js`: Generate word definition via [Dictionary API](https://dictionaryapi.com/).

```bash
:

rsync -avz --delete "$HOME/Dropbox/Brain/shore/quickadd/" "./shore/quickadd/"
sed -E '/"(Todoist Token|Dictionary API Key|Word Prefix|OpenAI (Token|Model|Prompts|Endpoint)( Alt)?)":/d' "$HOME/Dropbox/Brain/.obsidian/plugins/quickadd/data.json" > "./.obsidian/plugins/quickadd/data.json"

# vim: ft=markdown
