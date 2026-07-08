# PLAN.md — AI-Powered Test Generator (OpenCode + Devstral/Ministral + Java/Selenium)

This document is the **build plan** for the project. It describes the architecture and
defines how every single `SKILL.md` must look, so the agent (Devstral as the text/code
model, Ministral-3:3b only for visual follow-up questions) can work independently
without blowing the small AI's context window.

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
- Small, local models (Devstral for code, Ministral-3:3b for images) have a limited context
  window → every skill must be scoped so a single call stays small and focused.
- Multi-step tasks (analysis → page object → test → validation) are planned
  **autonomously** by the agent as a chain of skill calls.
- Developers can later have existing tests edited in a targeted way, without
  regenerating everything (versioning via Git commits, no custom versioning system).

---

## 2. Folder Structure

```
project/
├── bootstrap.sh                       # sets up ONLY the local project (npm, Playwright, config) — no sudo
├── bootstrap.config.example           # template to pre-fill (optional, instead of interactive prompts)
├── .tools/                            # LOCAL ONLY, gitignored: secrets.env (no Ollama — runs separately!)
├── .gitignore                        # must include .tools/ and *.env
├── opencode.json                     # connection to the external model server via a "local" provider block, permissions, MCP servers (if used)
├── AGENTS.md                         # project rules, conventions, reference to PLAN.md
├── docs/
│   └── PLAN.md                       # this document
├── .opencode/
│   ├── package.json                  # npm dependency "playwright" for the custom tool
│   ├── skills/
│   │   ├── component-knowledge/SKILL.md
│   │   ├── explore-page/SKILL.md
│   │   ├── generate-pageobject/SKILL.md
│   │   ├── generate-test/SKILL.md
│   │   ├── validate-test/SKILL.md
│   │   ├── edit-test/SKILL.md
│   │   ├── check-typography/SKILL.md
│   │   └── setup-java-skeleton/SKILL.md   # one-time: pom.xml, TestConfig, BaseTest, folders (verbatim templates)
│   ├── tools/
│   │   └── playwright-explore.ts     # custom tool: drives the browser, returns ARIA snapshot + screenshot path
│   ├── agents/
│   │   ├── vision.md                 # sub-agent that uses Ministral-3:3b (only for screenshots)
│   │   ├── explore.md                # primary agent, phase 1: browser exploration (read-only)
│   │   ├── selenium.md               # primary agent, phase 2: write page objects + tests (no browser/shell)
│   │   ├── test.md                   # primary agent, phase 3: mvn run + auto-fix (max 3 attempts)
│   │   └── inspector.md              # primary agent: Playwright codegen recording + translation
│   └── commands/
│       ├── new-test.md               # /new-test <url> <scenario>
│       └── edit-test.md              # /edit-test <test-file> <change>
├── src/test/java/
│   ├── pages/                        # generated page objects
│   └── tests/                        # generated test classes
├── config/
│   └── test.properties               # base URL, test user, environments (never hardcoded!)
└── pom.xml                           # Maven skeleton: Selenium, JUnit, WebDriverManager
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
  DOM/accessibility snapshot (text) first. Only use Ministral-3:3b/images when the skill
  explicitly needs a "visual follow-up question" (e.g. ambiguous layout). Crop the
  screenshot to the relevant area then, not the full page.
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
| 2 | `generate-pageobject` | DOM snapshot + lookup in `component-knowledge` | Java page object class | Devstral |
| 3 | `generate-test` | Page object class + test scenario | Java test class (JUnit) | Devstral |
| 4 | `validate-test` | Test class + page object | `mvn test-compile`/run result, on error: error message | no LLM (only for a fix suggestion: Devstral) |
| 5 | `edit-test` | existing file (excerpt) + change request | updated excerpt | Devstral |

**Autonomous iteration planning:** The agent chains 1→2→3→4 automatically for "new
test" requests. On validation failures it jumps back to step 3 (max. 3 attempts), then
aborts with an error report to the developer instead of looping forever.

### 4.1 Special case: `component-knowledge` as a pre-prepared knowledge skill

The application uses Angular Material and, built on top of it, **Oblique**
(https://oblique.bit.admin.ch, the Swiss federal library of Angular components with an
`Ob*` prefix). The small, local model (Devstral) cannot research these libraries
itself — it has no internet access and too small a context window to read the docs
every time.

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
- `args.action`: `goto | snapshot | screenshot | click | fill`
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
  (`bootstrap.config` → `config/test.properties`, see section 5) — the login *flow*
  (selectors/clicks) is separate from that and needs no secret handling, only the
  credentials themselves (see the next open item).

This removes what was previously assessed as a complex login/auth architecture — the
only remaining question is **how the test password is securely passed into this flow**
without ending up in the prompt to Devstral/Ministral-3:3b or in plaintext in the repo.
That is the subject of the next planning step: secrets handling.

---

## 5. Bootstrap (local project only, model server runs separately)

**Problem:** So far there is no step that sets up a new project once. `pom.xml`,
`config/test.properties`, `.opencode/package.json`, and Playwright browsers would
otherwise have to be prepared by hand — that contradicts the "usable out of the box"
goal.

**Important boundary:** Ollama with Devstral/Ministral-3:3b runs on its **own, separate
server** (see section 7) and is **not** installed, started, or managed by
`bootstrap.sh`. `bootstrap.sh` concerns only the local project (this repo) and assumes
the model server is already running and reachable.

**Solution:** `bootstrap.sh` in the project root. Runs once (or again as needed) and
installs **everything project-local, no sudo, no system changes**:

| Step | Does what | Where? |
|---|---|---|
| 1 | Generate project configuration (base URL, login, model server address) | `config/test.properties` |
| 2 | Health check: is the external model server reachable? (no abort, just a warning) | — |
| 3 | Install npm dependencies | `.opencode/node_modules/` |
| 4 | Install Playwright browsers (`PLAYWRIGHT_BROWSERS_PATH=0`) | `.opencode/node_modules/` instead of `~/.cache` |

No step needs root privileges or changes anything outside the project folder.

### 5.1 Configuration: File AND interactive (both)

- If `bootstrap.config` exists in the project root → values are taken from it.
- If the file or individual values are missing → asked interactively (base URL,
  whether login is needed, test username, **external model server address**).
- `bootstrap.config.example` is included as a template in the repo, so it can be copied
  and pre-filled if desired, instead of answering interactively every time.
- **No password** ends up in `bootstrap.config` or `test.properties` — see section 6
  (secrets handling).

### 5.2 Open Items for Bootstrap
- [ ] What happens if `.opencode/package.json` (custom tool) doesn't exist yet at
      bootstrap time? Currently: the step is skipped, no abort — reasonable, but the
      user shouldn't miss this (a clearer warning may be needed).
- [ ] Should `bootstrap.sh` also check whether `java`/`mvn` (or the Maven wrapper) are
      present? Not included currently.
- [ ] The health check against the model server only checks whether *anything*
      responds (`curl`), not whether Ollama is running correctly or the right models
      are loaded — may need refining later (e.g. querying `/api/tags`).

---

## 6. Secrets Handling

**Goal:** The test password must never be sent in plaintext to Devstral/Ministral-3:3b, must
never end up in the repo, but must still be automatically available — both during
AI-assisted exploration (login via Playwright) and in the final, self-contained
Selenium test.

**Core idea:** The AI must never *see* the password — it only needs to know that "the
test password" belongs at a given spot, not what its value is. Resolving the actual
value happens outside the prompt, in code that already has filesystem access anyway.

### 6.1 Two Separate Places Where the Password Is Needed

| Point in time | Who needs the password | How it's resolved | Does the AI see the value? |
|---|---|---|---|
| **Generation** (Playwright logs in to explore authenticated pages) | `.opencode/tools/playwright-explore.ts` (custom tool) | The tool only gets a placeholder from the AI (e.g. `"$SECRET:TEST_PASSWORD"`) as the `fill` value, and resolves it itself from a local, non-versioned secrets file | **No** — placeholder in the prompt, real value only in the tool code |
| **Runtime** (the finished Selenium test logs in) | Java base class (`BaseTest`) | Reads the password itself at runtime from an environment variable/local properties file, never as a literal in the generated `.java` code | **No** — `generate-test` is instructed to always write `TestConfig.get("test.password")`, never the value itself |

### 6.2 Where the Password Actually Lives

- New, **non-versioned** file: `.tools/secrets.env` (analogous to the `.tools/` folder
  from bootstrap — already gitignored).
- `bootstrap.sh` asks for the password **silently** (`read -rsp`, no terminal echo) and
  writes it exclusively there, with restrictive file permissions (`chmod 600`) —
  **not** into `config/test.properties` (which stays commit-friendly, without secrets).
- The project root `.gitignore` must include `.tools/` (and explicitly `*.env` too), so
  nothing gets checked in even by accidental copying.

### 6.3 Placeholder Convention (draft)

- When defining the login flow once (section 4.3), the developer does not write the
  real password into the login note, but the placeholder, e.g.:
  `fill(passwordField, "$SECRET:TEST_PASSWORD")`.
- Both the custom tool (at generation time) and `TestConfig` in Java (at runtime)
  recognize the same naming scheme (`TEST_PASSWORD`) and resolve it from their
  respective local source (`.tools/secrets.env` or an environment variable/its own
  properties file for the CI/runtime environment).
- Tool output (the return value of `fill`) never returns the resolved value (e.g. just
  `"filled"`), so the password can't reappear in the context via a detour through the
  tool response either.

### 6.4 Open Items
- [ ] Define the exact syntax of the placeholder convention (currently only a draft:
      `$SECRET:NAME`)
- [ ] How does `.tools/secrets.env` get populated in a CI environment (no interactive
      `bootstrap.sh` possible) — presumably via the CI's own secret variables, still
      open
- [ ] Check/decide: should `validate-test` (section 4) automatically check for
      accidentally hardcoded passwords in generated Java code (a simple grep as an
      extra safety net)?
- [ ] Clarify whether the ARIA snapshot after a successful login could accidentally
      contain sensitive data (e.g. a displayed real username), and whether that's
      uncritical for the prompt to Devstral (test users are usually fake data, but this
      isn't automatically checked)

---

## 7. Model Connection (Devstral Small 2 + Ministral-3:3b on 2× RTX 3060 12GB)

**Scope note:** Everything in this section concerns the **separate model server**, not
the project repo or `bootstrap.sh` (see section 5). This section merely documents which
models/configuration make sense there, so the decision stays traceable — `bootstrap.sh`
does not install or manage any of it; it only connects to it via the configured
`MODEL_SERVER_URL`.

**Hardware:** 2× RTX 3060, 12 GB VRAM each → 24 GB combined.

**Model server address:** `http://sriolo-desktop.local:11434` — this is the value that
goes into `bootstrap.config` as `MODEL_SERVER_URL` (section 5.1) and into `opencode.json`
(section 7.3).

