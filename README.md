# Manual — AI-Powered Selenium Test Generator

How to use this project as a developer. Architecture details: `docs/PLAN.md`.

## What it does

You talk to an AI console (opencode). It opens a **visible Chromium browser**, looks
at your running web app, and writes **Java/Selenium tests** (Page Object pattern,
JUnit 5) into `src/test/java/`. The AI browser is only used while generating — the
finished tests run on their own with plain Selenium, no AI needed.

## Prerequisites

- The Ollama model server is running and reachable (`http://sriolo-desktop.local:11434`
  with `devstral-small-2` and `ministral-3:3b`).
- Java 17+ and Maven are installed.
- Your application under test is running and reachable.

## One-time setup

```bash
./bootstrap.sh
```

Asks for base URL, test username, model server address, and the test password
(written silently to `.tools/secrets.env` — never committed, never shown to the AI).
It also installs the npm dependencies and Playwright browsers, project-locally.

## Daily use

Start the console in the project root:

```bash
opencode
```

Press **Tab** to switch between the phase agents — the session (and everything
already discussed) carries over:

| Agent | Phase |
|---|---|
| `explore` | Open the browser, click through the app, understand the scenario |
| `selenium` | Write the page objects and JUnit test from the exploration |
| `test` | Compile/run with Maven, auto-fix failures (stops after 3 attempts) |
| `inspector` | You record a flow in Playwright codegen; the AI translates it |
| `build` | Everything else: skeleton setup, git, housekeeping |

Then just talk to it. Typical requests:

| You want | Say / type |
|---|---|
| First run ever | "Set up the Java skeleton" (creates `pom.xml`, `TestConfig`, folders — once per project) |
| Look at a page | "Open the browser at https://myapp.local/orders" |
| New test | `/new-test <url> <scenario>` — e.g. `/new-test https://myapp.local/orders "create a new order and check it appears in the list"` |
| Change a test | `/edit-test src/test/java/tests/OrderTest.java "also assert the success toast"` |
| Typography check | "Add a typography check for the orders page" |

The agent chains the steps itself: explore page → generate page object → generate
test → compile-check with Maven. If compilation fails it retries up to 3 times, then
reports the error to you.

## Shared knowledge across sessions

The agents keep a `LEARNINGS.md` file at your project root — decisions, navigation
notes, the login flow, tricky selectors, and Selenium conventions specific to your
app, so the same thing doesn't get re-discovered every session. It's created automatically the first
time an agent has something to record; commit it like any other project file and
read it yourself any time you want to see what the agents have learned so far.

## Login-protected apps

Tell the agent your login flow **once**, interactively:

> "To log in: go to /login, fill #username with the test user, fill #password with
> $SECRET:TEST_PASSWORD, click the submit button."

Then have it record those steps in the "Login flow" section of your project's
`LEARNINGS.md` (see "Shared knowledge across sessions" above), so every future run
replays them automatically. They stay in *your* project — never in the shared
`AGENTS.md`, which other testprojects reuse. Always write `$SECRET:TEST_PASSWORD` —
never the real password. The tool resolves it from `.tools/secrets.env` on its own.

## Running the generated tests

```bash
mvn test                                        # functional tests
mvn test -Dgroups=typography-check              # occasional typography checks
```

Configuration (base URL, username) lives in `config/test.properties`. The password
comes from the `TEST_PASSWORD` environment variable or `.tools/secrets.env` — it is
never in a `.java` file or in git.

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
reference it:

- **Agents/commands/skills** (`.opencode/`): point opencode at the shared clone
  with the `OPENCODE_CONFIG_DIR` environment variable (or use
  `~/.config/opencode/` if you want it active for every project on the
  machine, not just one). opencode searches that directory for `agents/`,
  `commands/`, `skills/`, `plugins/` exactly like a project-local `.opencode/`.
- **`AGENTS.md` / `docs/` / `references/`**: allowlist the shared clone's
  absolute path via `permission.external_directory` in the project's
  `opencode.json` (see the entries already in this repo's `opencode.json`),
  then reference the shared files by path from the project's own `AGENTS.md`.

One `git pull` in the shared clone then updates every project that references
it — no vendoring, no manual re-copying.

**Fastest way to set this up:** in the other project, open `opencode` and
paste in the raw link to [`INSTALL.md`](INSTALL.md)
(`https://raw.githubusercontent.com/codeix/opencodetesting/master/INSTALL.md`).
opencode fetches it, asks how you want it wired up (default: personal,
gitignored symlinks — nothing machine-specific gets committed, so it works
regardless of where each teammate has `opencodetesting` cloned), then
creates the `.opencode`/`.opencodetesting` symlinks and points opencode at
the shared `AGENTS.md`/docs/references. `OPENCODE_CONFIG_DIR` remains as a
fallback for setups that can't use symlinks at all (e.g. CI).

## Rules of thumb

- One request = one test scenario. Small asks give better results — the local models
  have a small context window.
- Every generation/edit lands as a Git commit — use normal `git log` / `git revert`
  to inspect or undo.
- Never paste a real password into the console. Use `$SECRET:NAME`.
- If the agent guesses a page structure instead of opening the browser, tell it to
  use `explore-page` first.
