# Install — point another project at opencodetesting

This file is meant to be handed to opencode, not read step-by-step by a human.
In your test-automation project, open `opencode` and paste this file's raw
link into the chat:

```
https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md
```

opencode will fetch it, ask you one question, and wire the project up. If you
prefer to do it by hand, skip to "Manual steps" below.

## Instructions for the agent

If you are an opencode agent reading this because a user gave you this link,
do the following in the current project:

1. Ask the user: **"Where is `opencodetesting` cloned on this machine?
   (absolute path, e.g. `/home/sam/development/opencodetesting`)"**
   If they don't have a clone yet, offer to `git clone` the repo to a path
   they choose instead.

2. Verify the path they gave you actually looks like this repo — it should
   contain `.opencode/`, `AGENTS.md`, `docs/`, and `references/`. If it
   doesn't, say so and ask again rather than guessing.

3. Update (or create) `opencode.json` in the current project:
   - Add `permission.external_directory` entries allowing read access to
     `<path>/AGENTS.md`, `<path>/docs/**`, and `<path>/references/**`.
   - Add `<path>/AGENTS.md` to the `instructions` array, so its contents are
     combined with this project's own `AGENTS.md` automatically. (If this
     opencode version doesn't support absolute paths there, add a line to
     the project's own `AGENTS.md` instead, telling future agents to read
     `<path>/AGENTS.md` for shared conventions.)

   Resulting shape:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "instructions": ["<path>/AGENTS.md"],
     "permission": {
       "external_directory": {
         "<path>/AGENTS.md": "allow",
         "<path>/docs/**": "allow",
         "<path>/references/**": "allow"
       }
     }
   }
   ```

4. Tell the user to make the shared agents/commands/skills available by
   setting one environment variable before starting opencode in this
   project:

   ```bash
   export OPENCODE_CONFIG_DIR="<path>/.opencode"
   ```

   Suggest adding that line to their shell profile (`~/.bashrc`/`~/.zshrc`)
   if they want it for every session, or to a project-local `.envrc` if they
   use direnv. Do not edit their shell profile yourself without asking.

5. Ask the user to restart opencode in this project, then confirm the setup
   worked — e.g. check that the shared agents (`explore`, `selenium`,
   `test`, `inspector`) and commands (`/new-test`, `/edit-test`) are now
   available.

6. Report back what you changed: the path you were given, the files you
   edited, and the export line you asked the user to add.

Nothing from `opencodetesting` is copied into this project — only the
absolute path is stored, in this project's own `opencode.json`. Updating
`opencodetesting` (a `git pull` in that clone) updates every project that
points at it.

## Manual steps

If you'd rather do this yourself without going through the agent:

1. Clone `opencodetesting` somewhere, e.g. `~/development/opencodetesting`.
2. In your project's `opencode.json`, add the `instructions` and
   `permission.external_directory` block shown in step 3 above, with the
   real path substituted in.
3. Export `OPENCODE_CONFIG_DIR=<path>/.opencode` (shell profile or
   project-local `.envrc`).
4. Restart opencode in your project.
