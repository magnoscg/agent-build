# Changelog

Every notable change to agent-build. Versions follow
[Semantic Versioning](https://semver.org/), and each release is tagged `X.Y.Z`
on `main`. `pnpm release:prepare X.Y.Z` turns the unreleased notes into the
notes of that version.

## Unreleased

### Fixed

- A turned element gets a box of its own size and angle, drawn from its
  turned corners, instead of the upright rectangle around it.

## 1.0.0 - 2026-11-05

### Added

- A swarm of agent cursors that hides the page and rebuilds it block by block,
  with selection boxes, sizes, layout guides, canvas rulers and a HUD that
  says it is a simulation.
- Three entries: a classic script that defines `window.AgentBuild`, an ES
  module with typed named exports and no side effects, and an `auto` entry.
  `<agent-build-button>` works in any framework.
- Options as data attributes or `start()` options: `pace`, `count`, `accent`,
  `hub`, `frames`, `atoms` and `pop`, validated and clamped.
- The `agentbuild:start` and `agentbuild:end` events.
- Eight languages, `de`, `en`, `es`, `fr`, `it`, `nl`, `pt` and `sv`, matched
  by BCP 47 subtags, and `addLocale()` for any other, which refuses texts that
  do not say "Simulation".
- Accessibility: nothing runs under reduced motion, Escape ends a run, focus
  and scroll go back where they were, announcements come from a live region,
  and the HUD carries its own `lang` and `dir`.
- A strict Content Security Policy with Trusted Types is enough: no inline
  styles, no HTML strings and no `eval`.
