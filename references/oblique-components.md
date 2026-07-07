# Angular Material & Oblique — Component Reference for Selenium Test Generation

Static reference for the `component-knowledge` skill. Read only the section(s) for the
component(s) actually present in the current ARIA/DOM snapshot — do not load this
whole file into a prompt at once (see `.opencode/skills/component-knowledge/SKILL.md`).

**Sources & version pinning:**
- Verified against **Oblique 15.4.0 (latest)** on https://oblique.bit.admin.ch
  (Angular 21 / Material MDC-based), **2026-07-08**.
- Method: the live example previews on each docs page were rendered with Playwright,
  their real DOM extracted, and **every selector/interaction marked ✅ below was
  actually executed and asserted** (clicked, filled, toggled, opened) against those
  live examples — 32/32 checks passed. Entries marked ⚠️ have **no live preview** on
  the docs site (StackBlitz-only); their info comes from the official API docs text
  and is *not* DOM-verified — re-verify against the real app before relying on it.
- Re-verify this file if the project's installed `@oblique/oblique` major version
  differs from 15.

---

## Global rules (apply to everything below)

1. **Generated IDs are unstable.** Material/Oblique generate index-based IDs:
   `mat-select-1-panel`, `mat-mdc-slide-toggle-0-label`, `mat-tab-group-0-content-1`,
   `cdk-accordion-child-0`, `collapse-0-content`, `popover-0-content`,
   `cdk-describedby-message-ng-1-3`, `notification-info-<message-slug>-…`. The number
   increments per instance in render order — never hardcode one in a `@FindBy`.
   Prefer, in order: an app-provided `data-testid`, an ARIA role + accessible
   name/label, a stable structural class (listed per component below).
2. **Where overlays really render (version-specific, verified!):**
   - **In `.cdk-overlay-container` at the end of `<body>`:** dialogs, tooltips,
     datepicker calendars, snack bars. Page objects need a separate top-level locator
     plus an explicit wait — the overlay is *not* a descendant of the trigger.
   - **Inline INSIDE the host element (changed vs. older Material!):** `mat-select`'s
     option panel and `mat-autocomplete`'s panel now render *inside*
     `<mat-select>`/the form field, not in the body overlay. A descendant selector
     from the host **works** here.
   - **Appended at end of `<body>`, but NOT in the cdk overlay container:** Oblique
     popover content (`.ob-popover-content`) and notification toasts
     (`ob-notification` container, placed by the master layout).
3. **Real native inputs exist** inside checkbox / radio / slide-toggle / slider /
   file-upload — always target the native `<input>`/`<button role=…>` for actions and
   state reads, not the styled wrapper.
4. **Waits:** use explicit `WebDriverWait` on the conditions given per component
   (attribute change, presence in overlay, detachment). Never `Thread.sleep`.

---

## Alert — `ob-alert` ✅

```
ob-alert.ob-alert.ob-alert-{info|success|warning|error} [type=…]
├─ span.ob-screen-reader-only            «Info» / «Error» / … (type as text)
├─ div.ob-alert-icon > mat-icon
└─ div.ob-alert-content                  ← the visible message
```
- Assert kind via host class: `ob-alert.ob-alert-error`; message text via
  `.ob-alert-content`.
- Persistent (no close button) — for closable toasts see **Notification**.
- With `hasRoleAlert` the host carries `role="alert"` → good wait target.
- Java: `By.cssSelector("ob-alert.ob-alert-error .ob-alert-content")`.

## Autocomplete — `ob-autocomplete` ✅

```
ob-autocomplete > mat-form-field
└─ input[role=combobox][aria-haspopup=listbox][aria-expanded]  (matInput + trigger)
   button.ob-input-clear                  ← Oblique's clear («Clear» sr-only)
   mat-autocomplete                       ← panel renders INSIDE host when open
```
- Type into `ob-autocomplete input[role='combobox']`, wait for
  `mat-option[role='option']` (they appear **inside the host**, not in the body
  overlay — verified), click the option by visible text.
