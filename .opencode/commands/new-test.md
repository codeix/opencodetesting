---
description: Generate a new Java/Selenium test end-to-end (explore -> page object -> test -> validate) for a URL and scenario. Usage: /new-test <url> "<scenario>"
agent: build
---

Run the full "new test" skill chain autonomously for the request below, without asking
for confirmation between steps (only stop early if genuinely blocked, e.g. login
required but no flow is recorded in AGENTS.md):

1. **explore-page** — navigate to the target URL and capture its ARIA snapshot. Only
   take a cropped screenshot if a specific element is genuinely ambiguous from the
   snapshot text alone.
2. **generate-pageobject** — build one Page Object Java class from that snapshot,
   consulting `component-knowledge` for any Material/Oblique (`mat-*`/`ob-*`)
   selectors.
3. **generate-test** — write one JUnit 5 test method implementing the scenario below,
   using only methods that exist on the page object from step 2.
4. **validate-test** — compile/run the result. On failure, apply one targeted fix via
   `generate-test` and retry — up to 3 attempts total — then stop and report the error
   instead of looping forever.

Target URL: $1

Scenario: $2
