# Manual — AI-Powered Selenium Test Generator

How to use this project as a developer. Architecture details: `docs/PLAN.md`.

## What it does

You talk to an AI console (opencode). It opens a **visible Chromium browser**, looks
at your running web app, and writes **Java/Selenium tests** (Page Object pattern)
into `src/test/java/`, using whichever Java test framework the project already uses
(JUnit 5 by default for a new project, TestNG also supported). The AI browser is only
used while generating — the finished tests run on their own with plain Selenium, no
AI needed.

## Prerequisites

- opencode's default providers are configured (a local provider serving
  `mistral-small-4-119b`, set up in your system/global opencode settings — not in
  this repo's `opencode.json`).
- Java 17+ and Maven are installed.
- Your application under test is running and reachable.

## One-time setup

- Create `config/test.properties` with the base URL and test username (never the
  password — see `.gitignore`).
- Create `ai/.install/secrets.env` (gitignored, `chmod 600`) with the test password,
  e.g. `TEST_PASSWORD=...` — never committed, never shown to the AI.
- Point Playwright's browser install at `ai/.install/playwright` (project-local, not
  `~/.cache` and not inside the shared `.opencode` clone) and install it once. npm
  dependencies themselves are installed automatically by opencode, see
  `.opencode/package.json`:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/ai/.install/playwright"  # add to your shell profile or .envrc — must stay set for daily use too
cd .opencode && npx playwright install chromium
```

## Daily use

Start the console in the project root:

```bash
opencode
```

Press **Tab** to switch between the phase agents — the session (and everything
already discussed) carries over:

| Agent | Phase |
|---|---|
| `explore` | Interactively build a numbered test scenario with you, one step at a time |
| `selenium` | Write or edit page objects/tests from the finalized scenario — reads the existing code first, proposes a plan, asks if unclear |
| `test` | Compile/run with Maven, auto-fix failures (stops after 3 attempts) |
| `inspector` | You record a flow in Playwright codegen; the AI translates it |
| `build` | Everything else: skeleton setup, git, housekeeping |

Then just talk to it. Typical requests:

| You want | Say / type |
|---|---|
| First run ever | "Set up the Java skeleton" (creates `pom.xml`, `TestConfig`, folders — once per project) |
| Build a new scenario | To "explore": "let's work on search_form. Open https://myapp.local/orders" — it asks what to do next, one step at a time, and saves each confirmed step to `ai/scenario/search_form.md` |
| Resume a scenario | To "explore": "we want to work on search_form, open the browser and play all steps until step 5" — it replays steps 1-5 live, then continues from there |
| Edit a scenario step | To "explore": "on search_form, change step 3 to click the Export button instead" |
| Change a test | To "selenium": "also assert the success toast on OrderTest" — it looks at the existing code, proposes what it'll change, then applies it once you agree |
| Typography check | "Add a typography check for the orders page" |

Once a scenario is finalized (or a change request is clear), press Tab to
"selenium" — it reads `ai/scenario/<name>.md`, checks what already exists in
`src/test/java/`, proposes a plan (reuse/extend vs. new page object/test method),
and writes or edits the code once you approve. Then Tab to "test" to compile-check
with Maven (retries up to 3 times on failure, then reports the error).

opencode's own TUI sidebar (`ctrl+x b` to toggle) shows which scenario `explore`
is currently on, e.g. "📍 search_form — step 6" — read-only, updates live as you
work. To switch, tell `explore`, don't click the sidebar.

## Shared knowledge across sessions

The agents keep an `ai/learnings` file — decisions, navigation notes, the login
flow, tricky selectors, and Selenium conventions specific to your app, so the same
thing doesn't get re-discovered every session. It's created automatically the first
time an agent has something to record; commit it like any other project file and
read it yourself any time you want to see what the agents have learned so far.

## Login-protected apps

Tell the agent your login flow **once**, interactively:

> "To log in: go to /login, fill #username with the test user, fill #password with
> $SECRET:TEST_PASSWORD, click the submit button."

Then have it record those steps in the "Login flow" section of your project's
`ai/learnings` (see "Shared knowledge across sessions" above), so every future run
replays them automatically. They stay in *your* project — never in the shared
`AGENTS.md`, which other testprojects reuse. Always write `$SECRET:TEST_PASSWORD` —
never the real password. The tool resolves it from `ai/.install/secrets.env` on its
own.

## Running the generated tests

```bash
mvn test                                        # functional tests
mvn test -Dgroups=typography-check              # occasional typography checks
```

Configuration (base URL, username) lives in `config/test.properties`. The password
comes from the `TEST_PASSWORD` environment variable or `ai/.install/secrets.env` — it
is never in a `.java` file or in git.

On a machine with no system Chrome install (CI runners, sandboxed dev containers),
point `BaseTest` at any Chrome/Chromium binary instead:

```bash
export CHROME_BIN=/path/to/chrome                # e.g. a CI cache, or Playwright's own
export CHROME_DRIVER_VERSION=<matching version>  # only if it doesn't match WebDriverManager's default (latest)
mvn test
```

Both are optional and unset by default — a normal system Chrome install needs neither.

## Reusing this setup across multiple projects

Don't copy this repo into each test-automation project — copies drift out of sync
with no way to push updates back. Instead, keep a single clone of
`opencodetesting` (e.g. `~/development/opencodetesting`) and have every project
reference it with three gitignored symlinks — `.opencode` (so opencode
discovers the shared agents/skills/tools/commands, exactly like a
project-local `.opencode/`), `.opencodetesting` (the whole clone, for
reference by path if ever needed), and `tui.json` (registers the sidebar
plugin — see "Daily use" above). `OPENCODE_CONFIG_DIR=<path>/.opencode` is a
fallback for setups that can't use symlinks at all (e.g. CI).

One `git pull` in the shared clone then updates every project that references
it — no vendoring, no manual re-copying.

Everything that's testproject-local (never symlinked, never shared) lives under one
`ai/` folder instead of scattered dotfiles: `ai/learnings` (committed), `ai/scenario/`
(committed, one numbered file per named scenario, built interactively with "explore"),
and `ai/.install/` (gitignored — secrets, Playwright's project-local browser install,
codegen recordings).

**Fastest way to set this up:** in the other project, open `opencode` and
paste in the raw link to [`INSTALL.md`](INSTALL.md)
(`https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md`).
opencode fetches it, asks where `opencodetesting` is cloned, then creates the
three symlinks and installs Playwright's browser project-locally.

## Rules of thumb

- One request = one test scenario. Small asks give better results — the local model
  has a small context window.
- Every generation/edit lands as a Git commit — use normal `git log` / `git revert`
  to inspect or undo.
- Never paste a real password into the console. Use `$SECRET:NAME`.
- If the agent guesses a page structure instead of opening the browser, tell it to
  use `explore-page` first.
