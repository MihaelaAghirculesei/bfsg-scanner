# Security policy

## Supported versions

This is a `0.x` project. Security fixes are released only for the most
recent version published on npm.

| Version | Supported |
|---------|-----------|
| latest release | yes |
| anything older | no |

## Reporting a vulnerability

Please report suspected vulnerabilities privately, not as a public issue.

Use GitHub's **"Report a vulnerability"** button on the
[Security Advisories page](https://github.com/MihaelaAghirculesei/bfsg-scanner/security/advisories/new).
It opens a private advisory visible only to you and the maintainer.

You can expect an acknowledgement within about a week. If a fix is
warranted it will be released as a new patch version, and the advisory
published with credit to the reporter unless you ask otherwise.

## Scope

`bfsg-scanner` drives a real browser and sends real traffic to whatever
site it is pointed at. Reports about the tool itself — dependency
vulnerabilities, unsafe handling of scanned page content, the report
files it writes — are in scope. The accessibility of a site you scanned
with it is not.
