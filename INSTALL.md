# Install — point another project at opencodetesting

This file is meant to be handed to opencode, not read step-by-step by a human.
In your test-automation project, open `opencode` and paste this file's raw
link into the chat:

```
https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md
```

opencode will fetch it, ask you one question, and wire the project up with
two committed symlinks — no environment variables, no shell profile edits.
If you prefer to do it by hand, skip to "Manual steps" below.

## Convention: clone as siblings

This setup assumes `opencodetesting` is cloned **next to** the project that
uses it, not nested inside it:

```
development/
├── opencodetesting/       <- this repo
└── test-automation/       <- the project that references it
```

That way every symlink can be a **relative** path (`../opencodetesting/...`),
which resolves the same way for every teammate and every machine, as long as
they follow the same sibling layout. No machine-specific absolute paths get
committed to the repo.

## Instructions for the agent

If you are an opencode agent reading this because a user gave you this link,
do the following in the current project:

1. Ask the user: **"Is `opencodetesting` cloned as a sibling directory next
   to this project (e.g. `../opencodetesting`)? If not, where would you like
   it, or should I clone it there for you?"** Get it into a sibling position
   before continuing — that's what makes the rest of this portable.

2. Verify `../opencodetesting` actually looks like this repo — it should
   contain `.opencode/`, `AGENTS.md`, `docs/`, and `references/`. If it
   doesn't, say so and ask again rather than guessing.

3. Create two **relative** symlinks at the project root:

   ```bash
   ln -s ../opencodetesting/.opencode .opencode
   ln -s ../opencodetesting .opencodetesting
   ```

   `.opencode` gives opencode's normal project-local discovery (agents,
   commands, skills) the shared ones for free — no config needed for that
   part. `.opencodetesting` is a second pointer to the whole shared repo,
   used for the docs/AGENTS.md reference in the next step.

4. Update (or create) `opencode.json` in the current project:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "instructions": [".opencodetesting/AGENTS.md"],
     "permission": {
       "external_directory": {
         "<absolute-resolved-path>/AGENTS.md": "allow",
         "<absolute-resolved-path>/docs/**": "allow",
         "<absolute-resolved-path>/references/**": "allow"
       }
     }
   }
   ```

   Resolve `<absolute-resolved-path>` yourself (e.g. `realpath
   ../opencodetesting`) and substitute it — the `permission.external_directory`
   check is a safety net in case opencode resolves symlinks before applying
   permissions; harmless if it turns out not to be strictly required.

5. Commit the two symlinks and the `opencode.json` change to the project's
   repo — ask the user before committing/pushing, per normal git etiquette.
   Note for Windows users: this needs `git config core.symlinks true` and
   either Developer Mode or an elevated `git clone`, otherwise symlinks
   check out as plain text files.

6. Ask the user to restart opencode in this project, then confirm the setup
   worked — check that the shared agents (`explore`, `selenium`, `test`,
   `inspector`) and commands (`/new-test`, `/edit-test`) are now available.

7. Report back what you changed: the resolved path, the two symlinks
   created, and the `opencode.json` diff.

Nothing from `opencodetesting` is copied — the symlinks and the one
resolved path in `opencode.json` are the only things committed. A `git pull`
in the `opencodetesting` clone updates every project that points at it.

### If sibling cloning isn't possible

If the project can't sit next to `opencodetesting` on disk (e.g. it's
cloned by CI into an unpredictable path), fall back to the environment
variable instead of symlinks: set `OPENCODE_CONFIG_DIR=<path>/.opencode`
before starting opencode, and still add the `instructions` /
`permission.external_directory` block from step 4 above with an absolute
path. This isn't committed to the repo, so it needs to be set per machine
(shell profile, CI env config, or a project-local `.envrc` if the team uses
direnv).

## Manual steps

If you'd rather do this yourself without going through the agent:

1. Clone `opencodetesting` as a sibling of your project (see layout above).
2. From your project root:
   ```bash
   ln -s ../opencodetesting/.opencode .opencode
   ln -s ../opencodetesting .opencodetesting
   ```
3. Add the `instructions` and `permission.external_directory` block from
   step 4 above to your project's `opencode.json`, with the real resolved
   path substituted in.
4. Commit `.opencode`, `.opencodetesting`, and `opencode.json`.
5. Restart opencode in your project.
