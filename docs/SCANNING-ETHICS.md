# Responsible use

`bfsg-scanner` drives a real browser against whatever URL you give it and
follows links across the site. That is ordinary web traffic, but it is
traffic *you are causing to someone else's infrastructure*. Use it
accordingly.

## Scan only what you are allowed to scan

Run it against:

- sites you own or operate, or
- sites you have explicit permission from the operator to test (a client
  engagement, an employer's property, a written authorisation).

Accessibility testing is not a licence to crawl arbitrary third-party sites.
"It's just an audit" is not consent.

## What the tool already does to be a good citizen

- **Identifiable User-Agent.** Every request — page navigations and the
  `fetch` calls for `sitemap.xml` / `robots.txt` / crawling — carries
  `bfsg-scanner (+https://github.com/MihaelaAghirculesei/bfsg-scanner)`. It
  never spoofs a real browser's User-Agent, so an operator can see it in
  their logs and block it if they want to.
- **Respects `robots.txt`.** The crawl obeys `Disallow` rules for its
  User-Agent. If `robots.txt` disallows everything, the run discovers
  nothing and exits `3`.
- **Rate-limited per host** (default: one request per second per host) and
  **bounded** (`maxPages`, default 50). Raise these only against
  infrastructure you know can take it.

Do not patch these safeguards out to scan a site that is trying to keep you
out.

## Handle the output carefully

A report can contain substantial excerpts of the scanned site's markup —
copy, structure, sometimes data. Treat `report.*` files and any list of
client URLs as you would any other client material:

- The repo's `.gitignore` already excludes `/reports/`, `/private/`,
  `sites.private.*`, and `*.bfsg-report.*`. Keep it that way.
- Don't paste report contents into public issues or chats without checking
  what's in them.

## Not legal advice

A passing scan is evidence, not a legal conclusion. WCAG and EN 301 549
cover only what automated tooling can check; conformance and the BFSG
obligations around it are broader. Treat the report as one input to a
compliance assessment, not the assessment itself.
