# 7. CLI argument surface

Date: 2026-08-31

## Status

Accepted

## Context

Until now the CLI understood one flag, `--config <path>`, and defaulted to
`bfsg.config.yaml`. Scanning a single URL meant writing a YAML file first,
`--help` and `--version` did not exist (`run(['--help'])` tried to load a
config and exited 2), and the report formats could not be narrowed — every
run wrote JSON, HTML, and PDF.

## Decision

**Parser: `node:util` `parseArgs`.** Built in, no dependency. `strict` mode
rejects unknown options; a `TypeError` from it is rewrapped as `ConfigError`
so bad arguments exit 2 like a bad config.

**Argument surface:**

```
bfsg-scanner [url] [options]

  -c, --config <path>        YAML config (default: bfsg.config.yaml)
      --fail-on <level>      critical | serious | moderate | minor
      --report-language <l>  de | en
      --output-dir <dir>
      --format <list>        subset of json,html,pdf
  -h, --help
  -V, --version
```

- A **positional URL** scans that page with defaults, no config file — the
  common first-run case. It is mutually exclusive with `--config`; passing
  both, or more than one URL, is an error.
- Only the four knobs a one-off run realistically varies get a flag.
  `maxPages`, `wcagTags`, `excludePaths` are not mirrored: a run that needs
  those needs a config file, and a flag for every field is a maintenance
  cost with little payoff.

**`reportFormats` is a config field, not just a flag.** Every other knob
lives in the config; formats do too (`reportFormats`, default all three,
minimum one). `--format` overrides it. This is the `--format` flag ADR 0006
foresaw.

**One validation path.** CLI overrides are collected as raw values and
merged into the config object, which is then run through `configSchema`
(the new exported `parseConfig`). `--fail-on nope` fails with the same
machinery and message shape as `failOn: nope` in a file. `loadConfig` now
delegates its validation to `parseConfig` too.

**`toolInfo()` moved to `src/shared/`.** The package-manifest read that
stamps the report's `tool` field is the same thing `--version` needs; it
had one copy in `src/report/build.ts` and now has one shared copy.

## Consequences

- `reportFormats` selects which artifacts are written. With `pdf` absent the
  run skips the browser `page.pdf()` call; with only `json` it skips HTML
  rendering entirely. `buildReport` always runs — the verdict, exit code,
  and breached-clause summary do not depend on any file being written.
- A minimum of one format: a run that writes nothing is almost always a
  mistake, and `outputDir` can already point at a throwaway directory for
  the rare "exit code only" case.
- `parseArgs` config errors ("Option '--config' argument missing",
  "Unknown option '--nope'") surface verbatim. They are clear enough not to
  reword.
- Not added: a positional URL list, `--quiet`/`--verbose`, config-file
  discovery up the directory tree. Out of scope until asked for.
