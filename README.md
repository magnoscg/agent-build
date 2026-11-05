# agent-build

A simulated swarm of AI agents rebuilds your page, block by block.

One button hides the page and a swarm of agent cursors (planner, ui, copy,
layout, qa, a11y, perf, i18n) puts it back together, with selection boxes,
sizes, layout guides, canvas rulers and a HUD that tells your visitors it is a
simulation. Vanilla JavaScript and CSS, no dependencies, no build step. It
works on any page without configuration, including pages with a strict
Content Security Policy and Trusted Types.

**[Live demo](https://magnoscg.github.io/agent-build/)**

![The demo page halfway through a run: selection boxes with tags and sizes, agent cursors with role names, rulers, guides and the HUD](demo/screenshot.png)

## Quick start

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@magnoscg/agent-build@1.0.0/dist/agent-build.css" integrity="sha384-crlu5HFBkzAGiZJnrNzC+LIuus1TWtFBxHf2ZZPAdlocNAzB9iqPdp2Xao/q0q36" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/@magnoscg/agent-build@1.0.0/dist/agent-build.js" integrity="sha384-QEspZHO+uaBwIqiLXN1S5HLqHANbXZEw0IPv6bRg6Aft+R/aoVBjqmmeoKeb/Ma8" crossorigin="anonymous" defer></script>
<button data-agent-build hidden></button>
```

That is all. The script shows the button, labels it in the page's language,
gives it a default look and runs the simulation on click. Put it wherever you
like: the hero, the footer, an easter egg.

The button ships `hidden` on purpose. It only appears when the script runs and
the browser can play the simulation, and never for visitors who prefer reduced
motion.

The `integrity` hashes make the browser refuse anything but these exact
files, so a compromised CDN cannot serve you something else. They change with
every version: take the snippet from the README of the version you use.

### Self-hosted or from npm

The library is two files, `agent-build.js` (or `agent-build.min.js`) and
`agent-build.css`. Take them from the npm package or from jsDelivr and serve
them next to your site, or install the package:

```sh
pnpm add @magnoscg/agent-build
```

```js
import { start, stop } from '@magnoscg/agent-build';
import '@magnoscg/agent-build/agent-build.css';
```

The package entry is an ES module with typed named exports and no side
effects, so it is safe to import during server-side rendering, where
`start()` returns `false`. `import '@magnoscg/agent-build/auto'` does what the
`<script>` tag does: it defines `window.AgentBuild` and `<agent-build-button>`
and mounts the `[data-agent-build]` buttons. Both entries share one run.

## Options

Set them as data attributes on the button, or pass them to
`AgentBuild.start()`, which wins over the attributes.

| Attribute | Option | Default | What it does |
|---|---|---|---|
| `data-agent-pace` | `pace` | `1` | Multiplies every duration, from 0.25 to 4. `2` is twice as slow. |
| `data-agent-count` | `count` | `20`, or `14` under 720 px | How many agents, from 1 to 40. |
| `data-agent-accent` | `accent` | `#7C6BFF` | Any CSS colour, for boxes, guides and the progress bar. |
| `data-agent-hub` | `hub` | Four blocks, inline SVG | URL of the icon the agents fly out of, usually your logo. |
| `data-agent-frames` | `frames` | `header, footer, section, article, aside` | Selector for boxes: their box is revealed first, their content later. |
| `data-agent-atoms` | `atoms` | Headings, `p`, `li`, `dt`, `dd`, `blockquote`, `pre`, media, `table`, links, buttons and form controls | Selector for blocks revealed whole. |
| `data-agent-pop` | `pop` | Media, buttons, form controls, `.button`, `.btn`, `[role="button"]` | Selector for the blocks that fade in instead of being typed. |

```html
<button data-agent-build data-agent-pace="1.5" data-agent-count="12"
        data-agent-accent="#0A84FF" data-agent-hub="/logo.svg" hidden></button>
```

A broken selector or colour falls back to the default with a console warning,
and numbers are clamped, so a typo never breaks the page.

### Styling

- `--agent-accent` sets the accent colour from your CSS, on `:root` or on the
  button. `--agent-mono` sets the monospace font of the labels and the HUD.
- A trigger without a `class` attribute takes the default look. Give it your
  own classes and it is yours to style; add `agent-build-button` next to them
  to keep the default. The default look lives in the `agent-build` cascade
  layer, so any rule of your page wins over it.
- The five agent dots are available for your own button:
  `<span class="agent-build-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`.
  They hop in a wave while the button is hovered or focused, unless the
  visitor prefers reduced motion.

## API

```js
AgentBuild.start(options) // true if a run started
AgentBuild.stop()         // true if a run was stopped
AgentBuild.isRunning()    // true while a run is in progress
AgentBuild.mount(root)    // shows the [data-agent-build] triggers in root (document by default)
AgentBuild.addLocale(tag, texts) // adds or replaces a language, see Languages
AgentBuild.version        // "1.0.0"
```

The ES module exports the same functions, plus `defineElement()`, all typed.

`start()` accepts the options above plus `trigger`, the element whose data
attributes and language it reads. Without one it reads the first
`[data-agent-build]` on the page. It returns `false`, and does
nothing, when a run is already in progress, the visitor prefers reduced
motion, the browser lacks Web Animations or cascade layers, or the stylesheet
is not loaded.

A trigger only appears when it can run: it stays `hidden` without the
stylesheet, without cascade layers or Web Animations, and under reduced
motion. One click listener on the document serves every trigger, present or
future, and it runs after your own handlers: a framework's handler that calls
`start()` with its options, or calls `preventDefault()`, wins the click.

### Frameworks and late buttons

Buttons rendered after the page loaded need showing once: call
`AgentBuild.mount()` (or `mount()` from the module) after rendering them. It is
safe to call as often as you like. Or use the custom element, which mounts
itself whenever it enters the document and works in any framework:

```html
<agent-build-button label="Watch the agents build it" data-agent-count="12"></agent-build-button>
```

It renders a `<button data-agent-build>` inside itself and passes on its
`data-agent-*` options; without a `label` it uses the default one in the
page's language. The `<script>` tag and the `auto` entry define it; with the
module alone, call `defineElement()`.

### Events

Both are dispatched on `document` and bubble to `window`.

| Event | When | `event.detail` |
|---|---|---|
| `agentbuild:start` | Before anything is measured or hidden | `{ trigger }`, the one pressed or passed to `start()`, else `null` |
| `agentbuild:end` | Once the page is back, however the run ended | `{ skipped, built, total, seconds }` |

`agentbuild:start` is the place to put scroll-reveal effects in their final
state. The library waits for the transitions they start, up to a second and
a half, so the agents measure the page as it really looks:

```js
document.addEventListener('agentbuild:start', () => {
  for (const element of document.querySelectorAll('[data-reveal]')) {
    element.classList.add('is-revealed');
  }
});
```

### Languages

The HUD, the button's default label and the announcements follow the nearest
`lang` attribute of the trigger, matched by subtags: `pt-BR` gets `pt`,
`es-MX` gets `es`. Any other language gets English, and the label says so in
its own `lang`.

| Tag | Language | Word for "Simulation" |
|---|---|---|
| `de` | Deutsch | Simulation |
| `en` | English | Simulation |
| `es` | español | Simulación |
| `fr` | français | Simulation |
| `it` | italiano | Simulazione |
| `nl` | Nederlands | Simulatie |
| `pt` | português | Simulação |
| `sv` | svenska | Simulering |

`addLocale()` adds a language, or replaces one, at any time: the labels the
library gave its triggers follow. It throws unless the label and both
announcements open with the language's `kicker`, its word for "Simulation",
and the summary says it. A shipped language, or a regional variant of one
such as `es-ES`, has to keep the word in the table. `agents` holds a form per plural
category of the language, as `Intl.PluralRules` names them, and always
`other`. Add `dir: 'rtl'` for a right-to-left language.

```js
AgentBuild.addLocale('ca', {
  kicker: 'Simulació',
  label: "Simulació: agents d'IA construint la pàgina",
  cta: 'Mira com els agents construeixen la pàgina',
  agents: { one: '{count} agent', other: '{count} agents' },
  layers: '{done}/{total} capes',
  pause: 'Pausa',
  resume: 'Continua',
  finish: 'Acaba',
  started: "Simulació en curs: un eixam d'agents d'IA està construint la pàgina. Prem Esc per acabar.",
  built: 'Construïda en {seconds} s · era una simulació',
  finished: 'Simulació acabada. La pàgina està completa.',
});
```

## How it picks the blocks

The page is measured while it is still visible, then hidden. Every element
under `<body>` is one of these, in document order:

- A **frame** matches `frames`, or paints a box of its own (a background, a
  shadow or a border all round), or holds loose text next to other blocks. Its
  box is revealed first and it is looked inside; what it holds waits for it,
  then gets built part by part.
- An **atom** matches `atoms`, or holds loose text, or is an SVG, a MathML
  formula or a component with a shadow root. It is revealed with everything
  inside it, which is how nested matches are deduplicated: a link inside a
  paragraph is part of the paragraph. A link that wraps blocks, the usual
  card, counts as a frame. A block that holds media and no text, like a link
  around a screenshot or a store badge, is labelled as its media and fades in.
- Whatever no layer covers, such as an icon-font glyph or a component with a
  closed shadow root, and whatever is fixed to the window, is shown as it is
  rather than hidden: right away, or together with its frame.
- What the page hides itself stays hidden, during the run and after.

A run builds for about twenty seconds, pauses aside, whatever the pace and
count; then the rest of the page appears at once. Each block is measured again
when its agent takes it, so fonts, images or transitions that move things
cannot leave a box behind. When the page scrolls an inner container instead of
the document, the blocks in view are built and the rest is shown as it is.

The run's state lives in attributes of its own, `data-agent-build-run` on
`<html>` and `data-agent-build-reveal` on the revealed blocks, never in your
classes, so a framework that rewrites `class` cannot undo it.

## Accessibility

- It says what it is. The HUD opens with the word for "Simulation", and the
  screen reader announcements at the start and the end do too, in every
  language it ships or accepts.
- Under `prefers-reduced-motion: reduce` the button never appears,
  `start()` refuses to run, and a run in progress stops if the preference
  changes.
- When a run starts, focus moves to the HUD's Pause button, whose label says
  what it does next: Pause or Resume. Escape finishes at any time. At the end,
  focus returns to where it was, or to the trigger, and the page scrolls back
  to where the visitor was, unless they scrolled during the run.
- The HUD and the announcements carry their own `lang` and `dir`. The live
  region is in place from the start of the run, so the first announcement is
  heard. Right-to-left text is typed from the right.
- It never rewrites content. It hides blocks with `visibility` and reveals
  them with Web Animations, so the layout never shifts. Hidden content is
  hidden from assistive technology too while the run lasts, which is why the
  run is short, announced, and can be stopped at once.
- The overlays (cursors, boxes, rulers) are `aria-hidden`. Only the HUD and
  its two buttons are exposed.

## Content Security Policy

- **No inline styles.** Dynamic styles go through the CSSOM and Web
  Animations, which `style-src` does not restrict, so `style-src 'self'` is
  enough without `'unsafe-inline'`.
- **No HTML strings.** Every node is built with `createElement`, never
  `innerHTML`, and there is no `eval`. It runs with
  `require-trusted-types-for 'script'` and no Trusted Types policy at all.
- **CDN or self-hosted.** From jsDelivr, allow `https://cdn.jsdelivr.net` in
  `script-src` and `style-src`. Self-hosted, `'self'` covers both.
- **Images.** The default hub icon is inline SVG, so `img-src` never needs
  `data:`. A `data-agent-hub` URL has to be allowed by your `img-src`.

The demo page runs under `default-src 'self'; script-src 'self'; style-src
'self'; img-src 'self'; require-trusted-types-for 'script'; trusted-types
'none'`, and the browser smoke test fails on any CSP violation.

## Browser support

Current Chrome, Edge, Firefox and Safari, from 2022 on: the hiding relies on
cascade layers. Where cascade layers or Web Animations are missing, the
button simply stays hidden. The HUD and the top ruler go to the top layer
through the Popover API where it exists (2024 on), out of reach of the page's
stacking contexts. The automated smoke test runs in Chrome; Safari and Firefox
are not tested automatically yet.

## Development

The source is TypeScript in `src/`, built with esbuild into `dist/`, which is
not committed.

```sh
pnpm install       # TypeScript, esbuild and playwright-core
pnpm typecheck     # tsc, strict
pnpm test:unit     # node --test on src/ directly: layers, languages, options, guarantees
pnpm build         # dist/: classic script, ES module, stylesheet and types
pnpm test:dist     # the built files: exports, Node ESM imports, TypeScript consumers
pnpm smoke         # the real library in your installed Chrome, sandboxed
pnpm demo          # the demo at http://127.0.0.1:4173/
pnpm test:release  # the snippets' version and integrity hashes, before a release
```

CI runs everything but the smoke test, on Node 24 and 26; the smoke test needs
Google Chrome installed and runs locally.

## Credits

Inspired by [swarm-site](https://califa.github.io/swarm-site/) and a video by
[@EHuanglu](https://x.com/EHuanglu) on X. No code was taken from either:
agent-build is an original implementation, first written for
[ogamlabs.com](https://ogamlabs.com).

## License

[MIT](LICENSE) © 2026 Oscar Canton
