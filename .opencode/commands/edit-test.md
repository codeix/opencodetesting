---
description: Apply a targeted change to an existing Java test/page object, then re-validate. Usage: /edit-test <path/to/File.java> "<change request>"
agent: build
---

Run the "edit test" skill chain for the request below:

1. **edit-test** — apply the change to the affected method/class excerpt only (not the
   whole file). If a new selector is needed that isn't already known, use a targeted
   `explore-page` call for just that element plus `component-knowledge`, instead of
   re-exploring the whole page.
2. **validate-test** — compile/run the result. On failure, apply one targeted fix and
   retry — up to 3 attempts total — then stop and report the error instead of looping
   forever.

File to edit: $1

Change request: $2
