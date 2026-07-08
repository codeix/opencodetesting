# Session log — driving opencode non-interactively

How this project's `opencode` console was actually driven tonight, so the same
commands can be reused/adapted by hand. Not auto-generated — written from the real
commands run during the session. Append to this file as work continues; keep the
newest session at the top.

---

## The pattern (read this first)

`opencode run --agent <name> "<message>"` runs one non-interactive turn and exits.
Three hard-won rules make this reliable with the local model:

1. **One phase = one process, and it must be self-contained.** The `playwright-explore`
   browser is a module-level singleton that only survives for the lifetime of one
   `opencode run` process. `--continue`/`--session` replays the *conversation*
   history from disk, but a fresh process still starts with a blank browser page. If
   a message assumes the browser is already on some page (e.g. "click Overview" with
   no preceding `goto`), the click times out. Always put `goto` + every
   click/snapshot needed for one exploration inside a **single** `opencode run` call.
2. **Small requests, one file at a time.** Asking for 2-3 Java files in one call
   sometimes made the local model announce what it would do and then stop without
   calling a tool at all (empty output, no error). Splitting into "page object A",
   "page object B", "test class" as three separate calls fixed this every time it
   was tried.
3. **cwd must be the actual Java project directory**, not the repo root or
   `.opencode/`. `opencode` resolves `.opencode/agents|skills|tools` and
   `references/` by walking up from cwd, but writes generated files relative to cwd.
   Run every `opencode run` from `workspace/<project>/`.

Run each call in the true background (`nohup ... &` + a `Monitor`/`until kill -0 <pid>`
wait) rather than foregrounding with `timeout` — local-model calls legitimately take
30s to several minutes depending on how much it has to write, and a hard `timeout`
kill loses whatever it already reasoned through.

Always `cd` into the project directory first and confirm with `pwd` before running
anything — a stray `cd` earlier in a shell session silently breaks every later
`opencode run` in that session (this happened once tonight, see Known Gotchas).

---

## Known gotchas (root-caused tonight, fixes already committed to the tool)

- **`opencode.json` had no `external_directory` allow for `references/`.** Any agent
  reading the shared component reference from a nested project directory hit an
  unanswerable `ask` permission prompt and hung forever (no TTY in `opencode run`).
  Fixed with a top-level `permission.external_directory` allow-list.
- **`explore` agent had no `playwright-explore` tool permission at all** — it could
  talk about exploring but never touch the browser. Custom tools default to
  disabled for custom primary agents unless listed in the agent's `tools:` block.
- **`playwright-explore.ts` used `waitUntil: "domcontentloaded"`** — fires before an
  Angular app's data fetch resolves, so snapshots intermittently caught an
  empty/loading state. Switched to `networkidle` + a bounded settle wait in
  `snapshot`.
- **The `skill` tool itself is unreliable** — even with permission granted, the model
  sometimes produces a near-empty response instead of invoking it. Workaround: tell
  the agent to `Read` the `SKILL.md` file directly instead of relying on it to
  invoke the skill tool.
- **This sandbox has no system Chrome**, only Playwright's bundled Chromium.
  `BaseTest` now reads optional `CHROME_BIN` / `CHROME_DRIVER_VERSION` env vars (see
  `MANUAL.md`) — unset on a machine with a normal Chrome install.
- **Generated code still needs a human/review pass.** The model reliably produces
  working Selenium *structure* but makes small, consistent mistakes: wrong package
  imports, page objects incorrectly `extends BaseTest` instead of taking `WebDriver`
  via constructor, invented field values that don't match what was actually explored,
  occasionally invalid Java syntax (`@FindBy.tagName(...)` is not valid). Always
  compile + run before trusting a generated file.

---

## 2026-07-08 — night session (citizen-portal-tests)

Environment: `cd workspace/citizen-portal-tests` for every command below.
`export CHROME_BIN=/home/sam/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`
`export CHROME_DRIVER_VERSION=149.0.7827.55` (only needed on this sandbox).

### Scenario 1 — applications list + detail navigation

```bash
opencode run --agent explore --title "citizen-portal-applications-scenario-v2" \
  "Go to http://localhost:4200/applications. Snapshot. Report: (1) exact column headers in order (2) the ID/Title/Type/Status/Date values of the first two rows verbatim. This app uses the flex-layout mat-table variant (mat-row/mat-cell, not tr/td). Then click the Overview button for row APP-2024-001 using: mat-row:has-text(\"APP-2024-001\") >> role=button[name=\"Overview\"]. Snapshot again and report: page heading, the reference/date line, any buttons, and the tab names with which one is selected."
```

```bash
opencode run --agent selenium \
  "Write two page objects for the citizen-portal sample app (http://localhost:4200). ... [full scenario facts + exact XPath/CSS to use] ... Write both files now."
```

