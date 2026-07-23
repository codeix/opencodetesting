---
name: edit-test
description: >
  Applies a targeted change to an EXISTING page object or test class, given only the
  affected method/class excerpt — never the whole file. Used by the "selenium" agent
  once it has proposed its plan and the developer has approved it, for "change/fix/
  update this test" cases instead of regenerating from scratch with
  generate-pageobject/generate-test. Always run validate-test after applying the edit.
---

# edit-test

## Input
The affected method or class excerpt (under 80 lines) from an existing page
object/test, plus a plain-language change request.

## Context budget
The excerpt only — never the whole file unless it's already under 80 lines. No DOM
snapshot unless the change needs a selector that isn't already known, in which case
fall back to `explore-page` for just that one element (not a full re-crawl).

## Procedure
1. Parse the change request against the given excerpt only.
2. If a new selector is needed, call `explore-page` (targeted) and
   `component-knowledge` for just that element — don't re-explore the whole page.
3. Apply the minimal edit; do not rewrite unrelated methods/fields in the excerpt.
4. Preserve existing method signatures used elsewhere unless the request explicitly
   asks to change them (a signature change can break other tests using this page
   object).
5. Hand the updated excerpt to `validate-test` before considering the edit done.

## Output
The updated excerpt only, same scope as the input — Java code, no explanation text.
