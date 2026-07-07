---
name: component-knowledge
description: >
  Static selector/DOM/ARIA reference for Angular Material and Oblique (the Swiss
  federal Ob*-prefixed component library). Use this BEFORE writing any @FindBy
  selector in generate-pageobject, or before referencing a mat-*/ob-* component in
  generate-test or check-typography — never guess a Material-generated ID when this
  file already documents the stable alternative. Not an action to run on its own,
  purely a lookup.
---

# component-knowledge

## Input
None live — this is a static reference, not a tool call. The "input" is whichever
component name(s) appear in the current ARIA/DOM snapshot from `explore-page` (e.g.
`mat-form-field`, `mat-select`, `mat-dialog`, `ob-master-layout`).

## Context budget
Never load the whole reference file into the prompt. Skim `references/oblique-components.md`'s
headers first, then pull in only the section(s) matching the component(s) actually
present — roughly 200-400 tokens per component, not the full file.

## Procedure
1. From the current ARIA/DOM snapshot, list the distinct component types actually
   needed for this scenario (not every component on the page).
2. Open `references/oblique-components.md` and jump straight to the matching header
   for each one.
3. Extract just: recommended selector strategy, selector type, and the "avoid" list
   (unstable Material-generated IDs/classes) for that component.
4. If a component isn't documented there, fall back to generic ARIA-role/label
   conventions and explicitly flag the result as unverified in your output — do not
   silently invent a selector convention.
5. Never choose a selector this file marks as unstable when a documented alternative
   exists.

## Output
One short block per component, plain text:
`component: <name>` / `selector: <the recommended selector>` / `type: data-testid |
aria-label | role | css` / `avoid: <unstable pattern, if any>` / `notes: <caveats>`.