**Correction from an earlier planning version:** Initially calculated using numbers
from the older Devstral generation (24B, ~20 GB at Q4). What's actually used is
**Devstral Small 2** (official Ollama tag `devstral-small-2`, also 24B, but a newer
generation) — already running on the separate server according to feedback. Needs only
**~14–15 GB** at Q4_K_M, notably less than assumed. Requires Ollama **0.13.3 or
newer**.

**Second correction:** The vision role is filled by **Ministral-3:3b** (Ollama tag
`ministral-3:3b`), not Pixtral — confirmed working for image description by direct
local testing. At 3B parameters it needs only a few GB of VRAM, far less than the
12B Pixtral figure this section originally assumed. This changes the VRAM math in
7.1/7.2 below: the two models together no longer come close to the 24 GB combined
limit.

**Realistic VRAM requirement (Q4 quantization):**

| Model | Ollama tag | Parameters | VRAM at Q4 (approx.) | Fits on 1× 12GB? |
|---|---|---|---|---|
| Devstral Small 2 | `devstral-small-2` (or `devstral-small-2:24b`) | 24B | ~14–15 GB | No, but notably closer to fitting than previously assumed |
| Ministral-3:3b | `ministral-3:3b` | 3B | ~2–3 GB (literature estimate, not yet measured with `nvidia-smi`) | Yes, comfortably |

