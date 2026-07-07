# Angular Material & Oblique — Component Reference

Static reference for the `component-knowledge` skill. Read only the section(s) for the
component(s) actually present in the current ARIA/DOM snapshot — do not load this
whole file into a prompt at once (see `.opencode/skills/component-knowledge/SKILL.md`).

**Sources & version pinning:**
- Oblique entries below were verified directly against source (`@Component`/
  `@Directive` decorators) in the `oblique-bit/oblique` GitHub repo, `master` branch,
  `projects/oblique` package version **15.4.0** (checked 2026-07-07). Re-verify if the
  project's installed `@oblique/oblique` version differs meaningfully.
- Angular Material entries reflect long-standing, version-stable public API/DOM
  conventions (documented Material behavior, not tied to one specific release).
- **TODO / unverified:** several Oblique modules exist but aren't covered below yet —
  `authentication`, `column-layout`, `nav-tree`, `nested-form`, `off-canvas`,
  `paginator`, `popover`, `selectable`, `spinner`, `stepper`, `autocomplete`,
  `datepicker`, `collapse`. Their component files weren't found at the guessed path
  during research (flat `<folder>/<folder>.component.ts` doesn't hold for all of
  them — some live in nested folders like `master-layout` does). Check source directly
  before relying on a selector for these; do not guess.

---

## Angular Material

Material generates internal IDs/classes (`mat-select-0`, `mat-checkbox-1-input`,
`cdk-describedby-message-N`, etc.) that are **not stable** across renders or app
restarts — the number increments per component instance in DOM order. Never key a
`@FindBy` on one of these. Prefer, in order: an explicit `data-testid` the app adds
itself, an ARIA role/label, or a stable structural CSS class Material always applies
(not a numbered one).

| Component | Host element / structural marker | Recommended selector | Avoid |
|---|---|---|---|
| `mat-form-field` | `<mat-form-field>` wraps the actual control | Target the *inner* control (input/select), not the wrapper | Wrapper alone — it doesn't carry the value |
| `mat-input` (`matInput`) | `<input matInput>` | `input[data-testid=...]` or `input[formcontrolname='x']` if the app uses reactive forms | `#mat-input-0`-style generated `id` |
| `mat-select` | `<mat-select>` renders a hidden trigger + an overlay panel appended to `<body>` (not inside the form) | ARIA: `[role='combobox']` with `aria-label`, or `data-testid` on `<mat-select>` itself; for the opened options, `mat-option[role='option']` inside the overlay, matched by visible text | `#mat-select-0`, `#mat-select-0-panel` (regenerated per instance) |
| `mat-checkbox` | renders a nested real `<input type="checkbox">` for the actual state | `input[type='checkbox']` inside the `mat-checkbox` host, or `data-testid` on the host | `#mat-checkbox-1-input` |
| `mat-radio-group` / `mat-radio-button` | similar nested real `<input type="radio">` | same approach as checkbox | generated numbered `id`s |
| `mat-dialog` | Angular CDK appends the dialog to an overlay container, **outside** the triggering component's DOM subtree | `[role='dialog']` (Material sets this) combined with a `data-testid` on the dialog's own root content, or match by the dialog's accessible name (`aria-labelledby`) | positional selectors assuming the dialog is a sibling of the trigger — it isn't |
| `mat-button` / `button[mat-button]` | plain `<button>` with Material directive attributes | `button[data-testid=...]` or match by accessible name (visible text/`aria-label`) | relying on Material's CSS classes (`mat-mdc-button` etc.) — these are styling classes, not stable test hooks |
| `mat-snack-bar` | appended to an overlay container at the bottom of `<body>`, transient | `[role='status']` or `[role='alert']` (Material sets one depending on `politeness`), matched by text, with an explicit wait for appearance | assuming it's inside the page's normal DOM tree near the triggering action |
| `mat-tab-group` | renders `[role='tablist']` / `[role='tab']` / `[role='tabpanel']` | ARIA role + accessible name of the tab | tab index alone (reorderable, fragile) |

General Material rule: **the CDK overlay pattern** (select panels, dialogs, snack bars,
autocomplete panels, menus) means the interactive content is **not a DOM descendant**
of the triggering element — it's appended near `<body>`. Always account for this in the
page object (a separate locator/wait, not a child selector).

---

## Oblique (Ob\*)

### `ob-master-layout`
Root application shell/layout component.
- Selector: `ob-master-layout` (also exported as directive reference `obMasterLayout`).
- Relevant inputs: `navigation` (nav link list), `skipLinks`, `collapseBreakpoint`.
- For page objects: don't target `ob-master-layout` itself as an action target — it's
  a structural container. Target the specific header/nav/footer elements it renders
  (see below).
- **Not yet verified in this file:** the exact selectors for
  `ob-master-layout-header`/`-navigation`/`-footer` sub-components (they live in
  nested folders `master-layout-header/`, `master-layout-navigation/`,
  `master-layout-footer/` under `master-layout/` — file paths not confirmed here).
  Check source before relying on them.

### `ob-alert`
Inline alert/banner message.
- Selector: `ob-alert`.
- Key input: `type` (`'info' | 'success' | 'warning' | 'error'`) — drives the CSS
  class and icon; useful for asserting *which kind* of alert appeared.
- Key input: `hasRoleAlert` — when true (common default use), the host carries
  `role="alert"`, so `[role='alert']` is a solid, stable selector for "wait for an
  alert to appear" without needing a `data-testid`.

### `ob-notification`
Toast-style notification, subscribed to a named channel.
- Selector: `ob-notification`.
- Key input: `channel` (string) — if the app uses a non-default channel, note it, since
  multiple `ob-notification` hosts can exist for different channels.
- No documented `role` override found — treat similarly to `mat-snack-bar` (transient,
  likely rendered outside the normal flow); prefer matching by visible text with an
  explicit wait rather than assuming immediate presence.

### `ob-breadcrumb`
Breadcrumb navigation, typically auto-generated from the route.
- Selector: `ob-breadcrumb`.
- Inputs of note: `maxWidth`, `parameterSeparator`, `beautifyUrls` (kebab-case → Title
  Case route segment display) — relevant if a test asserts exact breadcrumb text,
  since the displayed text may be reformatted from the raw URL segment.

### `ob-file-upload`
File upload widget.
- Selector: `ob-file-upload`.
- Key inputs: `accept` (file type filter), `multiple`, `maxFileSize`, `maxFileAmount`,
  `uploadUrl`.
- Key output: `uploadEvent` (`ObIUploadEvent`) — for a test, the actual native
  `<input type="file">` is what Selenium needs to `sendKeys()` a file path to; locate
  that inner input, not the `ob-file-upload` host.

### `obButton` (attribute directive, not a component)
Applied to a native `<button>` (often alongside Material's `mat-button` family) to
apply Oblique's visual variant.
- Selector: `[obButton]`, with variant value `'primary' | 'secondary' | 'tertiary'`
  (default `'primary'`).
- For page objects: this is a styling directive on an existing button, not a separate
  element — locate the underlying `<button>` by accessible name/`data-testid` as
  usual; `[obButton]` is only useful to disambiguate "an Oblique-styled button" from a
  plain Material one if that distinction matters for the test.
