# AGENTS.md

Project rules and conventions for the AI-powered Java/Selenium test generator. Full
architecture and rationale: `@docs/PLAN.md`.

## What this project does

Generates Java/Selenium tests with the Page Object pattern from a running web app
(Angular/Oblique), using local models (Devstral for code, Ministral-3:3b for rare
visual follow-ups) via the skill chain in `.opencode/skills/`. Playwright is used only
internally, during generation, to "see" the page — it is never part of the delivered
test and never runs at test time.

## Skill chain rules

- One skill = one task. Never combine "analyze AND generate AND validate" into a
  single response.
- Prefer the ARIA/DOM snapshot (text) over a screenshot. Only use the `vision`
  sub-agent for a genuinely ambiguous element, with a cropped screenshot — never a
  full-page one.
- Never hand a whole existing file to a skill; pass only the affected excerpt (method
  or class), unless the file is already under ~80 lines.
- One-time setup: if `pom.xml` or `TestConfig` doesn't exist yet, run
  `setup-java-skeleton` first (once per project) — otherwise `validate-test` cannot
  compile anything.
- Standard chain for "new test": `explore-page` → `component-knowledge` (as needed) →
  `generate-pageobject` → `generate-test` → `validate-test`. On a validation failure,
  loop back to `generate-test` (or `generate-pageobject` if the error is selector-
  related) — max 3 attempts, then stop and report the error instead of looping.
- Standard chain for "edit test": `edit-test` → `validate-test`.
- See `.opencode/skills/<name>/SKILL.md` for each skill's exact input/output contract.

## Java conventions

- Page objects: `src/test/java/pages/<Name>Page.java`, `@FindBy` selectors, no
  `Thread.sleep`.
- Tests: `src/test/java/tests/<Name>Test.java`, JUnit 5, one test case = one method.
- Configuration (base URL, test data, environment) always comes from `TestConfig` /
  `config/test.properties` — never hardcoded in generated code.
- Every generation/edit ends with `validate-test` before it counts as done.

## Secrets

- Never write a real secret value into a prompt. Use the placeholder
  `$SECRET:NAME` (e.g. `$SECRET:TEST_PASSWORD`) as the `fill` value when driving
  Playwright via the `playwright-explore` tool — the tool resolves it itself from
  `.tools/secrets.env`, which is gitignored and never enters the AI's context.
- Generated Java tests read secrets at runtime via `TestConfig`
  (`TestConfig.get("test.password")`), never as a literal in `.java` source.
- See `docs/PLAN.md` section 6 for the full rationale.

## Login flow

**Not yet configured for this project.** Once a target application and its login
requirements are known, record the exact steps here as a fill/click sequence so
`explore-page` can replay it automatically instead of asking each time, e.g.:

```
1. goto <login URL>
2. fill <username selector> with the configured test username
3. fill <password selector> with $SECRET:TEST_PASSWORD
4. click <submit selector>
```

No dedicated login skill or OIDC logic is needed — see `docs/PLAN.md` section 4.3.

## Component/typography references

- `references/oblique-components.md` — Angular Material & Oblique selector/DOM
  guidance, read by `component-knowledge`. Covers every component of the Oblique
  15.4.0 docs; ✅ entries were verified by driving the live docs examples, ⚠️ entries
  have no live preview and must be re-checked against the real app's DOM snapshot.
- `references/design-tokens.md` — typography values, read by `check-typography`. Only
  covers what's actually been verified against a live render; extend it (with source
  and date) rather than guessing new values.

## Model server

Local Ollama server, connected via the `local` provider in `opencode.json`
(`devstral-small-2` default, `ministral-3:3b` for the `vision` sub-agent). The server
itself (`http://sriolo-desktop.local:11434`) is administered separately — `bootstrap.sh`
only connects to it, never installs/manages Ollama or its models. See `docs/PLAN.md`
section 7.
