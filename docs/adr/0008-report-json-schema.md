# 8. A JSON Schema for report.json

Date: 2026-08-31

## Status

Accepted

## Context

`report.json` has carried `schemaVersion: 1` since ADR 0002, and ADRs 0003,
0004, and 0005 each noted that the version "starts mattering at the first
release" and deferred a formal schema. Nothing has ever described the file's
shape to a consumer, and nothing stops an incompatible change to
`src/report/types.ts` from shipping without anyone noticing the on-disk
format moved.

## Decision

Add **`schema/report.v1.json`**, a JSON Schema (draft 2020-12) for the
report envelope, and ship it in the package (`files`).

**Hand-written, not generated.** The report types are plain TypeScript
interfaces, not zod schemas, so there is nothing to derive a schema from
without adding a type-to-schema codegen tool and a build step. The schema
is written by hand against `types.ts`.

**A validation test is the drift guard.** `src/report/report-schema.test.ts`
builds a report with `buildReport` from a synthetic scan result that
exercises every branch — rated and unrated violations, clauses present and
absent, an incomplete result, a clean page, a failed page — and asserts it
validates. Every object in the schema sets `additionalProperties: false`
with a complete `required` list, so **adding or removing a field in
`types.ts` breaks this test** until the schema is updated to match. The
test also checks that `SCHEMA_VERSION` equals the schema's `const`.

**`schemaVersion: 1` is now frozen.** A backwards-incompatible change to the
envelope — a removed field, a narrowed type, a restructured `pages` entry —
requires a new `schema/report.v2.json` and bumping `SCHEMA_VERSION`.
Additive, optional fields can stay at 1.

**`ajv` as a dev dependency** (test only), with a one-line `date-time`
format check registered by hand rather than pulling in `ajv-formats`.

## Consequences

- The schema describes the report *envelope*. It does not re-validate
  axe-core's internals: `node.target` is "array of strings or string
  arrays" and `tags` / clause strings are unconstrained beyond being
  strings. Their correctness is axe's and the clause mapper's job, tested
  elsewhere.
- Two sources of truth for the report shape now exist — `types.ts` and this
  file — kept in step by the test rather than by generation. That is the
  cost of not adding codegen; the test makes the cost visible rather than
  silent.
- Consumers can validate a stored `report.json` against the shipped schema
  with any JSON Schema validator.
- `format: date-time` on `generatedAt` is advisory in the file (many
  validators do not enforce formats by default); the test enforces it.
