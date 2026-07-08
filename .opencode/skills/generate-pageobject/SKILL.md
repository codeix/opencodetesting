---
name: generate-pageobject
description: >
  Generates exactly ONE Java Selenium Page Object class (@FindBy pattern) from an
  ARIA/DOM snapshot produced by explore-page. Use this immediately after
  explore-page for a "new test"/"new page object" request. Do NOT use this to also
  write the test method — that's generate-test's job; never combine the two in one
  call.
---

# generate-pageobject

## Input
The ARIA/DOM snapshot text from `explore-page`, plus selector guidance from
`component-knowledge` for any Material/Oblique components present in that snapshot.

## Context budget
Only the snapshot excerpt for the page/section actually needed for this scenario (not
the whole app), plus the relevant `component-knowledge` lines (~200-400 tokens per
component). Target well under ~1500 tokens of input.

## Procedure
1. From the requested scenario, list only the elements actually needed — not every
   element visible on the page.
2. For each element, look up its component type in `component-knowledge` before
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
3. Write one `src/test/java/pages/<Name>Page.java` class: `@FindBy`-annotated fields
   plus action methods only (no assertions here). No `Thread.sleep` — rely on
   Selenium's built-in waits. **Constructor takes `WebDriver driver` and stores it as
   a field — never `extends BaseTest`.** `BaseTest` is a JUnit lifecycle class
   (`@BeforeEach`/`@AfterEach`, owns the driver's lifecycle) that only test classes
   extend; a page object that extends it is a category error even when it happens to
   compile.
4. Pull any configurable value (base URL, etc.) from `TestConfig` — never hardcode it.
5. Keep the class scoped to this scenario's elements/actions; don't pre-build unrelated
   methods "for later."

## Output
Java code only — one compilable class, no explanation text, no markdown commentary
around the code block.
