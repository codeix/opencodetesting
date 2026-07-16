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

**This is a complete, ordered checklist — steps 1 through 7, including the final
verification.** Do not stop partway and do not skip a step. Every question marked
**required** blocks the steps after it: you cannot guess or default your way past
it — actually ask and wait for an answer. Do not report step 7 until every check
in step 6 passes; if one fails, fix it and re-check before reporting anything.

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

**Required — do not proceed without this.** Step 3 cannot happen without it, so
this is not optional and not something to infer or default. Ask the user
directly: **"Where is `opencodetesting` cloned on this machine?"** (absolute
path). Offer to `git clone` it to a path of their choice if they don't have
it yet — a sibling directory next to this project is a reasonable default
suggestion, but not required for the personal/gitignored option. Do not
continue to step 3 until you have an actual path, confirmed by the check below.

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

**Check the result immediately, before moving on** — don't assume the commands
succeeded:

```bash
ls -la .opencode .opencodetesting
test -d .opencode/agents && test -d .opencode/skills && test -d .opencode/tools
test -f .opencodetesting/AGENTS.md && test -d .opencodetesting/docs && test -d .opencodetesting/references
```

If either symlink is missing, points at the wrong path, or these checks fail
(e.g. `<path>` was wrong, or relative vs. absolute got confused), remove and
recreate it — do not leave a broken symlink and move on, and do not just tell
the user to fix it themselves.

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

Check it actually landed before moving on: `test -d ai/.install/playwright && find
ai/.install/playwright -maxdepth 2 -type d` should show at least one
`chromium-*` (or similar) directory. If it's empty, the install failed silently —
re-run it and check again rather than proceeding.

Tell the user `PLAYWRIGHT_BROWSERS_PATH` must stay set to this exact value every
time they run `opencode` in this project afterward — not just for this one
install command, since the tool reads it again at runtime. Add it to their shell
profile, or a project-local `.envrc` if they use direnv (same either-mode note as
`OPENCODE_CONFIG` below). Ask which they'd prefer if it isn't already obvious.

### 5. Wire up `AGENTS.md` / docs / references

**Never edit `~/.config/opencode/opencode.json` (or any other file outside this
project) for this.** That file is global — shared across every other project this
developer uses opencode on — and silently changing it as a side effect of wiring
up one testproject is exactly the kind of cross-project, hard-to-notice change to
avoid. Everything below stays inside this project's own directory.

This step depends on what the user picked in step 1:

- **Personal / gitignored:** write the `instructions` entry and
  `permission.external_directory` allow-rules to a new,
  **project-local, gitignored** file — `ai/.install/opencode.json` (already
  covered by `ai/.gitignore`'s existing `.install/` rule, so nothing new to add
  there):

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

  Then tell the user to set `OPENCODE_CONFIG="$PWD/ai/.install/opencode.json"`
  (opencode's documented custom-config env var, merged in alongside the global
  and project config) in their shell profile or a project-local `.envrc` — the
  same place as `PLAYWRIGHT_BROWSERS_PATH` from step 4 — so it's set every time
  they run `opencode` here. Also add `.opencode` and `.opencodetesting` to the
  project's own `.gitignore` (create it if missing) so the symlinks never get
  committed by accident. Confirm with the user before committing that
  `.gitignore` change — it's the one change that touches the shared repo in
  this mode.

- **Committed / shared:** add the same `instructions` /
  `permission.external_directory` block to the **project's own**
  `opencode.json` instead, with the resolved absolute path substituted in,
  and commit it along with the two symlinks. Confirm with the user before
  committing/pushing.

### 6. Verify (and repair anything broken)

Run every check below yourself — don't just ask the user to restart and eyeball
it. If any check fails, fix the underlying step and re-run the check; don't
report step 7 until all of them pass:

- [ ] `ls -la .opencode .opencodetesting` shows both as symlinks (not plain
      files — see the Windows note below) pointing at the path from step 2.
- [ ] `test -d .opencode/agents && test -d .opencode/skills && test -d .opencode/tools`
      succeeds.
- [ ] `test -f .opencodetesting/AGENTS.md && test -d .opencodetesting/docs && test -d .opencodetesting/references`
      succeeds.
- [ ] `ai/.install/playwright` contains an installed browser (non-empty, per
      step 4's check).
- [ ] The config file from step 5 — `ai/.install/opencode.json` (personal) or
      the project's `opencode.json` (committed) — actually contains the
      `instructions`/`permission.external_directory` block you just wrote; read
      it back to confirm, don't assume the write succeeded.
- [ ] Personal mode only: `.gitignore` actually lists `.opencode` and
      `.opencodetesting`.
- [ ] Ask the user to restart opencode in this project, then confirm the shared
      agents (`explore`, `selenium`, `test`, `inspector`) are now available —
      this is the one check that needs the user, since it confirms opencode
      itself picked up the config.

### 7. Report back

Summarize what changed: the path used, the two symlinks, where Playwright's
browser was installed and how `PLAYWRIGHT_BROWSERS_PATH` got persisted, which
config file got the `instructions`/`permission` block (`ai/.install/opencode.json`
+ `OPENCODE_CONFIG` for personal mode, or the project's own `opencode.json` for
committed mode) and how `OPENCODE_CONFIG` got persisted if personal, whether
anything was committed, and the result of every check in step 6.

Nothing from `opencodetesting` is copied — only symlinks and (in the
committed mode) one resolved path in `opencode.json`. A `git pull` in the
`opencodetesting` clone updates every project that points at it.

### Windows note

Symlinks need `git config core.symlinks true` and either Developer Mode or
an elevated `git clone` — otherwise they check out as plain text files. This
only matters for the committed mode; personal/gitignored symlinks are never
checked out by git in the first place, so this doesn't apply to them.

### If OPENCODE_CONFIG_DIR is preferred instead

Some setups (e.g. CI, or developers who'd rather not use symlinks at all) can
skip symlinks entirely: set `OPENCODE_CONFIG_DIR=<path>/.opencode` before
starting opencode instead of creating the `.opencode` symlink in step 3 (this
is a different env var from `OPENCODE_CONFIG` in step 5 — `_DIR` points at a
directory of agents/skills/commands, `OPENCODE_CONFIG` points at one JSON
config file). Still do step 4's Playwright install and step 5's config-file
step (personal mode's `ai/.install/opencode.json` + `OPENCODE_CONFIG`, or
committed mode's project `opencode.json`) — neither depends on how `.opencode`
itself got wired up. None of this is committed either way, so it needs to be
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
   Check it worked: `ls -la .opencode .opencodetesting` and confirm
   `.opencode/agents`/`skills`/`tools` and `.opencodetesting/AGENTS.md` exist.
3. Add `.opencode` and `.opencodetesting` to the project's `.gitignore`.
4. Install Playwright's browser, project-local (see step 4 above):
   ```bash
   export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"
   cd .opencode && npx playwright install chromium
   ```
   Add that same `export` line to your shell profile (or a project-local
   `.envrc`) so it's set every time you run `opencode` here, not just now.
   Confirm `ai/.install/playwright` isn't empty afterward.
5. Write the `instructions` / `permission.external_directory` block from
   step 5 above to `ai/.install/opencode.json` (a project-local file, already
   gitignored — **never** `~/.config/opencode/opencode.json`, which is global
   and shared across your other projects), with the real absolute path
   substituted in. Then add `export OPENCODE_CONFIG="$PWD/ai/.install/opencode.json"`
   to your shell profile (or `.envrc`), same as step 4.
6. Restart opencode in your project and confirm the shared agents (`explore`,
   `selenium`, `test`, `inspector`) are available.
