# Example report

A real `bfsg-scanner` run against the five "before" pages of the
[W3C WAI Before/After Demonstration](https://www.w3.org/WAI/demos/bad/) — a
site the W3C publishes specifically as a deliberately inaccessible example
for accessibility tooling.

| File | What |
|------|------|
| [`report.html`](./report.html) | The English HTML report — self-contained, open it in a browser |
| [`report.de.html`](./report.de.html) | The same report in German |
| [`report.json`](./report.json) | The machine-readable report (`schemaVersion: 1`) |
| [`report.pdf`](./report.pdf) | The HTML report printed to A4 |
| [`report-screenshot.png`](./report-screenshot.png) | Screenshot of the top of `report.html` |

The rendered HTML report is also served on GitHub Pages —
see the link in the project README.

To make your own:

```sh
npx bfsg-scanner https://your-site.example
```
