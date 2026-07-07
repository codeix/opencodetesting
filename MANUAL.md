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

## Login-protected apps

Tell the agent your login flow **once**, interactively:

> "To log in: go to /login, fill #username with the test user, fill #password with
> $SECRET:TEST_PASSWORD, click the submit button."

Then have it record those steps in the "Login flow" section of `AGENTS.md`, so every
future run replays them automatically. Always write `$SECRET:TEST_PASSWORD` — never
the real password. The tool resolves it from `.tools/secrets.env` on its own.

## Running the generated tests

```bash
mvn test                                        # functional tests
mvn test -Dgroups=typography-check              # occasional typography checks
```

Configuration (base URL, username) lives in `config/test.properties`. The password
comes from the `TEST_PASSWORD` environment variable or `.tools/secrets.env` — it is
never in a `.java` file or in git.

## Rules of thumb

- One request = one test scenario. Small asks give better results — the local models
  have a small context window.
- Every generation/edit lands as a Git commit — use normal `git log` / `git revert`
  to inspect or undo.
- Never paste a real password into the console. Use `$SECRET:NAME`.
- If the agent guesses a page structure instead of opening the browser, tell it to
  use `explore-page` first.
