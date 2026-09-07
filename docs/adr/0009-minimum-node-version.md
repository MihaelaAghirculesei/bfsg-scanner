# 9. Minimum supported Node.js is 22

Date: 2026-09-07

## Status

Accepted

## Context

`engines.node` was set to `>=24.0.0` when the package was first prepared for
release. That was the version the work happened on, not a considered floor:
nothing in the code needs Node 24. The runtime surface is `node:fs`,
`node:path`, `node:http`, `node:util` `parseArgs`, and the global `fetch`.
`parseArgs` has been stable since 20.0.0 and `fetch` since 21.0.0, so both
are stable with no experimental warning from 22 onward.

Requiring 24 excludes the current LTS line from `npx bfsg-scanner` and from
the GitHub Actions snippet in the README for no benefit. Node 20 is out of
its maintenance window, so it is not a candidate.

## Decision

Set `engines.node` to **`>=22.0.0`**.

- `.nvmrc` / `.node-version` stay at the current release (24.19.0): that is
  what contributors develop on and what the required `ci` check and the
  release workflow run. The floor is what the package *supports*, not what
  day-to-day work uses.
- `cross-platform.yml` gains a `node` matrix axis — `['22', '24.19.0']` on
  Windows and macOS — so the minimum is actually exercised on every PR
  rather than only asserted in `package.json`.
- The README CI example uses `node-version: 22` to match the floor.

## Consequences

- The advisory cross-platform run doubles to four jobs (two OSes × two Node
  versions). It stays advisory; a failure on the `22` leg is the signal to
  either raise the floor deliberately or fix the incompatibility.
- No Linux job runs the `22` leg — the required `ci` check keeps its single
  `.nvmrc` build so the `ci` status name stays stable for branch
  protection. If a Linux-specific, Node-22-specific regression ever slips
  through, promoting the cross-platform matrix to required is the fix.
- A future need for a Node 24 API is not blocked; it just has to be a
  deliberate bump of this floor, with this ADR superseded.
