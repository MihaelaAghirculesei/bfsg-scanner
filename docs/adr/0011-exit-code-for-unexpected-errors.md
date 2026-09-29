# 11. An exit code for unexpected errors

Date: 2026-09-29

## Status

Accepted. Extends the exit-code table of ADR 0003.

## Context

ADR 0003 defines `0` (pass), `1` (violations at or above `failOn`), `2`
(bad arguments or configuration) and `3` (incomplete scan). Every path that
`run` anticipates maps to one of them. A failure it does not anticipate —
Chromium missing on a first `npx` run, an output directory that cannot be
created — escaped as an unhandled rejection. Node then printed a stack
trace and exited `1`.

`1` is the one code a CI gate reads as a verdict on the site. A broken
runner therefore looked like an inaccessible site, and the person reading
the log went looking for violations that were never measured.

## Decision

`run` catches anything that escapes the handled paths, prints a one-line
`Unexpected error: <message>` to stderr, and returns **`4`**.

Alternatives considered:

- **Reuse `3`.** `3` already means "no trustworthy result". But it points
  at the *site* (unreachable pages, nothing discoverable), and the fix is
  on the site's side. A missing browser or a read-only disk is fixed on
  the *runner's* side. Separate codes keep that distinction machine-readable.
- **Leave the crash, document it.** Cheapest, but the collision with `1`
  is the defect being fixed; documenting it does not remove it.

The message is kept to the error's own text. Playwright's launch error
already names the `npx playwright install` command, so no hint is added
on top of it.

## Consequences

- The code is additive: a CI job that treats any non-zero code as failure
  behaves as before; one that tests for `1` specifically no longer fires on
  a broken runner.
- The stack trace is no longer printed. The message carries the cause;
  a developer debugging the tool itself runs it from source.
- Any future failure mode that deserves its own code must be caught
  explicitly before it reaches this net.
