# PLAN.md — AI-Powered Test Generator (OpenCode + Mistral Small 4 119B + Java/Selenium)

This document is the **build plan** for the project. It describes the architecture and
defines how every single `SKILL.md` must look, so the agent (`mistral-small-4-119b`,
used both as the text/code model and for rare visual follow-up questions) can work
independently without blowing the small AI's context window.

This file is **not** loaded automatically by the agent. It is documentation for humans.
It is optionally linked from `AGENTS.md` so the agent can look it up when needed
(`@docs/PLAN.md`).

---

## 0. Status

This entire document is currently in the **planning stage**. Nothing here has been run,
installed, or verified against a real application yet. All TODO markers (e.g. in
`oblique-components.md`) are intentionally left open and will only be addressed during
the later implementation phase — not now.

---

## 1. Project Goal

- Automatically generate **Java/Selenium tests** with the **Page Object pattern** from a
  running web application (Angular or similar).
- Playwright is used **only internally** by the AI to "see" the page (DOM/accessibility
  tree, screenshots) — it is **not** part of the delivered tests.
- A small, local model (`mistral-small-4-119b`, used for code and images alike) has a
  limited context window → every skill must be scoped so a single call stays small and
  focused.
- Multi-step tasks (analysis → page object → test → validation) are planned
  **autonomously** by the agent as a chain of skill calls.
- Developers can later have existing tests edited in a targeted way, without
  regenerating everything (versioning via Git commits, no custom versioning system).

---

## 2. Folder Structure

### 2.1 This repo (the shared framework)

```
opencodetesting/
├── opencode.json                     # opencode defaults (disabled agents, permissions, MCP servers if used) — no provider block; the local provider is configured in opencode's system settings
├── AGENTS.md                         # project rules, conventions, reference to PLAN.md
├── README.md / INSTALL.md
├── docs/
│   └── PLAN.md                       # this document
├── references/
│   ├── oblique-components.md
│   └── design-tokens.md
└── .opencode/
    ├── package.json                  # npm dependency "playwright" for the custom tool
    ├── skills/
    │   ├── component-knowledge/SKILL.md
    │   ├── explore-page/SKILL.md
    │   ├── generate-pageobject/SKILL.md
    │   ├── generate-test/SKILL.md
    │   ├── validate-test/SKILL.md
    │   ├── edit-test/SKILL.md
    │   ├── check-typography/SKILL.md
    │   └── setup-java-skeleton/SKILL.md   # one-time: pom.xml, TestConfig, BaseTest, folders (verbatim templates)
    ├── tools/
    │   └── playwright-explore.ts     # custom tool: drives the browser, returns ARIA snapshot + screenshot path
    └── agents/
        ├── vision.md                 # sub-agent that uses the configured local model (only for screenshots)
        ├── learnings.md               # sub-agent that maintains ai/learnings for a testproject
        ├── scenario.md                # sub-agent that maintains ai/scenario/<name>.md for a testproject
        ├── explore.md                # primary agent, phase 1: interactive scenario building (read-only)
        ├── selenium.md                # primary agent, phase 2: write/edit page objects + tests, interactively (no browser/shell)
        ├── test.md                   # primary agent, phase 3: mvn run + auto-fix (max 3 attempts)
        └── inspector.md              # primary agent: Playwright codegen recording + translation
```
No `commands/` anymore — both `/new-test` and `/edit-test` were removed once `explore`
and `selenium` became interactive (see sections 4.4 and 4.5); there is no
slash-command shortcut left in this framework.

### 2.2 A testautomation project that consumes it

Only two symlinks and one `ai/` folder are imposed on a testproject — everything else
(`config/`, `src/test/java/`, `pom.xml`/Maven, or their equivalents in another stack) is
that project's own layout and is out of scope here (see `INSTALL.md` for how the
symlinks get created):