- After selection the input value may carry a **leading space** (verified:
  `" Graceling realm"`) — trim before asserting equality, or assert `contains`.
- `aria-expanded` on the input flips `false`/`true` — usable as open/closed wait.
- `button.ob-input-clear` empties the field (Oblique add-on, also on plain inputs).

## Badge — `matBadge` on any element ✅

- Host gets classes `mat-badge mat-badge-{above|below} mat-badge-{after|before}`;
  the value renders in a child `span.mat-badge-content` (verified text readable).
- The badge span is `aria-hidden="true"` — read it via CSS selector, it has no
  accessible name of its own.

## Banner — `ObBannerModule` ⚠️ no live preview

- Renders inside the master-layout header only (`banner: 'LOCAL'` in environment);
  cannot exist without `ob-master-layout`. Verify the concrete DOM in the real app
  before writing assertions.

## Breadcrumb — `ob-breadcrumb` ⚠️ no live preview

- Host selector `ob-breadcrumb`; labels come from route data
  (`data: {breadcrumb: 'Label'}`), URLs/params are "beautified" (kebab-case → Title
  Case) unless `beautifyUrls=false` — asserted text may differ from the raw URL
  segment. Current page is rendered non-clickable; root route is not included.
  One breadcrumb per route definition (not per URL segment). If cut off by
  `maxWidth`, full text moves to a tooltip.

## Button — `obButton` directive ✅

```
button[obbutton=primary|secondary|tertiary].ob-button.ob-button-{variant}
└─ span.mdc-button__label      ← visible text
```
- Locate by `button[obbutton]` + visible label text, or `data-testid`. The label
  lives in `span.mdc-button__label` but `button.getText()` also works.
- **Two disabled flavors (verified):** plain `disabled` attribute, or
  `disabledInteractive` → button stays focusable with `aria-disabled="true"` and can
  show a tooltip. Check **both** when asserting "button is disabled":
  `btn.getAttribute("disabled") != null || "true".equals(btn.getAttribute("aria-disabled"))`.
- Icon-only buttons use `mat-icon-button` and must have an accessible label
  (tooltip-linked `aria-labelledby`) — locate by `aria-label`/labelledby text.
- Links can be `a.ob-button` (same classes on `<a>`).

## Card — `mat-card` ✅

- `mat-card > mat-card-content` (plus optional `mat-card-header`, `mat-card-actions`).
  Pure container — target inner controls, use the card only as a scoping context.

## Chips — `mat-chip-listbox` / `mat-chip-option` ✅

```
mat-chip-listbox[role=listbox]
└─ div[role=presentation]
   └─ mat-chip-option.{info|success|warning|error}?   (severity = class on host)
      └─ button.mat-mdc-chip-action[role=option][aria-selected]
         └─ span.mat-mdc-chip-action-label            ← visible text
```
- **Click and state-read target is the inner `button[role='option']`** — verified:
  clicking it toggles its `aria-selected`. The `mat-chip-option` host itself has only
  `role="presentation"`.
- Severity chips: class `info|success|warning|error` sits on `mat-chip-option`.
- Removable chips render a separate trailing remove `button` (matChipRemove).

## Collapse — `ob-collapse` ✅

```
ob-collapse.ob-collapse
├─ div.ob-collapse-toggle[role=button][aria-expanded][aria-controls=<id>-content]
└─ div.ob-collapse-content > div[obcollapsemain]
```
- Click `.ob-collapse-toggle`, wait for `aria-expanded` to flip (verified
  false→true). Content container id is `<id>-content`, toggle id `<id>-toggle`,
  where `<id>` defaults to the instance index (`collapse-0`, …) — index-based, so
  prefer the class + scoping over the id unless the app sets `id` explicitly.

## Column layout — `ob-column-layout` ⚠️ no live preview

- Host `ob-column-layout`; main column with optional left/right drawers
  (`role="complementary"`), toggled open/closed. Verify toggle-button DOM in the
  real app.

## Dialog — Material `MatDialog` ✅

