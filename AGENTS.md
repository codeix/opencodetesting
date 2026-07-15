# AGENTS.md

Project rules and conventions for the AI-powered Java/Selenium test generator. Full
architecture and rationale: `@docs/PLAN.md`.

## What this project does

Generates Java/Selenium tests with the Page Object pattern from a running web app
(Angular/Oblique), using a local model (`mistral-small-4-119b`, for both code and
rare visual follow-ups) via the skill chain in `.opencode/skills/`. Playwright is
used only internally, during generation, to "see" the page — it is never part of
the delivered test and never runs at test time.

## Console agents (Tab to switch)

Phase-specific primary agents keep the small model's context and tool set narrow.
They share one session, so each phase sees the previous phase's results:

- `explore` — interactively build a numbered test scenario with the developer, one
  step at a time (read-only, no code). Never a one-shot autonomous exploration.
- `selenium` — write page objects + tests from the finalized scenario (no browser,
  no shell).
- `test` — `mvn` compile/run, analyze failures, auto-fix (max 3 attempts, then report).
- `inspector` — launch Playwright codegen so the developer records a flow themselves,
  then translate the recording (login flow → ai/learnings, scenario → explore verifies
  and persists it).
- `build` — unrestricted; setup (`setup-java-skeleton`), git, housekeeping.

The built-in `plan` agent is disabled in `opencode.json`. The `vision` sub-agent is
unchanged (rare visual follow-ups only). The `learnings` and `scenario` sub-agents are
not Tab-switchable — the phase agents call them directly (see below).

## Shared knowledge (ai/learnings)

`ai/learnings` is the running knowledge base for *one specific application under
test* — decisions made, how to navigate the app, how tricky elements are reliably
found, Selenium coding choices adopted for that project. It exists so the same
question never has to be answered twice across sessions.

**This file belongs to the testproject, never to this shared `opencodetesting`
clone.** This repo (`.opencode/`, this very `AGENTS.md`, `docs/`, `references/`) is
one shared install reused by *every* testautomation project (see "Reusing this
setup across multiple projects" in `README.md`) — in the recommended setup this
`AGENTS.md` physically lives in the shared clone's directory, not inside the
testproject at all. `ai/learnings` must always be written at the testproject's own
root instead — the directory that actually contains `pom.xml`, `src/test/java`,
`config/` — i.e. wherever the developer runs `opencode` from. Do not resolve its
path relative to this file or to the shared clone; if the two locations differ,
the testproject's own working directory wins. Writing testproject knowledge into
the shared clone would leak one project's app-specific details into every other
project that reuses this install.

- Every phase agent (`explore`, `selenium`, `test`, `inspector`) reads it before
  acting and, at the end of its turn, hands anything reusable to the `learnings`
  sub-agent (`.opencode/agents/learnings.md`), which is normally the only agent
  that writes to the file — it keeps entries organized under five fixed headings
  (`Decisions`, `Navigation`, `Login flow`, `Elements & selectors`,
  `Selenium conventions`) and avoids duplicates. If a sub-agent call doesn't
  complete (the known stall pattern — see "Skill chain rules" below), an agent
  with write access appends the entry itself in the same format; `explore` (which
  cannot write) states it in its reply so the developer or the next phase agent
  records it.
- This is a reference doc, not a changelog: terse bullets, no dates, no session
  narration. Keep the whole file under ~80 lines — every phase agent loads it each
  turn, and the local model's context is small: merge overlapping bullets and drop
  superseded ones instead of growing past that.
- Doesn't exist yet for a fresh testproject — the `learnings` sub-agent creates it
  (and the `ai/` folder, if needed) there on first use. Commit it like any other
  project file, in the testproject's own repo; it's meant to be shared with the
  whole team, not just the AI.
- This is distinct from `references/oblique-components.md` /
  `references/design-tokens.md` (general Oblique/Angular Material knowledge, part of
  this shared framework repo, the same for every testproject). `ai/learnings` is
  everything that's specific to one testproject — including its login flow (see
  "Login flow" below).

## Test scenarios (ai/scenario/)

`ai/scenario/<name>.md` is the persisted, numbered, ordered step list for one named
test scenario (e.g. `ai/scenario/search_form.md`) — the authoritative record of what
a test does, separate from the chat that built it.

- Built interactively by `explore`, one confirmed step at a time, and persisted via
  the `scenario` sub-agent (`.opencode/agents/scenario.md`) — the same
  write-through-a-subagent pattern as `ai/learnings`, since `explore` cannot write
  files itself.
- Same numbered fill/click/assert format as the "Login flow" section below. Step
  numbers are never reassigned, even when earlier steps are later edited.
- The developer can resume a scenario and replay a range ("play all steps until step
  5") or edit a specific step by number — see `docs/PLAN.md` section 4.4 for the full
  workflow.
- `selenium` reads it directly (plain file read, no sub-agent needed) as the
  authoritative input for `generate-pageobject`/`generate-test` — not just what was
  discussed in the "explore" chat.
- Committed like `ai/learnings` — it's meant to be shared with the team, not just
  the AI.

## Skill chain rules

- **Invoke a skill by reading its `SKILL.md` file directly** (e.g. `Read
  .opencode/skills/generate-test/SKILL.md`), not by relying on the `skill` tool.
  The `skill` tool is unreliable with the local model (`mistral-small-4-119b`) — it
  sometimes announces
  intent to use a skill and never completes the call, then repeats the same
  announcement on the next turn with no progress (looks like a stall/loop, is
  actually this). Reading the file directly and following its procedure has been
  reliable every time it's been tried. This applies in every mode/agent.
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
- Building a scenario is interactive, not chained: `explore` calls `explore-page` once
  per confirmed step, never all at once — see "Test scenarios" above.
- Standard chain once a scenario is finalized: `component-knowledge` (as needed) →
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
  `ai/.install/secrets.env`, which is gitignored and never enters the AI's context.
- Generated Java tests read secrets at runtime via `TestConfig`
  (`TestConfig.get("test.password")`), never as a literal in `.java` source.
- See `docs/PLAN.md` section 5 for the full rationale.

## Login flow

A login flow is specific to one application under test, so it is recorded in the
**testproject's `ai/learnings`, under its `## Login flow` heading** — never in this
file. This `AGENTS.md` is shared by every testautomation project (see "Shared
knowledge" above); writing one project's login steps here would replay them against
every other project's app. Record the flow as a numbered fill/click sequence so
`explore` can replay it automatically instead of asking each time, e.g.:

```
1. goto <login URL>
2. fill <username selector> with the configured test username
3. fill <password selector> with $SECRET:TEST_PASSWORD
4. click <submit selector>
```

Always the `$SECRET:NAME` placeholder, never a real password (see "Secrets" above).
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

A local provider serving `mistral-small-4-119b` (used for both code and the
`vision` sub-agent), configured in opencode's system/global settings — not in this
repo's `opencode.json`. The model server itself is administered entirely separately,
outside this project. See `docs/PLAN.md` section 6.