```
<testproject>/
├── .opencode -> <path>/opencodetesting/.opencode   # symlink; opencode discovers agents/skills/tools/commands here — must stay at the project root
├── .opencodetesting -> <path>/opencodetesting       # symlink to the whole shared clone; gives access to AGENTS.md/docs/references by path
├── ai/
│   ├── .gitignore                    # ignores .install/ only — learnings and scenario/ ARE committed
│   ├── learnings                     # testproject-specific knowledge (was LEARNINGS.md at root) — committed
│   ├── scenario/                     # one numbered, editable file per named scenario (see section 4.4) — committed
│   └── .install/                     # LOCAL ONLY, gitignored
│       ├── secrets.env               # test password etc., chmod 600 (see section 5)
│       └── playwright/               # PLAYWRIGHT_BROWSERS_PATH target — browser binaries, project-local
└── ...                                # the project's own structure (e.g. config/test.properties, src/test/java/, pom.xml)
```

---

## 3. Mandatory Format for Every SKILL.md

Every skill file in the project **must** follow this schema:

### 3.1 Frontmatter (mandatory fields)

```yaml
---
name: kebab-case-name          # must match the folder name
description: >
  When this skill triggers (concrete user phrases/contexts) AND what it does.
  Prefer phrasing it a bit "pushy" so the agent doesn't overlook it.
---
```

Do not invent additional frontmatter fields — unknown fields are ignored by OpenCode, so
only rely on `name` and `description`.

### 3.2 Mandatory Body Sections

Every SKILL.md must contain these four sections, in this order:

