---
name: generate-pageobject
description: >
  Generates exactly ONE Java Selenium Page Object class (@FindBy pattern) from the
  ARIA/DOM snapshots gathered while exploring a finalized `ai/scenario/<name>.md`.
  Used by the "selenium" agent once a scenario is ready. Do NOT use this to also
  write the test method — that's generate-test's job; never combine the two in one
  call.
---

# generate-pageobject

## Input
The finalized `ai/scenario/<name>.md` steps, plus the ARIA/DOM snapshot text from
`explore-page` calls made while that scenario was built, plus selector guidance from
`component-knowledge` for any Material/Oblique components present in that snapshot.

## Context budget
Only the snapshot excerpt for the page/section actually needed for this scenario (not
the whole app), plus the relevant `component-knowledge` lines (~200-400 tokens per
component). Target well under ~1500 tokens of input.

## Procedure
1. **Check `src/test/java/pages/` for an existing page object covering this page
   first.** If one already exists, add the new method(s) to it instead of creating a
   duplicate class — match its existing field/method naming and structure. Only
   create a new file if no existing page object covers this page.
2. From the requested scenario, list only the elements actually needed — not every
   element visible on the page.
3. For each element, look up its component type in `component-knowledge` before
   picking a selector; prefer `data-testid`/ARIA label over a Material-generated ID.
   **Translate, don't copy:** the exploration snapshot/selectors come from
   Playwright (`role=...`, `>>` chaining, `:has-text()`) — none of that syntax
   exists in Selenium's `@FindBy`/`By.cssSelector`. Convert each one:
   - A plain attribute/role match (`role=button[name="Overview"]` on an element
     that actually has that attribute) → CSS attribute selector, e.g.
     `@FindBy(css = "button[title='Overview']")` (verified pattern: Material
     icon-only buttons often carry the accessible name in `title`, not
     `aria-label` — check the real attribute in the snapshot, don't guess which
     one is present).
   - Any selector scoped by visible/cell text (Playwright's `:has-text()`, which
     has no CSS equivalent) → XPath, e.g.
     `@FindBy(xpath = "//mat-row[.//mat-cell[text()='APP-2024-001']]//button[@title='Overview']")`.
     Swap `mat-row`/`mat-cell` for `tr`/`td` if the page uses the native `<table
     mat-table>` shape instead (see `component-knowledge`).
   - **Never write `:contains(...)` in a `@FindBy(css = ...)`.** It's a
     jQuery/Sizzle pseudo-class, not real CSS — Selenium's CSS engine is the
     browser's native `querySelector`, which throws `InvalidSelectorException` at
     runtime on it (compiles fine, fails only when the test actually runs). Any
     text-based match is XPath, never CSS: `//button[normalize-space()='Cancel']`.
4. Write the class (new) or the added method(s) (existing, per step 1):
   `src/test/java/pages/<Name>Page.java`, `@FindBy`-annotated fields plus action
   methods only (no assertions here). No `Thread.sleep` — rely on Selenium's
   built-in waits. **Constructor takes `WebDriver driver` and stores it as a field —
   never `extends BaseTest`.** `BaseTest` is a JUnit lifecycle class
   (`@BeforeEach`/`@AfterEach`, owns the driver's lifecycle) that only test classes
   extend; a page object that extends it is a category error even when it happens to
   compile.
5. Pull any configurable value (base URL, etc.) from `TestConfig` — never hardcode it.
6. Keep new methods/fields scoped to this scenario's elements/actions; don't
   pre-build unrelated methods "for later," and don't touch existing methods beyond
   what step 1 called for.

## Output
Java code only — one compilable class, no explanation text, no markdown commentary
around the code block.