- Opens in the **body overlay**: wait for
  `.cdk-overlay-container mat-dialog-container[role='dialog']` (verified).
- Inside: `.mat-mdc-dialog-content` (body), `.mat-mdc-dialog-actions` (buttons —
  Oblique-styled `button[obbutton]`). A backdrop `div.cdk-overlay-backdrop` covers
  the page: interactions outside the dialog will be intercepted while open.
- Close: click an action button, then wait for the `[role='dialog']` element to be
  **detached/stale** (verified) before continuing.
- Note: `aria-modal` was `"false"` on the verified instance — don't key on it.
- Java wait: `ExpectedConditions.presenceOfElementLocated(By.cssSelector("mat-dialog-container[role='dialog']"))`
  then `ExpectedConditions.stalenessOf(dialogEl)` after closing.

## Error messages — `obErrorMessages` on `mat-form-field` ✅

- Marker attribute `oberrormessages` on the `mat-form-field`. To trigger validation
  in a test: focus the input, then blur (Tab) — `mat-error` appears in the field's
  `.mat-mdc-form-field-subscript-wrapper` (an `aria-live="polite"` region). Verified;
  default required-message text: **"This information is required"** (translated).
- Assert: `mat-form-field[oberrormessages] mat-error` text. Long messages are
  condensed; full text shows on hover/focus.

## Expansion panel — `mat-expansion-panel` ✅

```
mat-accordion > mat-expansion-panel
├─ mat-expansion-panel-header[role=button][aria-expanded][aria-controls]
│  ├─ mat-panel-title / mat-panel-description
└─ div.mat-expansion-panel-content[role=region]   ← body (hidden until expanded)
```
- Click the header (`role='button'`), wait for `aria-expanded="true"` (verified),
  then the `role='region'` content is visible. Find a panel by its
  `mat-panel-title` text, not by index.

## External link — `ObExternalLinkDirective` ✅

- Applied automatically to outside links: `a.ob-external-link` gets
  `rel="noopener noreferrer"`, `target="_blank"`, an icon, and an appended
  `span.ob-screen-reader-only` («- Opens in a new tab.») — verified.
- `a.getText()` may include the screen-reader suffix depending on how it's read —
  prefer `contains` when asserting link text.

## File upload — `ob-file-upload` / `ob-drop-zone` ✅

```
ob-file-upload.ob-file-upload[.disabled]
└─ ob-drop-zone.ob-drop-zone > div[tabindex=0][obdragdrop]
   └─ input[type=file].ob-screen-reader-only    ← sendKeys() target (verified present)
      p.ob-drop-zone-heading / p.ob-drop-zone-hints
```
- Upload in Selenium: `sendKeys(absoluteFilePath)` on the **native
  `input[type='file']`** (it's visually hidden, class `ob-screen-reader-only` —
  Selenium can still sendKeys to it; do not try to click it).
- Restrictions (accept/size) are texted in `p.ob-drop-zone-hints`. Disabled state =
  class `disabled` on the `ob-file-upload` host.
- Rejected files trigger an Oblique **notification** (see there) — assert that, not a
  dialog. Uploaded-file listing renders as a Material table below the drop zone.

## Form controls (Material, Oblique-styled) ✅

The generic `mat-form-field` wrapper:
```
mat-form-field.mat-mdc-form-field-type-{mat-input|mat-select}
└─ … label(mat-label) … div.mat-mdc-form-field-infix > <the actual control>
   div.mat-mdc-form-field-subscript-wrapper[aria-live=polite]  ← hints & mat-error
```
- **Text input** ✅: `input[matinput]`, best located via `formcontrolname="x"` (present
  in reactive forms, verified) or `data-testid`. Fill + read back verified.
  The floating `<mat-label>` text is the accessible name.
- **Checkbox** ✅: real `input[type='checkbox']` inside `mat-checkbox` — click it and
  read `isSelected()` (verified toggle). Label = sibling `label.mdc-label`.
- **Radio** ✅: `mat-radio-group[role='radiogroup']` with real
  `input[type='radio']` per `mat-radio-button` (verified). Material auto-generates
  `name="mat-radio-group-N"` — match options by label text, not by name.