### 7.1 Ministral-3:3b Tag

**Tag:** `ollama pull ministral-3:3b`. Already pulled and tested locally per feedback —
image description works. No fallback tag needed (unlike the old Pixtral plan, which had
a documented `mmproj` risk on some Ollama builds); no such issue reported here.

**VRAM headroom consequence:** Devstral (~14–15 GB) + Ministral-3:3b (~2–3 GB) ≈ 17–18 GB
combined — comfortably under the 24 GB pool, with real headroom for KV cache/overhead.
This is a materially different situation from the original Pixtral-based plan, where
both models together sat right at the 24 GB ceiling.

### 7.2 Chosen Approach: One Shared Ollama Server, Dynamic Loading

Instead of fixed GPU allocation: **a single Ollama server** that sees both GPUs as one
shared 24 GB pool.
- Devstral is loaded on demand and automatically split across both cards
  (Ollama/llama.cpp split large models across multiple GPUs on their own).
- Ministral-3:3b is only loaded on demand (vision sub-agent, used per the plan only for
  rare visual follow-up questions anyway — see section 4.1).
- Since the skill flow is inherently **sequential** (one skill = one task, see section
  3.3), both models almost never need to be loaded at the same time regardless.
- **Revised from the original Pixtral-based plan:** because combined VRAM usage
  (~17–18 GB) now sits well under the 24 GB pool with headroom to spare (see 7.1),
  forcing `OLLAMA_MAX_LOADED_MODELS=1` to prevent overflow is **no longer strictly
  required** the way it was with Pixtral. It's still a reasonable default for
  simplicity/predictability (avoids surprising interactions between two models'
  KV caches), but it's now a choice rather than a VRAM-safety necessity. Leave it
  set unless the load/unload delay on vision calls becomes annoying in practice —
  in that case both models can simply be left resident.
