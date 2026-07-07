# Typography Design Tokens

Static reference for the `check-typography` skill (see PLAN.md section 10). Read only
the row(s) for the element type actually being checked — do not load this whole file
into a prompt at once.

**Sources & confidence:**
- `font-family` and the base body/button values below were captured **live** from
  `https://oblique.bit.admin.ch/styling` (2026-07-07) via a headless-browser render +
  `getComputedStyle()` — the site is a client-rendered Angular SPA, so this required
  actually running it rather than fetching raw HTML. These are directly verified.
- Angular Material's dense-theme component scale (`.875rem` etc.) came from the same
  page's live-rendered `--mat-*` CSS custom properties — also directly verified, but
  note these are Material's *own* per-component tokens (buttons, form fields, dialogs),
  not necessarily what an app author uses for plain headings/body copy.
- **TODO / not verified:** heading tier sizes (`h1`-`h6`) were not found — the styling
  page didn't render literal `<h1>`-`<h6>` elements in the DOM subtree this script
  inspected (likely lazy-loaded behind an in-page router view that needs an explicit
  click/route change, not just a page load). No `--ob-*`-prefixed CSS custom
  properties were found on `:root` on this page either, despite the design-system
  docs mentioning Figma-generated semantic tokens — they may live on a different
  route, in a different prefix, or only apply once a component is in use. **Do not
  invent heading sizes** — re-run a similar live-render check against the specific
  target app's own pages (which will have real rendered headings) before asserting on
  heading typography, or extend the research script in this file's history to
  navigate into a docs sub-page that actually renders one.

---

## Verified values

| Element / token | Font family | Font size | Line height | Font weight |
|---|---|---|---|---|
| `body` (base text) | `"Noto Sans", Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif` | `16px` | `24px` | `400` |
| Nav/toolbar `button` (as rendered on the live docs site) | same stack as body | `16px` | `16px` | `400` |
| Material dense-theme default component text (`mat-checkbox` label, `mat-expansion` body, `mat-bottom-sheet`, `mat-snack-bar` supporting text, etc.) | Material theme default | `.875rem` (14px) | `1.375rem` (22px) | `400` |
| Material filled/outlined/protected/text button label (`mat-button` family) | Material theme default | `.875rem` (14px) | — | `500` |
| Material toolbar title / card title | Material theme default | `1.125rem` (18px) | `2rem` (32px) | `500` |
| Material badge text | Material theme default | `12px` (small: `9px`, large: `24px`) | — | `600` |
| Material button-toggle label | Material theme default | `1rem` (16px) | `1.5rem` (24px) | `400` |

## Procedure for `check-typography` when a needed tier isn't in this table

1. Do not guess a value. Use the `playwright-explore` tool's `snapshot`/`screenshot`
   actions against the *actual target application* (not this reference) to read the
   real rendered `getComputedStyle()` value for that element, the same way this file's
   verified rows were produced.
2. Record the newly-verified value back into this file (with the date and source) so
   future runs don't need to re-derive it.
3. Only then generate the `@Tag("typography-check")` assertion using that value as a
   fixed Java constant.
