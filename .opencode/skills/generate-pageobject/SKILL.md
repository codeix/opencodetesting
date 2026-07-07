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
3. Write one `src/test/java/pages/<Name>Page.java` class: `@FindBy`-annotated fields
   plus action methods only (no assertions here). No `Thread.sleep` — rely on
   Selenium's built-in waits.
4. Pull any configurable value (base URL, etc.) from `TestConfig` — never hardcode it.
5. Keep the class scoped to this scenario's elements/actions; don't pre-build unrelated
   methods "for later."

## Output
Java code only — one compilable class, no explanation text, no markdown commentary
around the code block.
