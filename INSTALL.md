# Install — point another project at opencodetesting

This file is meant to be handed to opencode, not read step-by-step by a human.
In your test-automation project, open `opencode` and paste this file's raw
link into the chat:

```
https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md
```

opencode will fetch it, ask you a couple of questions, and wire the project
up. If you prefer to do it by hand, skip to "Manual steps" below.

## Instructions for the agent

If you are an opencode agent reading this because a user gave you this link,
do the following in the current project.

### 1. Ask how they want it wired up

Ask the user to choose, and default to the first option if they have no
preference:

- **Personal / gitignored (recommended)** — the symlinks and the
  machine-specific config live only on this developer's machine. Nothing
  path-specific is ever committed, so it works no matter where or how each
  teammate has `opencodetesting` cloned — no shared layout convention
  required. Every teammate runs this same flow once, pointing at wherever
  their own clone happens to be.
- **Committed / shared** — the symlinks are committed to the repo as
  relative paths, on the assumption that *everyone* clones
  `opencodetesting` as a sibling of this project in the same layout. Less
  setup per teammate, but breaks for anyone whose layout differs.

The rest of this section covers both; skip to whichever the user picked.

### 2. Find (or clone) opencodetesting

Ask: **"Where is `opencodetesting` cloned on this machine?"** (absolute
path). Offer to `git clone` it to a path of their choice if they don't have
it yet — a sibling directory next to this project is a reasonable default
suggestion, but not required for the personal/gitignored option.

Verify the path actually looks like this repo — it should contain
`.opencode/`, `AGENTS.md`, `docs/`, and `references/`. If it doesn't, say so
and ask again rather than guessing.

### 3. Create the symlinks

```bash
ln -s <path>/.opencode .opencode
ln -s <path> .opencodetesting
```

Use a relative `<path>` (e.g. `../opencodetesting`) if it's a sibling
directory, or the absolute path otherwise — either works, since these
symlinks are read from disk, not compared against anything else.

### 4. Install Playwright's browser (project-local)

Do this now, right after the `.opencode` symlink exists — don't leave it for later.
`playwright-explore.ts` (the custom tool the shared agents use to drive the browser)
needs a real Chromium install, and it must be genuinely project-local: not shared
with the `opencodetesting` clone (`.opencode/node_modules` physically lives there,
not in this project) and not `~/.cache`.

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"
cd .opencode && npx playwright install chromium
```

Tell the user `PLAYWRIGHT_BROWSERS_PATH` must stay set to this exact value every
time they run `opencode` in this project afterward — not just for this one
install command, since the tool reads it again at runtime. Add it to their shell
profile, or a project-local `.envrc` if they use direnv (same either-mode note as
`OPENCODE_CONFIG_DIR` below). Ask which they'd prefer if it isn't already obvious.

### 5. Wire up `AGENTS.md` / docs / references

This step depends on what the user picked in step 1:

- **Personal / gitignored:** add the `instructions` entry and
  `permission.external_directory` allow-rules to the user's own **global**
  config at `~/.config/opencode/opencode.json` (create it if it doesn't
  exist) — not the project's `opencode.json`. opencode merges global and
  project config automatically, so this never touches a file the repo
  tracks:

  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "instructions": ["<absolute-path>/AGENTS.md"],
    "permission": {
      "external_directory": {
        "<absolute-path>/AGENTS.md": "allow",
        "<absolute-path>/docs/**": "allow",
        "<absolute-path>/references/**": "allow"
      }
    }
  }
  ```

  Then add `.opencode` and `.opencodetesting` to the project's
  `.gitignore` (create it if missing) so the symlinks never get committed
  by accident. This is the one change that touches the shared repo in this
  mode — confirm with the user before committing it.

- **Committed / shared:** add the same `instructions` /
  `permission.external_directory` block to the **project's own**
  `opencode.json` instead, with the resolved absolute path substituted in,
  and commit it along with the two symlinks. Confirm with the user before
  committing/pushing.

### 6. Verify

Ask the user to restart opencode in this project, then confirm the shared
agents (`explore`, `selenium`, `test`, `inspector`) are now available.

### 7. Report back

Summarize what changed: the path used, the two symlinks, where Playwright's
browser was installed and how `PLAYWRIGHT_BROWSERS_PATH` got persisted, which
config file got the `instructions`/`permission` block (global vs. project), and
whether anything was committed.

Nothing from `opencodetesting` is copied — only symlinks and (in the
committed mode) one resolved path in `opencode.json`. A `git pull` in the
`opencodetesting` clone updates every project that points at it.

### Windows note

Symlinks need `git config core.symlinks true` and either Developer Mode or
an elevated `git clone` — otherwise they check out as plain text files. This
only matters for the committed mode; personal/gitignored symlinks are never
checked out by git in the first place, so this doesn't apply to them.

### If OPENCODE_CONFIG_DIR is preferred instead

Some setups (e.g. CI, or developers who'd rather not use symlinks at all)
can skip symlinks entirely: set `OPENCODE_CONFIG_DIR=<path>/.opencode`
before starting opencode, and still add the `instructions` /
`permission.external_directory` block from step 5, and still do step 4's
Playwright browser install (global config if it shouldn't be shared, project
config if it should). None of this is committed either way, so it needs to be
set per machine (shell profile, CI env config, or a project-local `.envrc` if
the team uses direnv).

## Manual steps

If you'd rather do this yourself without going through the agent, personal/
gitignored version:

1. Clone `opencodetesting` wherever you like.
2. From your project root:
   ```bash
   ln -s <path>/.opencode .opencode
   ln -s <path> .opencodetesting
   ```
3. Add `.opencode` and `.opencodetesting` to the project's `.gitignore`.
4. Install Playwright's browser, project-local (see step 4 above):
   ```bash
   export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"
   cd .opencode && npx playwright install chromium
   ```
   Add that same `export` line to your shell profile (or a project-local
   `.envrc`) so it's set every time you run `opencode` here, not just now.
5. Add the `instructions` / `permission.external_directory` block from
   step 5 above to `~/.config/opencode/opencode.json`, with the real
   absolute path substituted in.
6. Restart opencode in your project.