- **Select** ✅: host `mat-select[role='combobox']` (aria-expanded flips). Click it;
  the panel `div[role='listbox']` renders **inside the `mat-select` element**
  (verified — NOT in the body overlay in this version). Click
  `mat-option[role='option']` by visible text; wait for the listbox to detach; the
  chosen value shows in `.mat-mdc-select-value` (verified with "Two").
- **Datepicker** ✅: click the `mat-datepicker-toggle button`; `mat-calendar` opens
  **in the body overlay** (verified — unlike select!). Prefer typing the date into
  the input over clicking calendar cells; Escape closes the calendar.
- Sizes: Oblique adds `ob-form-field-sm/-lg` style variants — cosmetic only.

## List group — `mat-list` ✅

- `mat-list[role='list']` → `mat-list-item[role='listitem']`; title line
  `p.mat-mdc-list-item-title`, secondary lines `p.mat-mdc-list-item-line` (verified).
  Find items by title text. Selectable variants render checkboxes/anchors inside.

## Master layout — `ob-master-layout` ⚠️ no live preview

- Application shell: renders header (with federal logo, language switch,
  controls), navigation, footer, and hosts off-canvas, global spinner and
  notifications. Structural container only — never an action target itself.
- Useful known regions to scope on (from API docs, **not DOM-verified**): the
  header/nav/footer sub-components `ob-master-layout-header`,
  `ob-master-layout-navigation`, `ob-master-layout-footer`. Verify against the real
  app's DOM snapshot before use; take selectors from the snapshot, not from here.

## Nav tree — `ob-nav-tree` ⚠️ no live preview

- Host `ob-nav-tree`, uses ARIA `role="tree"` (per API docs); children are router
  links — clicking navigates (assert URL change). Optional filter input above the
  tree. Verify item DOM in the real app.

## Nested form — `ob-nested-form` ✅

- `ob-nested-form[formcontrolname=…]` wraps a child component's form; inner inputs
  keep their own `formcontrolname` (verified: `input[formcontrolname]` addressable
  through the nesting). Field names can repeat across parent/children — **scope the
  selector through `ob-nested-form`** (e.g.
  `ob-nested-form[formcontrolname='child'] input[formcontrolname='field1']`).

## Notification (toast) — `ObNotificationService` ✅

```
ob-notification.ob-notification-container.ob-{top|bottom}-{left|right}
└─ ob-alert[role=alert].ob-alert.ob-notification.ob-alert-{type}
   ├─ div.ob-alert-content
   │  ├─ button.ob-close            («×», closes — verified)
   │  ├─ div.ob-notification-title
   │  └─ p                          ← message text
```
- Wait for `ob-notification .ob-alert[role='alert']` (verified). Type via
  `ob-alert-{info|success|warning|error}` class; title in `.ob-notification-title`.
- Element IDs are derived from the message text
  (`notification-info-<message_slug>-title` etc.) — do not rely on them; use
  `role='alert'` + text.
- Non-sticky notifications disappear on a timer (default a few seconds) — assert
  presence *immediately* after the triggering action, with an explicit wait for
  appearance, and expect eventual disappearance. Multiple containers possible with
  custom channels; placement class (`ob-top-right` default) sits on the container.

## Off-canvas — `obOffCanvasToggle` ⚠️ no live preview

- Sidebar sliding in from the right (40% width), part of the master layout; toggled
  by any element carrying the `obOffCanvasToggle` directive. Content/title are
  projected into `ob-master-layout` via `[obOffCanvasContent]`/`[obOffCanvasTitle]`.
  Verify the rendered sidebar DOM in the real app.

## Paginator — `mat-paginator` ✅

- Host `mat-paginator[role='group'][aria-label='Select page']`.
- Navigation: `button[aria-label='Next page']` / `button[aria-label='Previous page']`
  (verified click). Disabled nav buttons use `aria-disabled="true"` + `tabindex=-1`
  (interactive-disabled style — check `aria-disabled`, not just `disabled`).
