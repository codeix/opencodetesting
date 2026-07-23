# Install — point another project at opencodetesting

This file is meant to be handed to opencode, not read step-by-step by a human.
In your test-automation project, open `opencode` and paste this file's raw
link into the chat:

```
https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md
```

opencode will fetch it, ask one question, and wire the project up. If you
prefer to do it by hand, skip to "Manual steps" below.

## Instructions for the agent

If you are an opencode agent reading this because a user gave you this link,
do the following in the current project, in order — don't stop partway.

### 1. Ask where opencodetesting is cloned

**Required — do not guess or skip this.** Ask the user directly: **"Where is
`opencodetesting` cloned on this machine?"** (absolute path). Offer to `git
clone` it to a path of their choice if they don't have it yet — a sibling
directory next to this project is a reasonable default suggestion.

Verify the path actually looks like this repo — it should contain
`.opencode/`, `AGENTS.md`, `docs/`, and `references/`. If it doesn't, say so
and ask again rather than guessing.

### 2. Create the symlinks

```bash
ln -s <path>/.opencode .opencode
ln -s <path> .opencodetesting
```

Use a relative `<path>` (e.g. `../opencodetesting`) if it's a sibling
directory, or the absolute path otherwise. Add both to the project's
`.gitignore` (create it if missing) — these are machine-specific and must
never be committed.

Check it worked before moving on: `ls -la .opencode .opencodetesting` should
show both as symlinks resolving to real directories. If either is broken
(wrong path, typo), remove and recreate it rather than leaving it and moving on.

### 3. Install Playwright's browser (project-local)

`playwright-explore.ts` (the custom tool the shared agents use to drive the
browser) needs a real Chromium install, kept project-local — not shared with
the `opencodetesting` clone and not `~/.cache`:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"
cd .opencode && npx playwright install chromium
```

Tell the user to add that `export` line to their shell profile (or a
project-local `.envrc`) so it's set every time they run `opencode` here — not
just for this one install, since the tool reads it again at runtime.

Check it worked: `ai/.install/playwright` shouldn't be empty afterward. If it
is, the install failed silently — re-run it.

### 4. Verify and report back

Restart opencode in this project, then confirm the shared agents (`explore`,
`selenium`, `test`, `inspector`) are available. Report back: the path used,
the two symlinks, and where Playwright's browser was installed.

Nothing from `opencodetesting` is copied — only the two symlinks. A `git pull`
in the `opencodetesting` clone updates every project that points at it.

### Windows note

Symlinks need `git config core.symlinks true` and either Developer Mode or
an elevated `git clone` — otherwise they check out as plain text files.

### If OPENCODE_CONFIG_DIR is preferred instead

Some setups (e.g. CI) can skip the `.opencode` symlink: set
`OPENCODE_CONFIG_DIR=<path>/.opencode` before starting opencode instead of
step 2's first symlink. Still do step 3's Playwright install. This needs to
be set per machine/CI env, same as `PLAYWRIGHT_BROWSERS_PATH`.

## Manual steps

If you'd rather do this yourself without going through the agent:

1. Clone `opencodetesting` wherever you like.
2. From your project root:
   ```bash
   ln -s <path>/.opencode .opencode
   ln -s <path> .opencodetesting
   ```
   Check it worked: `ls -la .opencode .opencodetesting`.
3. Add `.opencode` and `.opencodetesting` to the project's `.gitignore`.
4. Install Playwright's browser, project-local:
   ```bash
   export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"
   cd .opencode && npx playwright install chromium
   ```
   Add that same `export` line to your shell profile (or a project-local
   `.envrc`) so it's set every time you run `opencode` here, not just now.
5. Restart opencode in your project and confirm the shared agents (`explore`,
   `selenium`, `test`, `inspector`) are available.
