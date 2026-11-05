# Contributing

Thank you for helping. Bug reports, languages, fixes and ideas are all
welcome. [AGENTS.md](AGENTS.md) maps the repository and lists the promises
every change keeps; read it first, whether you are a person or a coding agent.

## Before you start

- **A bug**: open an issue with the bug form. A page or a small HTML file that
  shows it is worth more than a description.
- **A feature**: open an issue first, so the idea can be shaped before the
  code is written.
- **A language**: use the new language form, or send a pull request as
  described in [Adding a language](#adding-a-language).
- **A vulnerability**: never in a public issue. See [SECURITY.md](SECURITY.md).

Everyone involved follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node 24 or later and [pnpm](https://pnpm.io/installation) 11.

```sh
git clone https://github.com/magnoscg/agent-build.git
cd agent-build
pnpm install --frozen-lockfile
pnpm demo
```

The smoke test needs Google Chrome installed.

## Making a change

1. Branch from `develop`: `git switch -c feature/short-name develop`.
2. Write the change and its tests. A test you add should fail when the change
   it guards is undone.
3. Run the checks:

   ```sh
   pnpm typecheck && pnpm test:unit && pnpm build && pnpm test:dist
   pnpm smoke   # when it changes anything that runs in the browser
   ```

4. If users will notice it, update the README and add a line under
   "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/),
   in English: `fix: keep focus on the trigger after Escape`.
6. Open a pull request against `develop` and fill in the template. CI runs
   on Node 24 and 26.

Keep pull requests to one topic. Match the style of the code around you:
comments say why rather than what, test names state the behaviour, and the
library takes no runtime dependencies.

## Adding a language

1. Copy `src/locales/en.ts` to `src/locales/<tag>.ts`, where `<tag>` is the
   BCP 47 tag a page would carry in `lang`, and translate every value.
   - `kicker` is the language's word for "Simulation". `label`, `started`
     and `finished` open with it, and `built` contains it.
   - Keep `{count}`, `{done}`, `{total}` and `{seconds}` where they belong.
   - `agents` has one form per plural category of the language, as
     `Intl.PluralRules` names them (`one`, `few`, `many`…), and always
     `other`.
   - Add `dir: 'rtl'` for a right-to-left language.
2. Import it in `src/locales/index.ts` and add it to the shipped languages.
3. Add its row to the Languages table in `README.md`, its link to
   `index.html` and its tag to `LANGUAGES` in `demo/demo.js`.
4. Add its word for "Simulation" to `DISCLOSURES` in
   `test/unit/language.test.mjs`.
5. Run `pnpm test:unit`, which checks all of the above, and look at it with
   `pnpm demo` and `?lang=<tag>`.

Translations from native speakers are best. If you are not one, say so in
the pull request so someone can review it.

## Releasing

For maintainers. Versions follow [Semantic Versioning](https://semver.org/),
and tags are `X.Y.Z` without a `v`.

1. `git switch -c release/X.Y.Z develop`
2. `pnpm release:prepare X.Y.Z` writes the version into `package.json`,
   `src/version.ts`, the README and the demo, gives the unreleased changelog
   notes a dated heading, builds, and refreshes the integrity hashes.
3. Review the diff, commit it as `chore(release): X.Y.Z` and push the branch.
   CI runs `test:release` on it.
4. Merge it into `main` without fast-forward, tag `main` with an annotated
   `X.Y.Z` tag and push both. The release workflow checks the tagged commit,
   publishes it to npm with provenance, creates the GitHub Release with the
   built files, and deploys the demo to GitHub Pages.
5. Merge `main` back into `develop`.

### Once, before the first release

- **npm.** The `@magnoscg` scope needs an npm account. Add a trusted
  publisher to the package for the repository `magnoscg/agent-build` and the
  workflow `release.yml`. If npm only offers that once the package exists,
  publish the first version by hand from the tagged commit, after
  `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm test:release`, with
  `pnpm publish --access public`. Then add the trusted publisher. The workflow
  skips a version that is already on npm and carries on with the rest.
- **GitHub Pages.** In the repository settings, set the Pages source to
  GitHub Actions. That creates the `github-pages` environment, which at first
  deploys only from the default branch: under Settings → Environments →
  `github-pages`, add a tag rule such as `*.*.*`, or the deploy of a release
  tag is refused.
- **Private vulnerability reporting.** Turn it on in the repository's
  security settings, since [SECURITY.md](SECURITY.md) points to it.