- Assert position via `.mat-mdc-paginator-range-label` (`role='status'`,
  aria-live) — verified text `"1 – 50 of 1000"` → `"51 – 100 of 1000"` after Next.
  Note the en-dash `–` in the text.
- Page size: `.mat-mdc-paginator-page-size-value`; when changeable it's a
  `mat-select` (see Form/select — panel inline in host).

## Popover — `obPopover` directive ✅

- Trigger button (gets class `ob-popover`) carries the full ARIA wiring (verified):
  `aria-haspopup="menu"`, `aria-expanded`, `aria-controls="popover-N-content"`,
  `aria-describedby`.
- Content `div.ob-popover-content[role='tooltip']` with `id = aria-controls` value,
  appended **at the end of `<body>`** (not in the cdk overlay container — verified).
  It is **removed from the DOM when closed**, not hidden — wait for
  presence/absence, not visibility.
- Robust pattern: read `aria-controls` from the trigger, then locate `#<that-id>`.

## Progress bar — `mat-progress-bar` ✅

- `mat-progress-bar[role='progressbar']` (verified). For determinate mode assert
  `aria-valuenow`; indeterminate mode has none.

## Selectable — `obSelectable` ✅

- `div.ob-selectable-group[role='group']` wraps `.ob-selectable` elements whose
  `role` reflects the mode: `checkbox` (default, multi), `radio`, or `option`.
- Click toggles `aria-checked` AND adds class `ob-selected` (both verified).
  Keyboard: Space toggles the focused element (`tabindex=0`).

## Slide toggle — `mat-slide-toggle` ✅

- Action/state element is the inner `button[role='switch'][aria-checked]`
  (verified toggle). Label = sibling `label.mdc-label`; `aria-labelledby` uses a
  generated id — locate by label text or `data-testid` on the host.

## Slider — `mat-slider` ✅

- A real `input[type='range']` (attribute `matsliderthumb`) sits inside `mat-slider`
  and carries the value (verified read). Set values with keyboard arrows on the
  input or `JavascriptExecutor` + dispatch `input` event; plain `sendKeys` of text
  does not work on range inputs.

## Spinner — `ob-spinner` ✅

- Idle: `ob-spinner[aria-hidden='true']` with `div.ob-overlay.ob-spinner-fade`.
  Active: the overlay gains **`.ob-spinner-fade-in`** (verified). Global app spinner
  additionally has `.ob-overlay-fixed`; section spinners cover their parent
  (`.ob-has-overlay` on the covered container).
- **Test rule:** before any click after navigation/save, wait for absence of
  `ob-spinner .ob-overlay.ob-spinner-fade-in` — the overlay intercepts clicks.

## Stepper — `mat-stepper` (linear only in Oblique) ✅

- Step headers: `mat-step-header[role='tab'][aria-selected]` inside a
  `[role='tablist']`; active step has `aria-selected="true"` (verified). Upcoming
  steps in linear mode are `aria-disabled="true"` — navigate with the
  next/back buttons in the step content (`button[matsteppernext]` /
  `button[matstepperback]` attributes in templates), not by clicking headers.
- Step content: `div.mat-horizontal-stepper-content[role='tabpanel']`; only the
  current one is interactable. Find steps by `.mat-step-text-label` text.
- Completed/editable step icons: `.mat-step-icon-state-{edit|number|done}`.

## Table (plain HTML) — class `ob-table` ✅

- `table.ob-table` with normal `thead/tbody/tr/td/th` (verified: straightforward
  row/cell reads). Style variants (cosmetic, on the same `<table>`):
  `ob-table-plain`, `ob-table-sm/-lg`, `ob-table-disable-hover-style`,
  `ob-table-collapse[-sm]` (uses `data-title` attributes when collapsed),
  parent class `ob-table-scrollable`.
- Rows may use `th` (not `td`) for the row-header column — select cells with
  `td,th` when reading a whole row.

## Table (Material) — `mat-table` + `ob-table` ✅