- Context window can stay at a normal size (`OLLAMA_CONTEXT_LENGTH`, if supported by the
  installed Ollama version — TODO check) rather than being aggressively capped purely
  for VRAM safety; the context budget rules (section 3.3) still apply for other reasons
  (skill design, latency), independent of this VRAM headroom. This is configuration on
  the separate server, not in the project repo.

**Trade-off of this approach:** If `OLLAMA_MAX_LOADED_MODELS=1` is kept, switching
between Devstral and Ministral-3:3b usage causes a short load delay (model gets
unloaded/reloaded). That's acceptable because vision calls are rare per the plan anyway.
With the VRAM headroom now available, this trade-off is optional rather than forced.

### 7.3 `opencode.json` — Connecting to the External Model Server

**Verified against the current OpenCode docs** (this resolves the two TODOs that used
to be here — the earlier `LOCAL_ENDPOINT`/`local.<model>` dot-notation draft was
guessed from a doc fragment and was wrong; the real mechanism is a `provider` block
using the `@ai-sdk/openai-compatible` adapter, with models referenced as
`provider-id/model-id`, not `local.<model>`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local Ollama (Devstral + Ministral)",
      "options": {
        "baseURL": "http://sriolo-desktop.local:11434/v1"
      },
      "models": {
        "devstral-small-2": { "name": "Devstral Small 2" },
        "ministral-3:3b": { "name": "Ministral-3:3b" }
      }
    }
  },
  "model": "local/devstral-small-2",
  "agent": {
    "vision": {
      "mode": "subagent",
      "model": "local/ministral-3:3b",
      "description": "Image-analysis sub-agent — only for visual follow-up questions (see component-knowledge, section 4.1)"
    }
  }
}
```

- The provider's `baseURL` is the single place the model server address lives inside
  `opencode.json`. It's the same address stored in `bootstrap.config` as
  `MODEL_SERVER_URL` (see section 5.1): `http://sriolo-desktop.local:11434`.
- **Still open:** `MODEL_SERVER_URL` from `bootstrap.config`/`test.properties` is not
  automatically wired into `opencode.json`'s `baseURL` — currently two separate storage
  locations with no coupling. Either accept the duplication (both must be kept in sync
  by hand when the server address changes), or have `bootstrap.sh` template/rewrite
  `opencode.json`'s `baseURL` from `MODEL_SERVER_URL` as an extra step. Not yet decided.

### 7.4 Open Items
- [x] Devstral model name corrected: `devstral-small-2` (24B, newer generation),
      already running locally per feedback — VRAM estimate corrected downward from
      ~20 GB to ~14–15 GB (see the top of this section).
