---
name: validate-test
description: >
  Compiles/runs a generated Java test via Maven and reports pass/fail. ALWAYS run this
  right after generate-test or edit-test, before treating a test as done — never hand
  an unvalidated test to the developer. On failure, suggests ONE targeted fix and loops
  back to generate-test/edit-test, up to 3 attempts total, then stops and reports the
  error instead of looping forever.
---

# validate-test

## Input
The path(s) of the newly generated/edited `.java` file(s) (test class + its page
object).

## Context budget
The compile/run itself needs no LLM call. Only if a fix suggestion is needed: the
trimmed Maven error block (file:line + message), never the full log/stack trace.

## Procedure
1. Run `mvn -q test-compile` first (cheap compile-only check).
2. If compilation succeeds and a live run was requested, run
   `mvn -q -Dtest=<ClassName> test`.
3. On success: report pass, no further LLM call needed.
4. On failure: extract only the relevant error lines (file:line + message); discard
   stack-trace noise.
5. Hand the trimmed error to `mistral-small-4-119b` for exactly one fix suggestion, then route back
   to `generate-test` or `edit-test` (whichever produced the failing file) with that
   specific error.
6. Track attempts. After 3 failed attempts total for this test, stop looping and report
   the error to the developer instead of retrying again.

## Output
```
{ "status": "pass" | "fail", "errors": ["<trimmed line>", ...], "attempt": <n> }
```
