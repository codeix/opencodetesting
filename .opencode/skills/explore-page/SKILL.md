---
name: explore-page
description: >
  Drives the playwright-explore tool to open a URL and capture its ARIA snapshot as
  text (and, rarely, a cropped screenshot). Used by the "explore" agent for each
  individual step of an interactive scenario-building session — never guess a page's
  structure from memory or from HTML you weren't given. Also use for a small,
  targeted re-check when edit-test needs one new selector that isn't already known.
---

# explore-page

## Input
A target URL (or "continue on the current page" if already navigated), plus the login
flow steps from the testproject's `ai/learnings` ("Login flow" section) if the target
page requires authentication.

## Context budget
Only the ARIA snapshot text goes into context — never raw HTML, never a full-page
screenshot. At most one cropped screenshot per exploration, and only when a specific
element's purpose is genuinely unclear from the ARIA tree; hand its file path (not
image data) to the `vision` sub-agent for that one question.

## Procedure
1. Call the `playwright-explore` tool with `action: "goto"` and the target URL. Resolve
   any `$SECRET:NAME` placeholder only inside the tool call, never write the real
   secret value into the prompt yourself.
2. If the page requires login, replay the exact fill/click steps recorded in the
   testproject's `ai/learnings` ("Login flow" section) before snapshotting — do not
   invent a login flow.
3. Call `action: "snapshot"` and capture the returned ARIA tree text verbatim.
4. Only if one specific element's role/purpose stays ambiguous after reading the
   snapshot, call `action: "screenshot"` with a tight `clip` region around just that
   element, then ask the `vision` sub-agent one specific question about it.
5. Return the ARIA snapshot text verbatim to the calling agent — do not summarize,
   reformat, or drop structural detail from it. The "explore" agent uses it to confirm
   the current step with the developer before persisting it via the `scenario`
   sub-agent; it is not forwarded straight to `generate-pageobject`.

## Output
The ARIA snapshot as plain text (verbatim tool output), plus an optional screenshot
file path and the `vision` sub-agent's 1-3 sentence answer if step 4 was needed.