- [x] Vision model corrected: Ministral-3:3b (`ministral-3:3b`) replaces Pixtral —
      confirmed working for image description by direct local testing. VRAM estimate
      (~2–3 GB) is much lower than Pixtral's (~9–10 GB), which relaxes the shared-pool
      VRAM constraint in 7.1/7.2.
- [ ] VRAM numbers (~14–15 GB / ~2–3 GB) are still literature/estimate values —
      cross-check with `nvidia-smi` during a real run on the actual hardware, even
      though both models are already demonstrably running.
- [ ] Check Ollama version: `devstral-small-2` needs **Ollama 0.13.3+** — make sure
      `bootstrap.sh` loads a sufficiently current version (currently no version check
      in the script).
- [x] Runtime context window verified on the live server (2026-07-08 via `/api/ps`):
      both `devstral-small-2` and `ministral-3:3b` run with **65,536 tokens**. Declared
      as `limit: { context: 65536 }` per model in `opencode.json` so opencode can track
      usage and auto-compact — without this, Ollama silently truncates the oldest
      tokens with no warning to the client. Re-check `/api/ps` if the server's
      `OLLAMA_CONTEXT_LENGTH`/Modelfile `num_ctx` ever changes, and keep the two in sync.
- [x] Verified the real `opencode.json` provider syntax against current OpenCode docs
      (section 7.3) — it's a `provider` block using `@ai-sdk/openai-compatible` with
      `provider-id/model-id` references, not the guessed `LOCAL_ENDPOINT`/`local.*`
      dot-notation. `opencode.json` now written with this real syntax.
- [ ] If Devstral at Q4 turns out too tight (e.g. for longer contexts/multi-file
      edits): evaluate falling back to a more heavily compressed quantization
      (Q3_K_M) — a quality trade-off, not yet tested. Less urgent now that
      Ministral-3:3b's small footprint leaves more headroom overall.

---

## 8. Java Project Conventions (apply to all generated files)

- Page objects: `src/test/java/pages/<Name>Page.java`, `@FindBy` selectors from the DOM
  snapshot, no hardcoded waits (`Thread.sleep`).
- Tests: `src/test/java/tests/<Name>Test.java`, JUnit 5, one test case = one method.
- Configuration (base URL, test data, environment) **always** comes from
  `config/test.properties`, never hardcoded in generated code.
- Every generation ends with `validate-test` before it counts as "done".

---

## 9. Editing Existing Tests

- No custom versioning format — every generation/edit is a Git commit.
- `edit-test` only gets the affected excerpt (method/class), not the whole repo, to
  keep the context small.
- Before every edit: run `validate-test` again, so errors don't slip in unnoticed.

---

## 10. Occasional Typography Check

In addition to the functional tests, the test suites should **occasionally** be able to
check font family and font size.

**Important constraint:** The finished Selenium test runs independently, with no access
to Ministral-3:3b or any AI at runtime — AI (Devstral/Ministral-3:3b) is only used during
the **generation** of the test, not during its **execution**. A layout check that would
send a screenshot to Ministral-3:3b at runtime is therefore ruled out for now and will
**not** be implemented. If that's wanted later (e.g. via a separate analysis step outside
the Selenium test), it would need to be architecturally rethought — outside scope for now.

### 10.1 What Remains: `check-typography` (purely deterministic, no AI access at runtime)

| Check | Method | Skill | Runs at runtime? |
|---|---|---|---|
| Font family / font size | Selenium `getCssValue("font-family"/"font-size")` against expected values from a static reference file | `check-typography` | Yes — pure Java/Selenium, no LLM call needed |

`check-typography` needs a reference with expected design tokens (font family, size
tiers per element type such as heading/body text/button) — analogous to the
`component-knowledge` skill, as another pre-prepared reference file
(`references/design-tokens.md`, researched once by Claude, currently still
TODO/unverified). This reference is only read during the **generation** of the test (by
Devstral), not at runtime — the generated test itself ends up with only fixed expected
values (e.g. as constants or in `config/test.properties`), no call to an AI.

### 10.2 Trigger Mechanism for "Occasional"

