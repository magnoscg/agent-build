# AGENTS.md

How to work on agent-build, for coding agents and people alike. Read it before
changing anything. [CONTRIBUTING.md](CONTRIBUTING.md) has the workflow for pull
requests and releases, and the [README](README.md) documents the library for
its users.

## What this is

A browser library that hides a web page and has a simulated swarm of AI agent
cursors rebuild it, block by block, while a HUD says it is a simulation. It is
TypeScript compiled to a classic script, ES modules and a stylesheet, with no
runtime dependencies, and it must work on any page: unknown markup, any
framework, a strict Content Security Policy with Trusted Types.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm typecheck     # tsc, strict
pnpm test:unit     # node --test on src/ directly, no build needed
pnpm build         # dist/
pnpm test:dist     # the built files, the exports, TypeScript consumers
pnpm smoke         # the built library in Google Chrome, sandboxed
pnpm demo          # http://127.0.0.1:4173/
```

A change is done when `typecheck`, `test:unit`, `build` and `test:dist` pass,
and `smoke` too when it changes anything that runs in the browser. CI runs all
but `smoke`, which needs Google Chrome.

## Map

| Path | What lives there |
|---|---|
| `src/index.ts` | The public API. No side effects: it is imported on servers |
| `src/auto.ts` | The only entry with side effects: `window.AgentBuild`, the custom element, mounting |
| `src/mount.ts` | Showing and labelling triggers, the click listener, `addLocale()` |
| `src/element.ts` | `<agent-build-button>` |
| `src/options.ts` | Every option: default, limits, validation |
| `src/locales/` | One data file per language, and the registry that resolves and checks them |
| `src/layers.ts` | Which elements become layers. Pure functions, tested with a fake DOM |
| `src/geometry.ts` | Where a block is, turned with the element. Pure functions plus one DOM reader |
| `src/page.ts` | Feature checks and the attributes that hold a run's state |
| `src/run/` | One run, from `run.ts`: building, revealing, overlays, HUD, scrolling |
| `src/agent-build.css` | Hiding, revealing, overlays and the default button, in `@layer agent-build` |
| `scripts/` | `build.mjs`, `serve.mjs`, `smoke.mjs`, `sri.mjs`, `release.mjs` |
| `test/unit/` | The source: layers, options, languages, promises, docs, release script |
| `test/dist/` | The build: exports, Node ESM, TypeScript consumers under `bundler` and `nodenext` |
| `test/release/` | The README snippets: version and integrity hashes. Release branches and tags only |
| `test/fixtures/` | Pages for the smoke test, each with a strict CSP |

## Promises

A change must keep every one of these. The tests named guard them; never
weaken a test to make a change pass.

1. **It says it is a simulation.** In every language, the HUD label and both
   announcements open with the language's word for "Simulation", and the
   summary contains it. `addLocale()` refuses texts that do not, and a shipped
   language cannot change its word. (`test/unit/language.test.mjs`)
2. **Nothing runs under reduced motion.** The stylesheet hides the trigger,
   `start()` refuses, and a run stops when the preference changes.
   (`test/unit/guarantees.test.mjs`, smoke)
3. **The trigger ships `hidden`.** Only the script shows it, once the
   stylesheet and the browser features are confirmed. (guarantees, smoke)
4. **No HTML strings, no `eval`, no inline styles.** No `innerHTML`,
   `outerHTML`, `insertAdjacentHTML`, `document.write`, `new Function`, `style`
   attributes or `cssText`. Styles go through the CSSOM or Web Animations. It
   runs under `require-trusted-types-for 'script'` with no policy. (guarantees,
   smoke fixtures)
5. **The page is never rewritten.** Hiding uses `visibility`, so the layout
   never moves. A run's state lives in `data-agent-build-run` and
   `data-agent-build-reveal`, never in the page's classes. What the page hides
   stays hidden. (smoke)
6. **Every class the stylesheet adds starts with `agent-build`**, and its
   rules live in the `agent-build` cascade layer so the page's own rules win.
   (guarantees)
7. **The main entry has no side effects.** Anything that touches `window` or
   the document at import time belongs in `src/auto.ts`. (`test/dist/`)
8. **A run always ends and cleans up**: time cap, Escape, `stop()`, a width
   change or reduced motion, with focus and scroll handed back. (smoke)
9. **Supply chain.** No runtime dependencies. Development dependencies are
   pinned to exact versions, and workflow actions to full commit SHAs.
   (guarantees)

## Common changes

### Add a language

1. Copy `src/locales/en.ts` to `src/locales/<tag>.ts` and translate every
   value. Keep the `{placeholders}`. Give `agents` one form per plural category
   of the language, as `Intl.PluralRules` names them, plus `other`.
2. Import it in `src/locales/index.ts` and add it to the shipped languages.
3. Add its row to the Languages table in `README.md`, its link to
   `index.html` and its tag to `LANGUAGES` in `demo/demo.js`.
4. Add its word for "Simulation" to `DISCLOSURES` in
   `test/unit/language.test.mjs`.
5. `pnpm test:unit` checks every step above. A native speaker should review
   the texts.

### Add an option

1. `src/options.ts`: its key, default and validation. Bad values fall back to
   the default with a warning; numbers are clamped.
2. A row in the Options table of `README.md`, in the existing format: a test
   compares the table with `OPTION_KEYS`.
3. Unit tests in `test/unit/config.test.mjs`.

### Change the look

Edit `src/agent-build.css`, inside `@layer agent-build`, with class names
that start with `agent-build-` and colours from the palette variables. From
TypeScript, set styles only through `element.style.setProperty()` or Web
Animations.

### Add a framework recipe

Use only paths the tests cover: a button with its own text and `mount()` once
the component is on the page, a click handler that calls `start({ trigger })`,
or `<agent-build-button>`. Never load the `auto` entry before a framework
hydrates the markup it owns.

## Conventions

- TypeScript with erasable syntax only and `.ts` import specifiers, because
  Node runs the unit tests on the source without a build.
- Match the code around you. Comments say why, not what. Test names state the
  behaviour, and test bodies have no comments.
- A new check should fail when the change it guards is undone: try it.
- English everywhere: code, comments, docs, commits.
- pnpm only. A new dependency needs a reason, an exact version and a release at
  least seven days old.
- Browser automation uses the system Chrome (`channel: 'chrome'`) with
  `chromiumSandbox: true`, never `--no-sandbox`.

## Git

- Gitflow. `feature/*` branches from `develop` and back into it through a pull
  request. `release/X.Y.Z` from `develop` into `main`, tagged `X.Y.Z` without
  a `v`. `hotfix/*` from `main`.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`,
  `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
- No `Co-Authored-By` trailers for AI tools.
- `dist/` is never committed. A version tag triggers the release workflow.

## Decisions

- The repository is `magnoscg/agent-build`, the maintainer's personal
  account, by the owner's choice, and the package is `@magnoscg/agent-build`.
- Browsers from 2022: the hiding needs cascade layers. Without them, or
  without Web Animations, the trigger stays hidden.
- Pages with an unknown language get English, with the right `lang`.
- The README's CDN snippets and integrity hashes describe the last published
  version. `test:release` checks them on release branches and tags only.
