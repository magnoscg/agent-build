# Changelog

Every notable change to agent-build. Versions follow
[Semantic Versioning](https://semver.org/), and each release is tagged `X.Y.Z`
on `main`. `pnpm release:prepare X.Y.Z` turns the unreleased notes into the
notes of that version.

## Unreleased

## 1.0.4 - 2026-11-06

### Changed

- The demo page opens with an intro: the agents loiter and complain around one
  big round button that puts them to work. Links to a section or a language
  skip it, and reduced motion never sees it.

## 1.0.3 - 2026-11-06

### Changed

- The demo uses the new logo as its icon and favicon.

## 1.0.2 - 2026-11-06

### Changed

- The README opens with a logo, badges and links to the demo in every
  language of the simulation.

## 1.0.1 - 2026-11-06

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