1. **Input** — what the skill expects as input (data type, source: e.g. "DOM snapshot
   as text from the `explore-page` skill", not "whole page as a screenshot").
2. **Context budget** — a hard ceiling on how much text/image the skill may put into
   the prompt (see rules below). Must be stated explicitly as a number/rule of thumb.
3. **Procedure** — a concise step-by-step guide, max. 5–8 points. No essay.
4. **Output** — the exact expected format (e.g. "Java code only, no explanation", or
   "JSON with fields `selector`, `type`, `label`"). This is essential so the next skill
   in the chain can process the result programmatically.

### 3.3 Context Budget Rules (binding for all skills)

- **One skill = one task.** Never combine "analyze AND generate AND validate" into one
  skill.
- **No full screenshot when text is enough.** Always try working with the
  DOM/accessibility snapshot (text) first. Only use images (via the `vision`
  sub-agent) when the skill explicitly needs a "visual follow-up question" (e.g.
  ambiguous layout). Crop the screenshot to the relevant area then, not the full page.
- **Never hand over large files whole.** Give the skill only excerpts (the affected
  method/class) of existing tests/page objects, not the whole file, unless it is
  genuinely short (<80 lines).
- **Keep output small.** Every generated code block should be runnable/testable on its
  own (one test method, one page object) instead of large batch files in one go.

---

## 4. Planned Skills (Overview/Chain)

| Order | Skill | Input | Output | Model |
|---|---|---|---|---|
| 0 | `component-knowledge` | (no live input — static reference) | selector/structure knowledge about Angular Material & Oblique, as text | none (reference only) |
| 1 | `explore-page` | URL / running session | DOM snapshot (text) + optional cropped screenshot | Playwright tool (no LLM) |
| 2 | `generate-pageobject` | DOM snapshot + lookup in `component-knowledge` | Java page object class | `mistral-small-4-119b` |
| 3 | `generate-test` | Page object class + test scenario | Java test class | `mistral-small-4-119b` |
| 4 | `validate-test` | Test class + page object | `mvn test-compile`/run result, on error: error message | no LLM (only for a fix suggestion: `mistral-small-4-119b`) |
| 5 | `edit-test` | existing file (excerpt) + change request | updated excerpt | `mistral-small-4-119b` |

**Iteration planning:** Step 1 (`explore-page`) is driven **interactively** by the
developer through the "explore" agent — one confirmed step at a time, not run
automatically (see section 4.4). Once the developer finalizes a scenario, "selenium"
is itself interactive too (see section 4.5): it analyzes the existing code, proposes
a plan (steps 2/5, whichever fits — new page object/test vs. a targeted edit to an
existing one), and only proceeds once the developer approves it or the plan is
unambiguous. Once code is written, "test" runs step 4 (`validate-test`). On
validation failures it jumps back to whichever skill produced the failing file (max.
3 attempts), then aborts with an error report to the developer instead of looping
forever.

### 4.1 Special case: `component-knowledge` as a pre-prepared knowledge skill

The application uses Angular Material and, built on top of it, **Oblique**
(https://oblique.bit.admin.ch, the Swiss federal library of Angular components with an
`Ob*` prefix). The small, local model (`mistral-small-4-119b`) cannot research these
libraries itself — it has no internet access and too small a context window to read
the docs every time.

That's why this knowledge is **prepared once by Claude** (with real web access) and
stored as a static reference file in the project. The local agent only reads the lines
relevant to the current step from it — no live research needed, no context overhead.

- Contains: known CSS selector patterns, ARIA roles, typical DOM structure per
  component (e.g. `mat-form-field`, `mat-select`, `mat-dialog`, `ob-master-layout`,
  `ob-...`), including notes on which selectors are unstable (e.g. Material-generated
  IDs) and what to use instead for robust targeting (`data-testid`, ARIA label).
- Must be refreshed periodically as Oblique/Material versions change — hence a version
  note in the file header.
- Is **not instructions for an action**, but a pure reference. Referenced by
  `generate-pageobject` and `generate-test`, not "run" on its own.

### 4.2 Interface: OpenCode ↔ Playwright

OpenCode has **custom tools**: TypeScript/JavaScript files under `.opencode/tools/`
(verified against the installed OpenCode binary — plural, not singular) that export a
function the AI can call (`@opencode-ai/plugin`, `tool()` with a Zod raw shape for
`args` + an `execute(args, context)` function returning a string or
`{ title?, output, metadata?, attachments? }`). Playwright is itself a Node library —
so it runs directly inside such a custom tool, no detour needed.

**Planned tool:** `.opencode/tools/playwright-explore.ts`
- `args.action`: `goto | snapshot | screenshot | click | fill | evaluate`
  (`evaluate` runs arbitrary JavaScript in the page context via `new Function`, for
  cases the built-in actions can't cover — e.g. reading a computed style or a value
  off `window`.)
- Browser launches **non-headless** (`headless: false`) by decision (2026-07-07): the
  developer watches the exploration live in a visible Chromium window.
- Browser/page as a module-level singleton, so it stays open across multiple skill
  calls (not restarted/re-logged-in on every call).
- `snapshot` returns Playwright's **ARIA snapshot** (compact, semantic text) instead of
  raw HTML — that's the input for `generate-pageobject`.
- `screenshot` saves the file to disk and returns only the **path**, never base64
  inline in the tool response — otherwise the context budget is blown immediately (see
  rules in section 3.3). The image is only loaded on demand.
- The `playwright` dependency goes into a `package.json` inside the `.opencode/`
  folder; OpenCode installs it automatically at startup.

**Alternative considered, not chosen:** There is a ready-made Playwright MCP server
(Microsoft) that already ships similar tools (navigate, snapshot, click, screenshot)
and could simply be wired in via `mcp` in `opencode.json` — with no custom code at all.
Advantage: less maintenance. Disadvantage: less control over whether
screenshot size/snapshot format complies with our context budget rules. **Decision:**
went with the custom tool (`.opencode/tools/playwright-explore.ts`), so format and
context budget are guaranteed to match the rest of the skill system.

### 4.3 Login is not a special case — just a fill+click sequence

Originally tracked as an open architecture gap ("login/auth handling"), but actually
not a distinct problem: a login form consists of the same building blocks that
`explore-page`/`generate-pageobject`/`generate-test` already know — filling
`mat-form-field` inputs, clicking a button (see `component-knowledge`). It needs **no
dedicated skill and no OIDC logic**.

**How it works instead:**
- The developer defines the login flow for their project **once, interactively in the
  OpenCode console** (e.g.: "Go to `/login`, fill field X with the test user, field Y
  with the password, click button Z"). The agent executes this directly via the
  existing Playwright tool actions (`goto`, `fill`, `click`) — no guessing needed, the
  developer determines the "right way" themselves.
- This once-defined flow is recorded as a small note in the project (e.g. a short
  section in `AGENTS.md` or a `config/login-steps.md`: URL, which fields, which
  button), so `explore-page` can automatically repeat it on every new test run without
  asking again.
- The credentials themselves (test user/password) come from the configuration
  (`config/test.properties`, created manually — see README.md "One-time setup") —
  the login *flow* (selectors/clicks) is separate from that and needs no secret
  handling, only the credentials themselves (see the next open item).

This removes what was previously assessed as a complex login/auth architecture — the
only remaining question is **how the test password is securely passed into this flow**
without ending up in the prompt to `mistral-small-4-119b` or in plaintext in the repo.
That is the subject of the next planning step: secrets handling.

### 4.4 Interactive Scenario Building (`ai/scenario/`)

**Decision (2026-07-15):** `explore` is not a one-shot autonomous exploration handed
off with a chat summary — it's an interactive, conversational session with the
developer, and the persisted artifact is `ai/scenario/<name>.md`, not the chat
history. This replaced the earlier `/new-test <url> <scenario>` command, which ran
the whole chain autonomously "without asking for confirmation between steps" —
incompatible with wanting the developer to be asked, one step at a time.

- **One step at a time.** The developer says what to do next; `explore` confirms the
  target element against a live ARIA snapshot (never from memory), executes it via
  `playwright-explore`, then persists that one confirmed step before asking about the
  next. Never a whole scenario written in one shot.
- **Persistence via the `scenario` subagent** (`.opencode/agents/scenario.md`), the
  same pattern as `learnings`: `explore` cannot write files itself, so it hands each
  confirmed step to `scenario`, which appends it to `ai/scenario/<name>.md` as the
  next number.
- **Format:** numbered steps, one per line, same numbered fill/click/assert
  convention as the login flow (`AGENTS.md` "Login flow" section) — action, selector,
  short plain-language context. Numbers are never reassigned, even when earlier steps
  are later edited.
- **Resuming and partial replay:** the developer can name an existing scenario and a
  range (e.g. "play all steps until step 5"); `explore` reads that range from
  `scenario` and replays it live before continuing the conversation from there.
- **Editing:** the developer can name a step number and a change; `explore` verifies
  the new element live, then has `scenario` rewrite just that line in place.
- **Handoff:** once the developer says the scenario is ready, `explore` tells them to
  press Tab to "selenium", which reads `ai/scenario/<name>.md` directly (no subagent
  needed for reading — it already has file access) as the authoritative, ordered step
  list for `generate-pageobject`/`generate-test`.

### 4.5 Interactive Selenium: Analyze, Plan, Propose

**Decision (2026-07-16):** `selenium` doesn't autonomously turn a scenario into code
either — it reads the existing project first, builds a plan, and proposes it to the
developer before writing anything. This replaced the earlier standalone `/edit-test
<file> <change>` command, for the same reason `/new-test` was replaced: a fixed,
non-interactive command is incompatible with wanting the developer in the loop. There
is no slash-command shortcut for either case anymore — new tests and edits to
existing ones both go through the same interactive `selenium` conversation.

- **Analyze first.** Before deciding anything, `selenium` reads what's already in
  `src/test/java/pages/` and `src/test/java/tests/` — existing page objects for the
  same page/route, existing test classes for the same feature, the naming/style
  conventions already established in the project. It never assumes a class doesn't
  exist without checking, and never proposes one that duplicates one already there.
- **Plan, then propose.** `selenium` decides: reuse/extend an existing page object
  (add a method or two) vs. a genuinely new class; add a method to an existing test
  class vs. a genuinely new file. It states that plan — which files, reuse vs.
  create, what methods/assertions — and waits for the developer's go-ahead before
  writing, unless the developer has already made clear they want it to just proceed.
- **Ask when unclear.** A selector missing from the session's snapshots, a scenario
  step that doesn't map onto an existing page object method, an existing convention
  that conflicts with the scenario — `selenium` says exactly what's unclear rather
  than guessing.
- **Prefer extending over duplicating.** The Page Object pattern stays the default;
  `generate-pageobject` and `generate-test` both start their procedure with "check
  for an existing one first" (see sections above). One unified path handles both
  "new test" and "edit existing test": if the plan calls for a targeted change to
  code that already exists, `selenium` uses `edit-test` (excerpt-only, minimal
  change, preserves signatures other tests rely on) instead of
  `generate-pageobject`/`generate-test`.

---

## 5. Secrets Handling

**Goal:** The test password must never be sent in plaintext to `mistral-small-4-119b`, must
never end up in the repo, but must still be automatically available — both during
AI-assisted exploration (login via Playwright) and in the final, self-contained
Selenium test.

**Core idea:** The AI must never *see* the password — it only needs to know that "the
test password" belongs at a given spot, not what its value is. Resolving the actual
value happens outside the prompt, in code that already has filesystem access anyway.

### 5.1 Two Separate Places Where the Password Is Needed

| Point in time | Who needs the password | How it's resolved | Does the AI see the value? |
|---|---|---|---|
| **Generation** (Playwright logs in to explore authenticated pages) | `.opencode/tools/playwright-explore.ts` (custom tool) | The tool only gets a placeholder from the AI (e.g. `"$SECRET:TEST_PASSWORD"`) as the `fill` value, and resolves it itself from a local, non-versioned secrets file | **No** — placeholder in the prompt, real value only in the tool code |
| **Runtime** (the finished Selenium test logs in) | Java base class (`BaseTest`) | Reads the password itself at runtime from an environment variable/local properties file, never as a literal in the generated `.java` code | **No** — `generate-test` is instructed to always write `TestConfig.get("test.password")`, never the value itself |

### 5.2 Where the Password Actually Lives

- New, **non-versioned** file: `ai/.install/secrets.env` (see section 2.2), gitignored.
- Created manually by the developer, with restrictive file permissions (`chmod 600`)
  — **not** into `config/test.properties` (which stays commit-friendly, without
  secrets).
- `ai/.gitignore` must include `.install/`, so nothing gets checked in even by
  accidental copying.

### 5.3 Placeholder Convention (draft)

- When defining the login flow once (section 4.3), the developer does not write the
  real password into the login note, but the placeholder, e.g.:
  `fill(passwordField, "$SECRET:TEST_PASSWORD")`.
- Both the custom tool (at generation time) and `TestConfig` in Java (at runtime)
  recognize the same naming scheme (`TEST_PASSWORD`) and resolve it from their
  respective local source (`ai/.install/secrets.env` or an environment variable/its
  own properties file for the CI/runtime environment).
- Tool output (the return value of `fill`) never returns the resolved value (e.g. just
  `"filled"`), so the password can't reappear in the context via a detour through the
  tool response either.

### 5.4 Open Items
- [ ] Define the exact syntax of the placeholder convention (currently only a draft:
      `$SECRET:NAME`)
- [ ] How does `ai/.install/secrets.env` get populated in a CI environment (no
      interactive setup step exists) — presumably via the CI's own secret variables,
      still open
- [ ] Check/decide: should `validate-test` (section 4) automatically check for
      accidentally hardcoded passwords in generated Java code (a simple grep as an
      extra safety net)?
- [ ] Clarify whether the ARIA snapshot after a successful login could accidentally
      contain sensitive data (e.g. a displayed real username), and whether that's
      uncritical for the prompt to `mistral-small-4-119b` (test users are usually fake
      data, but this isn't automatically checked)

---

## 6. Model Connection (Mistral Small 4 119B, default providers)

**Correction from an earlier planning version:** This section previously assumed two
separate small models — "Devstral Small 2" for code and "Ministral-3:3b" for vision —
running on a self-managed Ollama server, wired up via a custom `provider` block in
`opencode.json`. Neither model exists; those were invented placeholder names from an
earlier draft. The project now uses a single real model, **`mistral-small-4-119b`**,
for both code generation and the rare vision follow-ups.

**Provider configuration lives outside this repo.** opencode's default providers
(including the local provider that serves `mistral-small-4-119b`) are configured in
opencode's **system/global settings**, not in this project's `opencode.json`. This
repo's `opencode.json` therefore has no `provider` block and no `model` field — model
selection happens from within opencode itself (the model picker / global default),
not hardcoded per project. See `opencode.json` in the repo root.

- The `vision` sub-agent (`.opencode/agents/vision.md`) likewise does not pin a
  `model:` field — it uses whatever default model is configured, currently
  `mistral-small-4-119b`.
- No per-project script installs, manages, or health-checks the model server — it is
  entirely a system-level concern, configured in opencode's global settings.
- Context budget rules (section 3.3) still apply regardless of exactly how the provider
  is wired up: `mistral-small-4-119b` is still a comparatively small/local model, so
  skills must stay narrowly scoped.

### 6.1 Open Items
- [x] Replaced the invented `devstral-small-2`/`ministral-3:3b` model names with the
      real model, `mistral-small-4-119b`, used for both code and vision.
- [x] Removed the custom `provider` block from `opencode.json` — the local provider is
      configured in opencode's system settings instead, so this repo no longer needs
      to know the model server's address at all.
- [ ] Confirm `mistral-small-4-119b`'s context window and update the context-budget
      guidance in section 3.3 if it differs meaningfully from the previously assumed
      65,536 tokens.

---

## 7. Java Project Conventions (apply to all generated files)

- Page objects: `src/test/java/pages/<Name>Page.java`, `@FindBy` selectors from the DOM
  snapshot, no hardcoded waits (`Thread.sleep`).
- Tests: `src/test/java/tests/<Name>Test.java`, one test case = one method, using
  whichever Java test framework the project already uses (JUnit 5, TestNG, etc.) —
  never assume JUnit specifically; check `pom.xml`/existing tests for the actual one.
- Configuration (base URL, test data, environment) **always** comes from
  `config/test.properties`, never hardcoded in generated code.
- Every generation ends with `validate-test` before it counts as "done".

---

## 8. Editing Existing Tests

- No custom versioning format — every generation/edit is a Git commit.
- Editing goes through the same interactive `selenium` conversation as writing a new
  test (see section 4.5) — there is no separate `/edit-test` command anymore.
  `selenium` reads the existing code, proposes its plan, then applies it via
  `edit-test`, which only gets the affected excerpt (method/class), not the whole
  file, to keep the context small.
- Before every edit counts as done: run `validate-test` again, so errors don't slip
  in unnoticed.

---

## 9. Occasional Typography Check

In addition to the functional tests, the test suites should **occasionally** be able to
check font family and font size.

**Important constraint:** The finished Selenium test runs independently, with no access
to `mistral-small-4-119b` or any AI at runtime — the AI is only used during the
**generation** of the test, not during its **execution**. A layout check that would
send a screenshot to `mistral-small-4-119b` at runtime is therefore ruled out for now
and will **not** be implemented. If that's wanted later (e.g. via a separate analysis
step outside the Selenium test), it would need to be architecturally rethought —
outside scope for now.

### 9.1 What Remains: `check-typography` (purely deterministic, no AI access at runtime)

| Check | Method | Skill | Runs at runtime? |
|---|---|---|---|
| Font family / font size | Selenium `getCssValue("font-family"/"font-size")` against expected values from a static reference file | `check-typography` | Yes — pure Java/Selenium, no LLM call needed |

`check-typography` needs a reference with expected design tokens (font family, size
tiers per element type such as heading/body text/button) — analogous to the
`component-knowledge` skill, as another pre-prepared reference file
(`references/design-tokens.md`, researched once by Claude, currently still
TODO/unverified). This reference is only read during the **generation** of the test (by
`mistral-small-4-119b`), not at runtime — the generated test itself ends up with only
fixed expected values (e.g. as constants or in `config/test.properties`), no call to an AI.

### 9.2 Trigger Mechanism for "Occasional"

- Test methods get their own tag/group in whichever mechanism the project's test
  framework provides, e.g. `@Tag("typography-check")` (JUnit 5) or
  `@Test(groups = "typography-check")` (TestNG) — Maven Surefire's
  `<groups>`/`<excludedGroups>` works the same way for both.
- This tag does **not** run on every normal functional test pass, but instead:
  - either at a fixed sampling rate (e.g. only every nth run),
  - or as a separate, infrequently running job (e.g. nightly),
  - or targeted only at new/changed pages.
- The exact trigger rule (rate, schedule, which pages) is still open and will only be
  decided during the implementation phase.

### 9.3 Open Items
- [ ] Create `references/design-tokens.md` (font family/sizes from the Oblique docs,
      currently unverified — same limitation as `oblique-components.md`)
- [ ] Define a sampling/scheduling strategy for the `typography-check` tag
- [ ] Clarify whether/how layout errors (overlap, alignment) could be checked without
      AI at runtime (e.g. purely geometrically via Selenium element
      coordinates/sizes, without image analysis) — a separate, still open topic, no
      AI use at runtime

---

## 10. Open Items / Next Steps (overall)

- [x] Removed `bootstrap.sh`/`bootstrap.config.example` — no longer made sense once
      `.opencode` is a shared, symlinked install rather than something set up
      per-project by a local script (see `INSTALL.md`). Project-local setup (config,
      secrets, Playwright browsers) is now done manually — see README.md "One-time
      setup" and section 5.2. The model provider was already configured entirely
      separately, in opencode's system settings, unaffected by this removal.
- [x] Consolidated all testproject-local data under one `ai/` folder (see section
      2.2) instead of scattering it across the project root: `LEARNINGS.md` moved to
      `ai/learnings`, `.tools/secrets.env` moved to `ai/.install/secrets.env`,
      Playwright's browser install moved to `ai/.install/playwright` (genuinely
      project-local now, via `PLAYWRIGHT_BROWSERS_PATH` — previously it installed
      inside `.opencode/node_modules`, i.e. physically inside the shared symlinked
      clone, shared by every testproject using it), and codegen recordings moved to
      `ai/.install/recordings/`. New: `ai/scenario/`, one numbered file per named
      scenario (see section 4.4). The `.opencode`/`.opencodetesting` symlinks stay at
      the project root, unaffected — `opencode` only discovers `.opencode/` there.
- [x] Redesigned `explore` from a one-shot autonomous exploration into an interactive,
      conversational scenario-building session — one confirmed step at a time, never
      a whole scenario handed off in one shot (see section 4.4). Added the `scenario`
      sub-agent (`.opencode/agents/scenario.md`), which persists/edits/replays
      `ai/scenario/<name>.md`, the same write-through-a-subagent pattern as
      `learnings`. Removed the `/new-test <url> <scenario>` command entirely — it ran
      the whole chain autonomously "without asking for confirmation between steps,"
      which is incompatible with the new interactive model; there is no slash-command
      replacement, scenario building now happens entirely through conversation with
      `explore`. `selenium` now reads `ai/scenario/<name>.md` directly as its
      authoritative input instead of a chat-only scenario summary.
- [x] Redesigned `selenium` the same way: it analyzes the existing project code
      (`src/test/java/pages/`, `src/test/java/tests/`) before deciding anything, then
      proposes a plan (reuse/extend vs. new page object/test method) and asks when
      something's unclear, instead of silently generating files (see section 4.5).
      `generate-pageobject`/`generate-test` now both start with "check for an
      existing one first." Removed the standalone `/edit-test <file> <change>`
      command for the same reason `/new-test` was removed — non-interactive,
      incompatible with the new model. No slash-command replacement; `.opencode/`
      has no `commands/` left. The `edit-test` *skill* still exists, now called by
      `selenium` once its plan is approved, for the "targeted change to existing
      code" case specifically.
- [x] Made the Java test framework a choice, not a hardcoded assumption: JUnit 5
      remains the default for a fresh project, but TestNG is equally supported.
      `setup-java-skeleton` now asks which framework to use when `pom.xml` doesn't
      exist yet, or detects it from an existing `pom.xml`, and has a template
      variant per framework (`pom.xml` dependency block, `BaseTest`'s
      `@BeforeEach`/`@AfterEach` vs. `@BeforeMethod`/`@AfterMethod`) — never mixing
      pieces of one framework's variant with another's in the same project.
      `generate-test` and `check-typography` match whichever framework the
      project's existing tests already use (annotation style, `@Tag` vs.
      `@Test(groups=...)`) instead of assuming JUnit. `TestConfig` was already
      framework-agnostic (plain Java, no test-framework import) and needed no
      change.