```bash
opencode run --agent selenium \
  "Write one JUnit 5 test class src/test/java/tests/ApplicationsTest.java ... Use these EXACT existing page object APIs (do not invent different method names): ..."
```

```bash
mvn -q test-compile
mvn -Dtest=ApplicationsTest test
```

Result: 2/2 passing after fixing (by hand): missing `support.BaseTest`/`java.util.List`
imports, and a Material-icon-ligature-text bug (`getText()` on a row/tab picked up
`visibility`/`delete`/`info` icon ligature words alongside the real label — see
`references/oblique-components.md` global rule 5).

### Scenario 2 — dashboard stats

```bash
opencode run --agent selenium \
  "Write page object src/test/java/pages/DashboardPage.java for the citizen-portal dashboard ... Methods: void open(); String getStatValue(String label); String getAlertMessage(); boolean isRecentApplicationsHeadingVisible(). Write the file now."
```

```bash
opencode run --agent selenium \
  "Write JUnit 5 test src/test/java/tests/DashboardTest.java ... Use this EXACT existing page object API (do not invent different labels or methods): ..."
```

Result: first page-object attempt invented wrong stat labels ("Active Applications"
etc. instead of the real "Total Applications"/"Pending Review"/"Approved") and used
invalid `@FindBy.tagName(...)` syntax — rewritten by hand. Test-class call (given the
now-correct method signatures) came back clean on the first try. 1/1 passing.

### Scenario 3 — second-row Overview, two detail tables, field-by-field

```bash
opencode run --agent explore \
  "Go to http://localhost:4200 (root page). Click the 'Applications' link in the main navigation (not a direct URL to /applications). Snapshot to confirm the table loaded. ... Determine the ID cell text of the SECOND row (position 2, not the first). Then click the Overview button ... scoped to that second row's ID ... Snapshot the resulting Overview page and report: the second row's ID you found, and confirm two tables are visible with headings 'Application Details' and 'Applicant Information' ..."
```

```bash
opencode run --agent selenium \
  "Add ONE method to the existing file src/test/java/pages/ApplicationsListPage.java (edit it, do not rewrite unrelated methods): public String getApplicationIdAtRowIndex(int rowIndex) ..."
```

```bash
opencode run --agent selenium \
  "Add TWO methods to the existing file src/test/java/pages/ApplicationDetailPage.java (edit it, do not rewrite unrelated methods): public String getApplicationDetailField(String label) ... public String getApplicantInformationField(String label) ..."
```

```bash
opencode run --agent selenium \
  "Write JUnit 5 test src/test/java/tests/ApplicationOverviewFieldsTest.java ... Use these EXACT existing page object APIs (do not invent different methods): ... One test method secondRowOverviewShowsCorrectDetailAndApplicantFields: 1. ...get the ID at row index 2 into a variable, assertEquals(\"APP-2024-002\", that id) as a sanity check. 2. clickOverviewForApplicationId(that id variable) - do not hardcode a literal id string here... 3-4. [17 field assertions across both tables]"
```

```bash
mvn -q test-compile
mvn -Dtest=ApplicationOverviewFieldsTest test
mvn clean test   # full suite, 4/4 passing
```

Result: `ApplicationsListPage` edit came back correct first try. The
`ApplicationDetailPage` edit call read the file but never called an edit/write tool
(empty-effect response) — applied by hand instead. Test-class call was clean on the
first try (all field values pulled from a real explored DOM, not guessed). 4/4 tests
passing suite-wide.

### Scenario 4 — delete confirmation dialog, Cancel path (non-destructive)

Checked the real Delete flow directly with a one-off Playwright script first
(clicking the actual "Delete" confirm button would have permanently mutated the
app's shared mock data for the rest of the session, breaking every other test that
depends on that row existing — Cancel doesn't have that risk, so it was the safe
scenario to automate).

```bash
opencode run --agent selenium \
  "Add ONE method to the existing file src/test/java/pages/ApplicationsListPage.java (edit it, do not rewrite unrelated methods): public void clickDeleteForApplicationId(String applicationId) ..."
```

```bash
opencode run --agent selenium \
  "Write new page object src/test/java/pages/ConfirmDeleteDialog.java for a Material confirmation dialog ... Methods: boolean isOpen(); String getHeadingText(); String getMessageText(); void clickCancel(); void clickDelete() ..."
```

```bash
opencode run --agent selenium \
  "Write JUnit 5 test src/test/java/tests/DeleteConfirmationTest.java ... One test method cancellingDeleteKeepsTheApplication: 1. clickDeleteForApplicationId(\"APP-2024-004\") 2. assert dialog open with correct heading/message 3. clickCancel() 4. assertFalse(isOpen()) via WebDriverWait, since the dialog close is animated 5. assert the row still exists (nothing was deleted)."
```

