---
name: check-typography
description: >
  Generates a purely deterministic Selenium assertion (getCssValue font-family/
  font-size vs. a static design-tokens reference) tagged @Tag("typography-check"). Use
  ONLY when the scenario explicitly asks for a font/typography/design check — not for
  every generated test. No AI or vision call happens at test runtime; this skill only
  runs at generation time.
---

# check-typography

## Input
The element selector(s) already known from the page object, plus the element's type
(heading/body/button/etc.) to check.

## Context budget
Only the `references/design-tokens.md` lines for the given element type (~100-200
tokens) — never load the whole tokens file.

## Procedure
1. Look up the expected font-family/font-size for the element type in
   `references/design-tokens.md`.
2. Generate a JUnit method tagged `@Tag("typography-check")` that reads
   `getCssValue("font-family")`/`getCssValue("font-size")` on the known selector.
3. Compare against the fixed expected value as a Java constant — never call any
   AI/vision API at runtime; the finished test must run with no model access.
4. Add the method to the existing test class via `edit-test` rather than creating a
   new file, unless no test class exists yet for that page.
5. Leave sampling/scheduling (which runs get this tag, how often) to the JUnit tag
   mechanism alone — this skill only writes the assertion, not the trigger schedule.

## Output
Java code only — one `@Test @Tag("typography-check")` method, no explanation text.
