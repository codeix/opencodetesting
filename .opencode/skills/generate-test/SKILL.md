---
name: generate-test
description: >
  Generates exactly ONE JUnit 5 test class/method from a page object (from
  generate-pageobject) plus the finalized `ai/scenario/<name>.md` numbered steps. Use
  this right after generate-pageobject — one skill call per test method, never
  a whole suite in one call. Do NOT invent new selectors here; if a needed action is
  missing from the page object, that goes back through generate-pageobject instead.
---

# generate-test

## Input
The page object's public method signatures (excerpt, not necessarily the whole file
unless it's already under 80 lines) plus the finalized `ai/scenario/<name>.md`
numbered steps (the ordered actions and expected outcomes to assert).

## Context budget
Page object excerpt (signatures only where possible) + the scenario text. No DOM
snapshot needed for this skill.

## Procedure
1. **Check `src/test/java/tests/` for an existing test class covering this feature
   first.** If one already exists, add the new method to it instead of creating a
   duplicate file — match its existing style and imports. Only create a new file if
   no existing test class covers this feature.
2. Map each step of the scenario to an existing page object method only.
3. If a needed action has no matching page object method, do NOT invent a selector —
   note it as a TODO in the output and let the chain loop back to
   `generate-pageobject` for that element.
4. Write the method (new file or added to the existing class, per step 1): one
   `src/test/java/tests/<Name>Test.java` JUnit 5 method, arrange-act-assert style.
5. Pull all config/test data from `TestConfig`/`config/test.properties` — never a
   literal base URL, username, etc.
6. No `Thread.sleep` — the page object already encapsulates the necessary waits.

## Output
Java code only — one test class with one (or a few tightly related) test method(s), no
explanation text.