```bash
mvn -q test-compile
mvn clean test   # full suite
```

Two real bugs found and fixed by hand:
- `@FindBy(css = "button:contains('Cancel')")` — `:contains()` is jQuery/Sizzle, not
  real CSS; Selenium's CSS engine (native `querySelector`) throws
  `InvalidSelectorException` at runtime. Rewrote as XPath
  (`//button[normalize-space()='Cancel']`), scoped to the dialog container. Added as
  a documented gotcha in `generate-pageobject/SKILL.md`.
- `isOpen()` called `.isDisplayed()` on a `@FindBy`-cached dialog element; Material's
  close animation removes the node from the DOM shortly after Cancel is clicked, so
  a `WebDriverWait.until(d -> !dialog.isOpen())` poll hit a
  `StaleElementReferenceException` mid-animation and failed the whole wait instead of
  just returning `false` for one iteration. Fixed by querying fresh each call and
  catching the staleness exception inside `isOpen()`. `oblique-components.md`'s
  Dialog section already documented the *right* underlying pattern
  (`ExpectedConditions.stalenessOf`) — the model just didn't apply it; added one
  line calling out the custom-`isOpen()` variant of the same pitfall explicitly.

Result: 5/5 tests passing suite-wide after fixes.

### Scenario 5 — New Application form (investigated, not automated)

Checked the "New Application" wizard (`/applications/new`, a 3-step `mat-stepper`)
directly with a Playwright script before committing an `opencode` call to it: the
"Next" button starts disabled, but filling every visible required field on step 1
(First/Last Name, Date of Birth, Email, Address, City) did **not** enable it — the
button's `[disabled]` binding appears to gate on the whole multi-step form's
validity, not just the active step, and step 2/3 controls (`title`, `description`,
etc.) are already present in the DOM (all steps' `FormGroup`s seem to exist
up-front). Untangling the true enable condition would need more investigation than
it's worth tonight, and actually submitting the wizard would create a new mock
application row and break `DashboardTest`'s "10 Total Applications" /
`ApplicationsTest`'s row-count assumptions. Skipped rather than shipped a shaky
test — noted here so it isn't silently forgotten.

### Scenario 6 — Settings page shows existing account values (read-only)

```bash
opencode run --agent selenium \
  "Write page object src/test/java/pages/SettingsPage.java ... Methods: void open(); String getTextFieldValue(String controlName); String getSelectValue(String controlName); boolean isToggleChecked(String controlName); boolean isCheckboxChecked(String controlName)"
```

```bash
opencode run --agent selenium \
  "Write JUnit 5 test src/test/java/tests/SettingsPageTest.java ... assertEquals(\"Maria Müller\", getTextFieldValue(\"displayName\")) ... isToggleChecked(\"emailNotifications\")=true, isToggleChecked(\"smsNotifications\")=false, isCheckboxChecked(\"twoFactorEnabled\")=false"
```

```bash
mvn -q test-compile
mvn clean test   # full suite, twice in a row to rule out flakiness
```

Two real bugs found and fixed by hand:
- Missing `import org.openqa.selenium.By;` / `import support.TestConfig;` — the
  same missing-import pattern seen in almost every generated file tonight (see
  Known Gotchas below).
- **First test run failed**: `expected: <Maria Müller> but was: <>`. Root cause:
  this settings form's existing values are patched in asynchronously after the
  inputs already exist in the DOM (verified: value is empty at ~0ms, populated by
  ~500ms) — implicit wait only waits for element *presence*, which is satisfied
  immediately, so it doesn't help. Tried `ob-has-overlay` class removal as a
  loading signal first (this app puts that class on several page hosts while an
  `ob-spinner` shows) — verified it never actually clears on this page, a dead
  end. Fixed instead with an explicit `WebDriverWait` in `open()` for one known
  field's value to become non-blank, on the theory Angular patches the whole form
  in one call. Documented as a new global rule (#6) in
  `references/oblique-components.md` since this applies to any pre-filled
  reactive form, not just Settings — confirmed stable across two consecutive full
  suite runs afterward.

Result: 6/6 tests passing suite-wide, stable across repeated runs.

## Recurring pattern worth calling out separately

Nearly every generated file tonight was missing at least one import
(`support.BaseTest`, `support.TestConfig`, `org.openqa.selenium.By`,
`org.openqa.selenium.support.ui.WebDriverWait`) even though the code that used
them was otherwise correct. Always run `mvn -q test-compile` immediately after any
generated/edited file — don't batch multiple files before compiling once, since
that makes it harder to tell which file introduced the missing import.
