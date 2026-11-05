# Security policy

## Supported versions

Fixes go into the latest release. Upgrade to it before reporting.

## Reporting a vulnerability

Report it privately through GitHub:
[open a private report](https://github.com/magnoscg/agent-build/security/advisories/new),
or use "Report a vulnerability" in the Security tab. Please do not open a
public issue, pull request or discussion about it.

Include the version, the browser, a page or steps that show the problem, and
what an attacker gains. You will get an answer as soon as possible. The aim
is to release a fix before the details are public, crediting you unless you
prefer otherwise.

## Scope

In scope:

- Script execution, or a way around a Content Security Policy or Trusted
  Types, caused by the library.
- The library revealing content the page hides, or changing the page in a way
  that outlives a run.
- The published package and the release workflow: what is built, signed and
  published.

Out of scope:

- Values the page itself writes in `data-agent-*` attributes or passes to
  `start()`. They are configuration, like the page's own code; the README
  says to never take them from untrusted content.
- The hosting of the demo page.

## What is already in place

- No runtime dependencies. Development dependencies are pinned to exact
  versions, and workflow actions to full commit SHAs.
- No HTML strings, `eval` or inline styles: the library runs under
  `require-trusted-types-for 'script'` with no Trusted Types policy.
- CDN snippets carry Subresource Integrity hashes, and npm releases carry
  provenance from the release workflow.