- `table.mat-mdc-table[role='table']`; rows `tr.mat-mdc-row[role='row']`.
- **Best column hook:** every cell carries `mat-column-<columnDefName>` (e.g.
  `td.mat-column-symbol`, verified) — semantic, derived from the app's column
  definition, stable. Use it instead of cell indexes.
- Sorting: click `th.mat-sort-header`; assert `aria-sort` on the `th` — verified,
  but the cycle observed was `descending → none` (initial state dependent):
  **assert the concrete value, never assume ascending-first.**
- Body rows also may contain `th[role=columnheader]` as row headers (docs example
  does) — same `td,th` advice as HTML table.
- Combine with **Paginator** and `mat-form-field` filter inputs as documented above.

## Tabs — `mat-tab-group` ✅

- Labels: `[role='tab']` with `aria-selected`, inside the group's
  `[role='tablist']`; panels: `mat-tab-body[role='tabpanel']` with `aria-hidden`.
- Click a tab by its text, wait for `aria-selected="true"`, then read the visible
  panel `mat-tab-body[aria-hidden='false']` (verified).
- **Scope everything to ONE `mat-tab-group`** — pages can contain several tab
  groups (and inactive panels stay in the DOM); an unscoped
  `[aria-hidden='false']` matches multiple elements (verified failure mode).

## Tooltip — `matTooltip` ✅

- Trigger has class `.mat-mdc-tooltip-trigger` and `aria-describedby` (generated
  id). On hover, `mat-tooltip-component` appears **in the body overlay** with the
  text in `.mdc-tooltip__surface` (verified).
- In Selenium use `Actions.moveToElement(trigger)` then wait for
  `.cdk-overlay-container mat-tooltip-component`. Oblique also uses the tooltip
  content as the accessible label of icon-only buttons.

---

## Verification log — 2026-07-08, Oblique 15.4.0

**Method.** All 34 pages of https://oblique.bit.admin.ch (27 components + 7
DOM-relevant helpers) were rendered with Playwright, the live example DOM was
extracted, and a 32-check self-test then exercised every documented selector and
interaction pattern exactly like a generated Selenium test would: opening dialogs,
selecting `mat-select`/autocomplete options, toggling switches/chips/collapse/
selectables, sorting a Material table, paginating, triggering notifications and
validation errors, hovering tooltips, opening popovers/datepickers, activating the
spinner. Result: **32/32 checks passed.**

**Corrections vs. the previous version of this file (found only through live
testing — a re-run against a future Oblique version should re-check these first):**
- `mat-select` and autocomplete panels **no longer render in the body overlay** in
  this Material version — they render *inside* the host element. Dialogs, tooltips
  and datepicker calendars still use the body overlay; Oblique popover content is
  appended to `<body>` but *outside* the cdk overlay container.
- Chips: the clickable/selectable element is the *inner* `button[role=option]`;
  the `mat-chip-option` host itself is only `role=presentation`.
- Buttons/paginator have **two disabled flavors** (real `disabled` vs. focusable
  `aria-disabled="true"` via `disabledInteractive`) — tests must check both.
- Material-table sorting does not necessarily start at "ascending" — assert the
  concrete `aria-sort` value, never the assumed cycle order.

**Practical traps confirmed during the test run:**
- Autocomplete option selection leaves a **leading space** in the input value.
- An active spinner overlay **intercepts clicks** — wait for the absence of
  `ob-spinner .ob-overlay.ob-spinner-fade-in` before interacting.
- Popover content is **removed from the DOM** when closed, not hidden.
- Multiple `mat-tab-group`s on one page break unscoped `[aria-hidden='false']`
  locators — always scope to one group (this failure actually occurred in the
  self-test before scoping was added).

**Not verifiable on the docs site (⚠️ sections above):** master-layout, nav-tree,
column-layout, breadcrumb, banner, off-canvas — their example previews are
StackBlitz-only links. Entries are based on the official API docs text; re-verify
against the real application's ARIA/DOM snapshot before generating page objects for
them.