- [x] Simplified `INSTALL.md` down to three things, after real-world testing
      surfaced problems with the previous, more elaborate version: (1) ask where
      `opencodetesting` is cloned (explicitly required — step 1 says this blocks
      step 2 and must not be guessed or defaulted, since the executing agent had
      been skipping it); (2) create the two symlinks, with an on-disk check
      right after (`ls -la`) so a broken symlink doesn't go unnoticed until the
      developer has to re-run the whole flow; (3) install Playwright's browser
      project-locally, also checked. **Dropped entirely:** the personal-vs-
      committed wiring choice, and wiring `AGENTS.md`/docs/references into
      opencode's config at all — earlier drafts did this via `permission
      .external_directory` in either the user's **global**
      `~/.config/opencode/opencode.json` (silently affects every other project
      on that machine — never do this) or a project-local `ai/.install
      /opencode.json` loaded via the `OPENCODE_CONFIG` env var, but both were
      judged more complexity than the win was worth. If that capability is
      wanted later, it needs its own decision, not a default in this flow.
- [x] `.gitignore` created — testproject's `ai/.gitignore` covers `.install/`; this
      shared repo's own `.gitignore` covers `*.env` and, as a safety net, `/ai/` in
      case it's ever accidentally created here — see section 5.2
- [ ] Finalize the placeholder convention `$SECRET:NAME` (section 5.3) — not yet
      implemented in the custom tool (`playwright-explore.ts`), only specified
- [x] Model connection corrected: the earlier "Devstral"/"Ministral-3:3b" names were
      invented and don't exist; the project uses the real model
      `mistral-small-4-119b`, via a default provider configured in opencode's system
      settings rather than a per-project `opencode.json` provider block — see section 6.
- [x] Removed the custom `provider` block from `opencode.json` — no provider or model
      is configured per-project anymore; model selection happens from within opencode
      itself (see section 6.1).
- [x] Built `.opencode/tools/playwright-explore.ts` (singleton browser, ARIA snapshot,
      screenshot path instead of base64, incl. secret placeholder resolution) — see
      4.2 + 5.3. Folder corrected to `tools/` (plural) — verified against the installed
      OpenCode binary, the earlier `tool/` (singular) in this plan was wrong.
- [x] Decided: custom tool (not the ready-made Playwright MCP server) — implemented in
      `.opencode/tools/playwright-explore.ts`, see section 4.2.
- [x] `pom.xml` skeleton + `TestConfig`/`BaseTest` design: NOT pre-built into the repo —
      by decision (2026-07-07) this is the agent's own job. A new skill
      `.opencode/skills/setup-java-skeleton/SKILL.md` contains the templates
      (pom.xml with Selenium 4 + a test framework + WebDriverManager, TestConfig with
      env/`ai/.install/secrets.env` secret resolution, BaseTest) and is run once per project
      before the first generation, or when `validate-test` finds them missing.
- [x] Wrote all skill files, including `explore-page` and `check-typography` (see
      section 9) — see `.opencode/skills/`.
- [x] Phase-specific primary agents added (2026-07-08, decision by the developer):
      `explore` (browser only, read-only), `selenium` (code writing, no browser/shell),
      `test` (mvn + auto-fix, hard 3-attempt limit), `inspector` (Playwright codegen
      recording, translated to AGENTS.md login flow / selenium steps). Built-in `plan`
      agent disabled in `opencode.json`; `build` kept unrestricted for setup/git. All
      agents share one session (Tab-switch), so phase results hand over automatically;
      per-phase tool restriction keeps `mistral-small-4-119b`'s context and choices
      small.
- [x] Researched `references/oblique-components.md` and `references/design-tokens.md`
      (see section 9.3) — still marked unverified/needs-review in-file since it's
      compiled from public docs, not hand-tested against a real Oblique app.