- Test methods get their own JUnit tag, e.g. `@Tag("typography-check")`.
- This tag does **not** run on every normal functional test pass, but instead:
  - either at a fixed sampling rate (e.g. only every nth run),
  - or as a separate, infrequently running job (e.g. nightly),
  - or targeted only at new/changed pages.
- The exact trigger rule (rate, schedule, which pages) is still open and will only be
  decided during the implementation phase.

### 10.3 Open Items
- [ ] Create `references/design-tokens.md` (font family/sizes from the Oblique docs,
      currently unverified — same limitation as `oblique-components.md`)
- [ ] Define a sampling/scheduling strategy for the `typography-check` tag
- [ ] Clarify whether/how layout errors (overlap, alignment) could be checked without
      AI at runtime (e.g. purely geometrically via Selenium element
      coordinates/sizes, without image analysis) — a separate, still open topic, no
      Ministral-3:3b use at runtime

---

## 11. Open Items / Next Steps (overall)

- [x] `bootstrap.sh` decoupled from Ollama — now only sets up the local project
      (config, health check against the external server, npm, Playwright). Ollama/models
      run entirely separately, see section 5.
- [ ] Test `bootstrap.sh` against real systems (Linux + macOS) — see section 5.2
- [x] `bootstrap.sh` extended: ask for the password silently (`read -rsp`) and write it
      to `.tools/secrets.env` (see section 6.2) — implemented, not yet tested
- [x] `.gitignore` created (`.tools/`, `*.env`, `bootstrap.config`) — see section 6.2
- [ ] Finalize the placeholder convention `$SECRET:NAME` (section 6.3) — not yet
      implemented in the custom tool (`playwright-explore.ts`), only specified
- [x] Model connection specified (on the separate server): shared Ollama pool,
      `OLLAMA_MAX_LOADED_MODELS=1` (now optional rather than required, see 7.2),
      Devstral+Ministral-3:3b tags nailed down, model server at
      `http://sriolo-desktop.local:11434` — see section 7. VRAM numbers not yet
      verified on real hardware (section 7.4).
- [x] Written the real `opencode.json` (verified `provider`/`@ai-sdk/openai-compatible`
      syntax against the docs) — see section 7.3. Coupling to `MODEL_SERVER_URL` from
      `bootstrap.config` still not automatic (manual sync for now).
- [x] Built `.opencode/tools/playwright-explore.ts` (singleton browser, ARIA snapshot,
      screenshot path instead of base64, incl. secret placeholder resolution) — see
      4.2 + 6.3. Folder corrected to `tools/` (plural) — verified against the installed
      OpenCode binary, the earlier `tool/` (singular) in this plan was wrong.
- [x] Decided: custom tool (not the ready-made Playwright MCP server) — implemented in
      `.opencode/tools/playwright-explore.ts`, see section 4.2.
- [x] `pom.xml` skeleton + `TestConfig`/`BaseTest` design: NOT pre-built into the repo —
      by decision (2026-07-07) this is the agent's own job. A new skill
      `.opencode/skills/setup-java-skeleton/SKILL.md` contains the complete verbatim
      templates (pom.xml with Selenium 4 + JUnit 5 + WebDriverManager, TestConfig with
      env/`.tools/secrets.env` secret resolution, BaseTest) and is run once per project
      before the first generation, or when `validate-test` finds them missing.
- [x] Wrote all skill files, including `explore-page` and `check-typography` (see
      section 10) — see `.opencode/skills/`.
- [x] Phase-specific primary agents added (2026-07-08, decision by the developer):
      `explore` (browser only, read-only), `selenium` (code writing, no browser/shell),
      `test` (mvn + auto-fix, hard 3-attempt limit), `inspector` (Playwright codegen
      recording, translated to AGENTS.md login flow / selenium steps). Built-in `plan`
      agent disabled in `opencode.json`; `build` kept unrestricted for setup/git. All
      agents share one session (Tab-switch), so phase results hand over automatically;
      per-phase tool restriction keeps Devstral's context and choices small.
- [x] Researched `references/oblique-components.md` and `references/design-tokens.md`
      (see section 10.3) — still marked unverified/needs-review in-file since it's
      compiled from public docs, not hand-tested against a real Oblique app.

