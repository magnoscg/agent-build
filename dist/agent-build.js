/*! agent-build 1.0.0 | MIT License | https://github.com/magnoscg/agent-build */
/* agent-build: a simulation in which a swarm of AI agents rebuilds the page
 * in front of the visitor.
 *
 * Load dist/agent-build.css, this script with `defer`, and add
 * <button data-agent-build hidden></button>. The script shows the button.
 * A click scrolls to the top and hides the page's blocks. Agents fly out of a
 * hub icon: cursors, each named after a role. Each one takes the next block,
 * draws its selection box with tag and size, and reveals it, while the page
 * scrolls along behind the work. Canvas rulers and layout guides frame it. A
 * HUD at the bottom counts the layers and lets the visitor pause or finish;
 * Escape finishes too.
 *
 * It is a dramatisation and says so. The HUD and the screen reader
 * announcement open with the word for "simulation" in every language it
 * ships. It never rewrites content: blocks are hidden with `visibility`,
 * which keeps the layout still, and revealed with Web Animations. Its own
 * layers are removed when it ends.
 *
 * Built for strict pages. Every node is made with createElement, never
 * innerHTML, so Trusted Types have nothing to block. Dynamic styles go
 * through CSSOM and Web Animations, never `style` attributes, so
 * `style-src 'self'` is enough.
 *
 * Progressive enhancement. The button ships `hidden` and only this script
 * shows it. Under prefers-reduced-motion, or without Web Animations, it stays
 * hidden and AgentBuild.start() refuses to run.
 */
(() => {
  'use strict';

  const VERSION = '1.0.0';
  const HTML_NS = 'http://www.w3.org/1999/xhtml';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* Texts for the HUD, the screen reader announcements and the default
     button label. Each language opens with its word for "simulation", and
     the tests hold every one of them to it. Other languages get English. */
  const TEXTS = {
    es: {
      kicker: 'Simulación',
      label: 'Simulación: agentes de IA montando la página',
      cta: 'Mira cómo la montan los agentes',
      agents: (count) => `${count} ${count === 1 ? 'agente' : 'agentes'}`,
      layers: (done, total) => `${done}/${total} capas`,
      pause: 'Pausa',
      resume: 'Seguir',
      finish: 'Terminar',
      started: 'Simulación en curso: un enjambre de agentes de IA monta la página. Pulsa Escape para terminar.',
      built: (seconds) => `Montada en ${seconds} s · era una simulación`,
      finished: 'Simulación terminada. La página está completa.',
    },
    en: {
      kicker: 'Simulation',
      label: 'Simulation: AI agents building the page',
      cta: 'Watch the agents build it',
      agents: (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`,
      layers: (done, total) => `${done}/${total} layers`,
      pause: 'Pause',
      resume: 'Resume',
      finish: 'Finish',
      started: 'Simulation running: a swarm of AI agents is building the page. Press Escape to finish.',
      built: (seconds) => `Built in ${seconds} s · it was a simulation`,
      finished: 'Simulation finished. The page is complete.',
    },
    fr: {
      kicker: 'Simulation',
      label: 'Simulation : des agents d’IA construisent la page',
      cta: 'Regardez les agents construire la page',
      agents: (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`,
      layers: (done, total) => `${done}/${total} calques`,
      pause: 'Pause',
      resume: 'Reprendre',
      finish: 'Terminer',
      started: 'Simulation en cours : un essaim d’agents d’IA construit la page. Appuyez sur Échap pour terminer.',
      built: (seconds) => `Construite en ${seconds} s · c’était une simulation`,
      finished: 'Simulation terminée. La page est complète.',
    },
    de: {
      kicker: 'Simulation',
      label: 'Simulation: KI-Agenten bauen die Seite',
      cta: 'Sieh zu, wie Agenten die Seite bauen',
      agents: (count) => `${count} ${count === 1 ? 'Agent' : 'Agenten'}`,
      layers: (done, total) => `${done}/${total} Ebenen`,
      pause: 'Pause',
      resume: 'Weiter',
      finish: 'Beenden',
      started: 'Simulation läuft: Ein Schwarm von KI-Agenten baut die Seite. Drücke Escape zum Beenden.',
      built: (seconds) => `In ${seconds} s gebaut · es war eine Simulation`,
      finished: 'Simulation beendet. Die Seite ist vollständig.',
    },
    it: {
      kicker: 'Simulazione',
      label: 'Simulazione: agenti di IA che costruiscono la pagina',
      cta: 'Guarda gli agenti costruire la pagina',
      agents: (count) => `${count} ${count === 1 ? 'agente' : 'agenti'}`,
      layers: (done, total) => `${done}/${total} livelli`,
      pause: 'Pausa',
      resume: 'Riprendi',
      finish: 'Termina',
      started: 'Simulazione in corso: uno sciame di agenti di IA costruisce la pagina. Premi Esc per terminare.',
      built: (seconds) => `Costruita in ${seconds} s · era una simulazione`,
      finished: 'Simulazione terminata. La pagina è completa.',
    },
    nl: {
      kicker: 'Simulatie',
      label: 'Simulatie: AI-agents bouwen de pagina',
      cta: 'Kijk hoe agents de pagina bouwen',
      agents: (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`,
      layers: (done, total) => `${done}/${total} lagen`,
      pause: 'Pauze',
      resume: 'Hervatten',
      finish: 'Afronden',
      started: 'Simulatie bezig: een zwerm AI-agents bouwt de pagina. Druk op Escape om af te ronden.',
      built: (seconds) => `Gebouwd in ${seconds} s · het was een simulatie`,
      finished: 'Simulatie afgerond. De pagina is compleet.',
    },
    sv: {
      kicker: 'Simulering',
      label: 'Simulering: AI-agenter bygger sidan',
      cta: 'Se agenterna bygga sidan',
      agents: (count) => `${count} ${count === 1 ? 'agent' : 'agenter'}`,
      layers: (done, total) => `${done}/${total} lager`,
      pause: 'Pausa',
      resume: 'Fortsätt',
      finish: 'Avsluta',
      started: 'Simulering pågår: en svärm av AI-agenter bygger sidan. Tryck på Escape för att avsluta.',
      built: (seconds) => `Byggd på ${seconds} s · det var en simulering`,
      finished: 'Simuleringen är klar. Sidan är komplett.',
    },
  };

  /* What a layer is. A frame reveals only its own box (background, border
     and loose text) and its content comes later. An atom reveals everything
     inside it at once: pop atoms fade in, the rest arrive with a stepped
     sweep, as if typed. Data attributes or start() options replace any of
     these selectors. */
  const DEFAULTS = Object.freeze({
    frames: 'header, footer, section, article, aside',
    atoms: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'pre',
      'figure', 'picture', 'img', 'svg', 'video', 'canvas', 'iframe', 'table',
      'button', 'input', 'select', 'textarea', 'label', 'a',
    ].join(', '),
    pop: 'figure, picture, img, svg, video, canvas, iframe, button, input, select, textarea, '
      + '.button, .btn, [role="button"], [data-agent-build]',
    hub: '',
    pace: 1,
    accent: '',
  });
  /* Twenty agents, or fourteen on narrow screens. At most 160 layers get
     built, about fifteen seconds: on longer pages the rest is shown from
     the start, so nothing waits hidden for minutes. Images still loading
     get up to a second before anything is measured. */
  const AGENTS = Object.freeze({ wide: 20, narrow: 14, breakpoint: 720 });
  const LIMITS = Object.freeze({ pace: [0.25, 4], count: [1, 40], layers: 160, settle: 1000 });

  const OPTION_KEYS = ['frames', 'atoms', 'pop', 'hub', 'pace', 'count', 'accent'];
  /* A link that wraps blocks, the usual card, is a frame: its parts get
     built one by one inside it. */
  const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, figure, picture, img, video, table, blockquote, pre';
  const BUTTONISH = '.button, .btn, [role="button"], [data-agent-build]';
  const SKIP = new Set(['script', 'style', 'template', 'noscript', 'link', 'meta', 'base', 'title', 'slot']);
  const NAMED = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'pre',
    'img', 'svg', 'video', 'canvas', 'iframe', 'table',
    'button', 'input', 'select', 'textarea', 'label', 'summary',
  ]);
  const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'iframe']);
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

  const ROLES = ['planner', 'ui', 'copy', 'layout', 'qa', 'a11y', 'perf', 'i18n'];
  const HUES = 6;
  const RULER = 16;
  const EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
  /* Every building duration is multiplied by BASE_PACE times the pace
     option, so a higher pace means a slower build. */
  const BASE_PACE = 1.4;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function toNumber(value) {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return Number(value);
    }
    return NaN;
  }

  const provided = (value) => value !== undefined && value !== null && value !== '';

  /* The two-letter code of the nearest lang attribute, if it ships texts,
     or English. */
  function resolveLanguage(lang) {
    const code = String(lang || '').trim().slice(0, 2).toLowerCase();
    return Object.prototype.hasOwnProperty.call(TEXTS, code) ? code : 'en';
  }

  function datasetOptions(element) {
    const data = (element && element.dataset) || {};
    return {
      frames: data.agentFrames,
      atoms: data.agentAtoms,
      pop: data.agentPop,
      hub: data.agentHub,
      pace: data.agentPace,
      count: data.agentCount,
      accent: data.agentAccent,
    };
  }

  /* Options passed to start() win over the button's data attributes. */
  function mergeOptions(base, overrides) {
    const merged = Object.assign({}, base);
    if (overrides && typeof overrides === 'object') {
      for (const key of OPTION_KEYS) {
        if (overrides[key] !== undefined && overrides[key] !== null) {
          merged[key] = overrides[key];
        }
      }
    }
    return merged;
  }

  /* Turns raw options into a configuration the run can trust. A broken
     selector or colour falls back to the default with a warning instead of
     breaking the page; numbers are clamped. */
  function normalizeOptions(raw, env) {
    const source = raw || {};
    const settings = env || {};
    const isSelector = settings.isSelector || (() => true);
    const isColor = settings.isColor || (() => false);
    const warn = settings.warn || (() => {});

    const selector = (key) => {
      const value = source[key];
      if (typeof value !== 'string' || value.trim() === '') {
        return DEFAULTS[key];
      }
      if (isSelector(value)) {
        return value;
      }
      warn(`ignoring the invalid ${key} selector "${value}"`);
      return DEFAULTS[key];
    };

    const pace = toNumber(source.pace);
    if (provided(source.pace) && !(pace > 0)) {
      warn(`ignoring the invalid pace "${source.pace}"`);
    }
    const count = toNumber(source.count);
    if (provided(source.count) && !(count >= 1)) {
      warn(`ignoring the invalid count "${source.count}"`);
    }
    let accent = typeof source.accent === 'string' ? source.accent.trim() : '';
    if (accent && !isColor(accent)) {
      warn(`ignoring the invalid accent "${accent}"`);
      accent = '';
    }

    return {
      frames: selector('frames'),
      atoms: selector('atoms'),
      pop: selector('pop'),
      hub: typeof source.hub === 'string' ? source.hub.trim() : '',
      pace: pace > 0 ? clamp(pace, LIMITS.pace[0], LIMITS.pace[1]) : DEFAULTS.pace,
      count: count >= 1
        ? Math.round(clamp(count, LIMITS.count[0], LIMITS.count[1]))
        : (settings.narrow ? AGENTS.narrow : AGENTS.wide),
      accent,
    };
  }

  function hasOwnText(element) {
    for (const node of element.childNodes) {
      if (node.nodeType === 3 && /\S/.test(node.nodeValue)) {
        return true;
      }
    }
    return false;
  }

  /* Reads a computed colour: transparent, rgba(…, 0) or anything ending in
     "/ 0)". */
  function isTransparent(color) {
    const value = String(color || '').trim().toLowerCase();
    if (value === '' || value === 'transparent') {
      return true;
    }
    if (!value.endsWith(')')) {
      return false;
    }
    const inner = value.slice(value.indexOf('(') + 1, -1);
    const slash = inner.lastIndexOf('/');
    let alpha;
    if (slash !== -1) {
      alpha = inner.slice(slash + 1);
    } else if (/^(rgba|hsla)\(/.test(value)) {
      alpha = inner.split(',')[3];
    }
    return alpha !== undefined && parseFloat(alpha) === 0;
  }

  /* An element that paints a box of its own: a background, a shadow or a
     border all round. Such an element becomes a frame even when no selector
     names it, so cards built from plain divs get built too. */
  function paintsBox(style) {
    if (!style) {
      return false;
    }
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      return true;
    }
    if (!isTransparent(style.backgroundColor)) {
      return true;
    }
    if (style.boxShadow && style.boxShadow !== 'none') {
      return true;
    }
    return SIDES.every((side) => parseFloat(style[`border${side}Width`]) > 0
      && !/^(none|hidden)$/.test(style[`border${side}Style`])
      && !isTransparent(style[`border${side}Color`]));
  }

  /* Decides what an element is: 'frame', 'pop', 'type', null when it is
     only a wrapper to look inside, or 'skip' when neither it nor anything in
     it should be looked at. Explicit frames win, then atoms. Then come the
     safety nets that keep any page from waiting hidden: loose text is typed
     (or becomes a frame when blocks sit next to it), and a painted box is a
     frame. */
  function makeClassifier(config, getStyle) {
    const candidates = `${config.frames}, ${config.atoms}`;
    return (element) => {
      const name = element.localName;
      if (SKIP.has(name) || element.classList.contains('agent-build-layer')) {
        return 'skip';
      }
      if (element.namespaceURI !== HTML_NS && name !== 'svg') {
        return 'skip';
      }
      if (element.matches(config.frames)) {
        return 'frame';
      }
      if (element.matches(config.atoms) || element.shadowRoot) {
        const pop = element.matches(config.pop);
        if (name === 'a' && !pop && element.querySelector(BLOCKS)) {
          return 'frame';
        }
        return pop || element.shadowRoot ? 'pop' : 'type';
      }
      if (hasOwnText(element)) {
        if (element.querySelector(candidates)) {
          return 'frame';
        }
        return element.matches(config.pop) ? 'pop' : 'type';
      }
      return paintsBox(getStyle(element)) ? 'frame' : null;
    };
  }

  /* Walks the tree in document order. Frames are kept and looked inside;
     atoms are kept with everything they hold, which is how nested matches
     are deduplicated. Anything smaller than 2 px is not a layer, but what it
     holds may be. */
  function selectLayers(root, { childrenOf, classify, measure }) {
    const layers = [];
    const visit = (parent) => {
      for (const node of childrenOf(parent)) {
        const kind = classify(node);
        if (kind === 'skip') {
          continue;
        }
        if (kind) {
          const box = measure(node);
          if (box.w >= 2 && box.h >= 2) {
            layers.push({ element: node, kind, index: layers.length, x: box.x, y: box.y, w: box.w, h: box.h });
            if (kind !== 'frame') {
              continue;
            }
          }
        }
        visit(node);
      }
    };
    visit(root);
    return layers;
  }

  function planLayers(layers, max) {
    return { build: layers.slice(0, max), shown: layers.slice(max) };
  }

  /* The label on a selection box. */
  function tagOf(name, kind, buttonLike) {
    if (kind === 'frame') {
      return 'frame';
    }
    if (buttonLike) {
      return 'button';
    }
    if (name === 'a') {
      return 'link';
    }
    if (name === 'picture' || name === 'figure') {
      return 'img';
    }
    if (NAMED.has(name)) {
      return name;
    }
    return kind === 'pop' ? 'block' : 'text';
  }

  /* Column guides come from the edges that repeat most across layers, so
     they follow the page's real grid without knowing it. */
  function columnEdges(layers) {
    const counts = new Map();
    for (const layer of layers) {
      for (const edge of [layer.x, layer.x + layer.w]) {
        const key = Math.round(edge / 2) * 2;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const edges = [];
    for (const [x, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      if (count < 4 || edges.length === 4) {
        break;
      }
      if (edges.every((edge) => Math.abs(edge - x) > 24)) {
        edges.push(x);
      }
    }
    return edges;
  }

  const internals = Object.freeze({
    VERSION, TEXTS, DEFAULTS, AGENTS, LIMITS,
    resolveLanguage, datasetOptions, mergeOptions, normalizeOptions,
    hasOwnText, isTransparent, paintsBox, makeClassifier, selectLayers, planLayers,
    tagOf, columnEdges,
  });

  function inert() {
    return Object.freeze({ version: VERSION, start: () => false, stop: () => false, isRunning: () => false });
  }

  function boot() {
    const root = document.documentElement;
    const probe = document.createDocumentFragment();
    const env = {
      isSelector(selector) {
        try {
          probe.querySelector(selector);
          return true;
        } catch {
          return false;
        }
      },
      isColor(value) {
        return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', value);
      },
      warn(message) {
        console.warn(`[agent-build] ${message}`);
      },
    };
    const fadeOut = [{ opacity: 1 }, { opacity: 0 }];
    let current = null;

    const triggers = () => document.querySelectorAll('[data-agent-build]');
    const reducedMotion = () => typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supported = () => typeof Element.prototype.animate === 'function' && !reducedMotion();
    const cssLoaded = () => getComputedStyle(root).getPropertyValue('--agent-build-css').trim() === '1';
    const languageOf = (element) => ((element && element.closest('[lang]')) || root).getAttribute('lang') || '';

    function el(tag, className, text) {
      const element = document.createElement(tag);
      if (className) {
        element.className = className;
      }
      if (text !== undefined) {
        element.textContent = text;
      }
      return element;
    }

    function makeDots(extra) {
      const dots = el('span', extra ? `agent-build-dots ${extra}` : 'agent-build-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (let index = 0; index < 5; index += 1) {
        dots.append(el('i'));
      }
      return dots;
    }

    function setUpTriggers() {
      if (!supported()) {
        return;
      }
      for (const trigger of triggers()) {
        const text = TEXTS[resolveLanguage(languageOf(trigger))];
        if (trigger.localName === 'button' && !trigger.hasAttribute('type')) {
          trigger.type = 'button';
        }
        /* An empty button gets the five agent dots and a label in the
           page's language, so it always has an accessible name. */
        const named = trigger.textContent.trim() !== ''
          || trigger.hasAttribute('aria-label')
          || trigger.hasAttribute('aria-labelledby')
          || trigger.querySelector('img[alt]:not([alt=""])');
        if (!named) {
          trigger.append(makeDots(), text.cta);
        }
        /* A trigger without classes of its own takes the default look. It
           goes through a class, not :not([class]), because a run adds and
           removes classes on every block it reveals. */
        if (!(trigger.getAttribute('class') || '').trim()) {
          trigger.className = 'agent-build-button';
        }
        const accent = String(trigger.dataset.agentAccent || '').trim();
        if (accent && env.isColor(accent)) {
          trigger.style.setProperty('--agent-accent', accent);
        }
        trigger.addEventListener('click', (event) => {
          event.preventDefault();
          start({ trigger });
        });
        trigger.hidden = false;
      }
    }

    function emit(type, detail) {
      document.dispatchEvent(new CustomEvent(`agentbuild:${type}`, { bubbles: true, detail }));
    }

    /* Starts a run. Options win over the data attributes of the button that
       was pressed or, without one, of the first [data-agent-build] on the
       page. Returns false when it cannot run. */
    function start(options) {
      if (current || !document.body || !supported()) {
        return false;
      }
      if (!cssLoaded()) {
        env.warn('agent-build.css is not loaded, so the page stays as it is');
        return false;
      }
      const given = options && typeof options === 'object' ? options : {};
      const trigger = given.trigger && given.trigger.nodeType === 1
        ? given.trigger
        : document.querySelector('[data-agent-build]');
      const config = normalizeOptions(mergeOptions(datasetOptions(trigger), given),
        Object.assign({ narrow: innerWidth < AGENTS.breakpoint }, env));
      begin(config, resolveLanguage(languageOf(trigger)), trigger);
      return true;
    }

    function stop() {
      if (!current) {
        return false;
      }
      finish(current, true);
      return true;
    }

    async function begin(config, language, trigger) {
      const run = {
        config,
        text: TEXTS[language],
        decimal: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
        pace: BASE_PACE * config.pace,
        trigger,
        returnFocus: document.activeElement,
        running: true,
        paused: false,
        following: true,
        animations: new Set(),
        active: new Set(),
        listeners: new AbortController(),
        gate: null,
        release: null,
        layers: [],
        shown: [],
        queue: [],
        built: 0,
        frame: 0,
        startedAt: performance.now(),
        pausedAt: 0,
        pausedFor: 0,
        width: innerWidth,
        stage: null,
        ruler: null,
        ui: null,
        live: null,
      };
      current = run;

      /* Fired before anything is measured or hidden, so a page can force
         its scroll-reveal effects to their final state first. */
      emit('start', { trigger: trigger || null });
      if (!run.running) {
        return;
      }

      try {
        for (const hud of document.querySelectorAll('.agent-build-hud')) {
          hud.remove();
        }
        for (const element of triggers()) {
          element.setAttribute('aria-disabled', 'true');
        }
        root.classList.add('agent-building');
        window.scrollTo(0, 0);
        await settle();
        if (!run.running) {
          return;
        }

        const plan = planLayers(collectLayers(config), LIMITS.layers);
        run.layers = plan.build;
        run.shown = plan.shown;
        run.queue = [...plan.build];
        for (const layer of plan.shown) {
          layer.element.classList.add(layer.kind === 'frame' ? 'agent-build-frame' : 'agent-build-shown');
        }

        run.stage = makeStage(run);
        run.ruler = makeRulers(run);
        play(run, run.ruler, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
        run.ui = makeHud(run);
        run.live = layerElement(run, 'p', 'agent-build-live');
        run.live.setAttribute('aria-live', 'polite');
        document.body.append(run.live);
        requestAnimationFrame(() => {
          if (run.running) {
            run.live.textContent = run.text.started;
          }
        });
        run.ui.pause.focus({ preventScroll: true });
        listen(run);

        const agents = await intro(run);
        for (const edge of columnEdges(run.layers)) {
          play(run, makeGuide(run, 'column', edge), [{ opacity: 0 }, { opacity: 1 }],
            { duration: 600, fill: 'forwards' });
        }
        follow(run);
        await Promise.all(agents.map((agent, index) => work(run, agent, index * 60 * run.pace)));
      } catch (error) {
        if (!error || error.name !== 'AbortError') {
          console.error(error);
        }
      }
      finish(run, false);
    }

    /* Waits for the web fonts and for every image still loading, lazy ones
       included, so the boxes are measured on the final layout: an image
       without dimensions is 0×0 until it loads, and would shift everything
       below it halfway through the run. The wait is capped. */
    function settle() {
      const pending = [];
      for (const image of document.querySelectorAll('img')) {
        if (image.loading === 'lazy') {
          image.loading = 'eager';
        }
        if (!image.complete) {
          pending.push(image.decode().catch(() => {}));
        }
      }
      if (document.fonts) {
        pending.push(document.fonts.ready);
      }
      return Promise.race([
        Promise.all(pending),
        new Promise((resolve) => {
          setTimeout(resolve, LIMITS.settle);
        }),
      ]);
    }

    function collectLayers(config) {
      const layers = selectLayers(document.body, {
        childrenOf: (node) => node.children,
        classify: makeClassifier(config, (element) => getComputedStyle(element)),
        measure: (element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height };
        },
      });
      for (const layer of layers) {
        const buttonLike = layer.kind !== 'frame' && layer.element.matches(BUTTONISH);
        layer.tag = tagOf(layer.element.localName, layer.kind, buttonLike);
      }
      return layers;
    }

    function listen(run) {
      const { signal } = run.listeners;
      const stopFollowing = () => {
        run.following = false;
      };
      addEventListener('wheel', stopFollowing, { passive: true, signal });
      addEventListener('touchmove', stopFollowing, { passive: true, signal });
      addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          finish(run, true);
        } else if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End)$/.test(event.key)) {
          stopFollowing();
        }
      }, { signal });
      addEventListener('resize', () => {
        if (innerWidth !== run.width) {
          finish(run, true);
        }
      }, { signal });
      if (typeof matchMedia === 'function') {
        const query = matchMedia('(prefers-reduced-motion: reduce)');
        if (typeof query.addEventListener === 'function') {
          query.addEventListener('change', (event) => {
            if (event.matches) {
              finish(run, true);
            }
          }, { signal });
        }
      }
    }

    /* One agent per worker: it takes the next layer in document order until
       the queue is empty. Finishing cancels the animations, whose promises
       reject with AbortError: that is the normal way out, not a failure. */
    async function work(run, agent, delay) {
      try {
        await sleep(run, delay);
        while (run.running) {
          await whilePaused(run);
          const layer = run.queue.shift();
          if (!layer) {
            return;
          }
          run.active.add(layer);
          await build(run, agent, layer);
          run.active.delete(layer);
          run.built += 1;
          paintProgress(run);
        }
      } catch (error) {
        if (!error || error.name !== 'AbortError') {
          console.error(error);
        }
      }
    }

    async function build(run, agent, layer) {
      const qa = layer.index % 9 === 4;
      await move(run, agent, layer.x, layer.y,
        clamp(Math.hypot(layer.x - agent.x, layer.y - agent.y) * 0.42, 200, 540) * run.pace);

      const box = makeBox(run, layer, qa);
      const rule = layer.kind === 'frame' || /^h[12]$/.test(layer.tag) ? makeGuide(run, 'row', layer.y) : null;
      if (rule) {
        play(run, rule, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 * run.pace, fill: 'forwards' });
      }
      const draw = clamp(140 + Math.hypot(layer.w, layer.h) * 0.25, 200, 440) * run.pace;
      agent.element.classList.add('agent-build-agent--drawing');
      await Promise.all([
        play(run, box.line, [
          { clipPath: 'inset(-4px 100% 100% -4px)' },
          { clipPath: 'inset(-4px -4px -4px -4px)' },
        ], { duration: draw, easing: EASE, fill: 'forwards' }),
        move(run, agent, layer.x + layer.w, layer.y + layer.h, draw),
      ]);
      agent.element.classList.remove('agent-build-agent--drawing');
      for (const label of [box.tag, box.size]) {
        play(run, label, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 * run.pace, fill: 'forwards' });
      }

      /* One layer in nine goes through review first: the box turns red,
         "qa" fixes it, and only then is it revealed. */
      if (qa) {
        await sleep(run, 340 * run.pace);
        box.element.classList.remove('agent-build-box--qa');
        box.tag.textContent = layer.tag;
      }

      await reveal(run, layer, agent);
      await Promise.all([
        play(run, box.element, fadeOut, { duration: 200 * run.pace, fill: 'forwards' }),
        rule && play(run, rule, fadeOut, { duration: 320 * run.pace, fill: 'forwards' }),
      ]);
      box.element.remove();
      if (rule) {
        rule.remove();
      }
    }

    /* Text gets typed: the agent switches to the I-beam, jumps to the start
       of the first line and runs along it while a stepped sweep follows. */
    async function reveal(run, layer, agent) {
      const { element, kind } = layer;
      if (!run.running) {
        return;
      }
      if (kind === 'type') {
        const duration = clamp(180 + layer.w * 0.4, 220, 600) * run.pace;
        const steps = clamp(Math.round(layer.w / 18), 4, 32);
        const line = layer.y + Math.min(layer.h, 28) / 2;
        agent.element.classList.add('agent-build-agent--typing');
        await move(run, agent, layer.x, line, 120 * run.pace);
        if (!run.running) {
          return;
        }
        element.classList.add('agent-build-shown');
        await Promise.all([
          play(run, element, [
            { clipPath: 'inset(-6px 100% -6px -6px)' },
            { clipPath: 'inset(-6px -6px -6px -6px)' },
          ], { duration, easing: `steps(${steps}, end)` }),
          move(run, agent, layer.x + layer.w, line, duration, 'linear'),
        ]);
        agent.element.classList.remove('agent-build-agent--typing');
        return;
      }
      element.classList.add(kind === 'frame' ? 'agent-build-frame' : 'agent-build-shown');
      if (kind === 'pop') {
        await play(run, element, [
          { opacity: 0, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)' },
        ], { duration: 380 * run.pace, easing: EASE });
        return;
      }
      await play(run, element, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 * run.pace, easing: 'linear' });
    }

    /* The start: the hub appears in the middle and the agents fan out of it. */
    async function intro(run) {
      const count = run.config.count;
      const centerX = scrollX + innerWidth / 2;
      const centerY = scrollY + Math.min(innerHeight * 0.45, 380);
      const hub = el('div', 'agent-build-hub');
      hub.append(makeHubIcon(run.config.hub));
      hub.style.left = `${centerX}px`;
      hub.style.top = `${centerY}px`;
      run.stage.append(hub);
      play(run, hub, [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      ], { duration: 420, easing: EASE, fill: 'forwards' });
      await sleep(run, 360);

      const agents = Array.from({ length: count }, (_, index) => makeAgent(run, index, centerX, centerY));
      await Promise.all(agents.map((agent, index) => {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        const radius = 64 + (index % 3) * 34;
        play(run, agent.element, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        return move(run, agent,
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius * 0.72,
          520 + index * 14);
      }));
      play(run, hub, fadeOut, { duration: 480, fill: 'forwards' });
      return agents;
    }

    /* The hub shows the page's own icon when data-agent-hub names one, or
       four blocks being assembled, drawn as inline SVG so `img-src` never
       needs `data:`. */
    function makeHubIcon(source) {
      if (source) {
        const image = el('img');
        image.src = source;
        image.alt = '';
        image.width = 32;
        image.height = 32;
        return image;
      }
      const icon = document.createElementNS(SVG_NS, 'svg');
      icon.setAttribute('class', 'agent-build-hub-icon');
      icon.setAttribute('viewBox', '0 0 32 32');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      for (const [x, y] of [[4, 4], [18, 4], [4, 18], [18, 18]]) {
        const block = document.createElementNS(SVG_NS, 'rect');
        block.setAttribute('x', String(x));
        block.setAttribute('y', String(y));
        block.setAttribute('width', '10');
        block.setAttribute('height', '10');
        block.setAttribute('rx', '2.5');
        icon.append(block);
      }
      return icon;
    }

    function cursor(className, viewBox, path) {
      const icon = document.createElementNS(SVG_NS, 'svg');
      icon.setAttribute('class', className);
      icon.setAttribute('viewBox', viewBox);
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      const shape = document.createElementNS(SVG_NS, 'path');
      shape.setAttribute('d', path);
      icon.append(shape);
      return icon;
    }

    /* Three cursors per agent, as in a design tool: an arrow to fly, a
       crosshair to draw the box and an I-beam to type. The stylesheet shows
       one or another according to the agent's state class. */
    function makeAgent(run, index, x, y) {
      const element = el('div', `agent-build-agent agent-build-agent--hue-${index % HUES}`);
      const role = `${ROLES[index % ROLES.length]}-${String(index + 1).padStart(2, '0')}`;
      element.append(
        cursor('agent-build-pointer', '0 0 14 18', 'M1.5 1.5v13l3.6-3.3 2.4 5.3 2.2-1-2.4-5.2h5.1z'),
        cursor('agent-build-cross', '0 0 16 16', 'M8 1v14M1 8h14'),
        cursor('agent-build-ibeam', '0 0 10 18', 'M2 1.5h6M2 16.5h6M5 1.5v15'),
        el('span', 'agent-build-tag', role),
      );
      element.style.transform = `translate(${x}px, ${y}px)`;
      run.stage.append(element);
      return { element, x, y };
    }

    function makeBox(run, layer, qa) {
      /* Media is drawn first as a grey block, like the placeholder a design
         tool leaves before the picture goes in. */
      const element = el('div', ['agent-build-box', qa && 'agent-build-box--qa',
        MEDIA.has(layer.tag) && 'agent-build-box--media'].filter(Boolean).join(' '));
      element.style.left = `${layer.x}px`;
      element.style.top = `${layer.y}px`;
      element.style.width = `${layer.w}px`;
      element.style.height = `${layer.h}px`;
      element.style.setProperty('--w', `${layer.w}px`);
      element.style.setProperty('--h', `${layer.h}px`);
      const line = el('span', 'agent-build-box-line');
      const tag = el('span', 'agent-build-box-label', qa ? `qa · ${layer.tag}` : layer.tag);
      const size = el('span', 'agent-build-box-size', `${Math.round(layer.w)} × ${Math.round(layer.h)}`);
      /* Keep the label clear of the rulers: inside the box at the top of
         the page, and past the side ruler at its left edge. */
      if (layer.y < RULER + 22) {
        element.classList.add('agent-build-box--inside');
      }
      if (layer.x < RULER + 4) {
        tag.style.left = `${RULER + 4 - layer.x}px`;
      }
      element.append(line, tag, size);
      run.stage.append(element);
      return { element, line, tag, size };
    }

    function makeGuide(run, axis, position) {
      const guide = el('span', `agent-build-guide agent-build-guide--${axis}`);
      guide.style[axis === 'column' ? 'left' : 'top'] = `${position}px`;
      run.stage.append(guide);
      return guide;
    }

    /* The script's own top-level nodes. They carry .agent-build-layer, which
       the stylesheet never hides, and the accent when one was given. */
    function layerElement(run, tag, className) {
      const element = el(tag, `${className} agent-build-layer`);
      if (run.config.accent) {
        element.style.setProperty('--agent-accent', run.config.accent);
      }
      return element;
    }

    /* The work layer covers the whole document, so cursors and boxes use
       page coordinates and scroll with it. It is placed at the document's
       origin whatever the body's position or margins. */
    function makeStage(run) {
      const stage = layerElement(run, 'div', 'agent-build-stage');
      stage.setAttribute('aria-hidden', 'true');
      document.body.append(stage);
      const origin = stage.getBoundingClientRect();
      stage.style.left = `${-(origin.left + scrollX)}px`;
      stage.style.top = `${-(origin.top + scrollY)}px`;
      stage.style.width = `${Math.max(root.scrollWidth, root.clientWidth)}px`;
      stage.style.height = `${Math.max(root.scrollHeight, document.body.scrollHeight)}px`;
      return stage;
    }

    /* Canvas rulers on top and on the left, with a figure every 100 px. The
       top one is fixed to the window; the left one lives in the work layer,
       so its figures are real page coordinates. */
    function makeRulers(run) {
      const top = layerElement(run, 'div', 'agent-build-ruler agent-build-ruler--top');
      top.setAttribute('aria-hidden', 'true');
      for (let x = 100; x < innerWidth; x += 100) {
        top.append(rulerMark(x, 'left'));
      }
      document.body.append(top);
      const side = el('div', 'agent-build-ruler agent-build-ruler--side');
      const height = parseFloat(run.stage.style.height);
      for (let y = 100; y < height; y += 100) {
        side.append(rulerMark(y, 'top'));
      }
      run.stage.append(side);
      return top;
    }

    function rulerMark(value, edge) {
      const mark = el('span', '', String(value));
      mark.style[edge] = `${value}px`;
      return mark;
    }

    function makeHud(run) {
      const { text } = run;
      const hud = layerElement(run, 'div', 'agent-build-hud');
      hud.setAttribute('role', 'group');
      hud.setAttribute('aria-label', text.label);
      const info = el('span', 'agent-build-hud-text');
      const layers = el('span', 'agent-build-hud-layers', text.layers(0, run.layers.length));
      info.append(
        el('strong', '', text.kicker),
        el('span', 'agent-build-hud-agents', ` · ${text.agents(run.config.count)}`),
        ' · ',
        layers,
      );
      const bar = el('span', 'agent-build-hud-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span');
      bar.append(fill);
      const pause = el('button', 'agent-build-hud-btn', text.pause);
      pause.type = 'button';
      pause.setAttribute('aria-pressed', 'false');
      const finishButton = el('button', 'agent-build-hud-btn', text.finish);
      finishButton.type = 'button';
      pause.addEventListener('click', () => togglePause(run));
      finishButton.addEventListener('click', () => finish(run, true));
      hud.append(makeDots('agent-build-hud-dots'), info, bar, pause, finishButton);
      document.body.append(hud);
      play(run, hud, [
        { opacity: 0, transform: 'translate(-50%, 12px)' },
        { opacity: 1, transform: 'translate(-50%, 0)' },
      ], { duration: 320, easing: EASE });
      return { hud, info, layers, fill, pause, stop: finishButton };
    }

    function paintProgress(run) {
      const total = run.layers.length;
      run.ui.layers.textContent = run.text.layers(run.built, total);
      run.ui.fill.style.transform = `scaleX(${total > 0 ? run.built / total : 1})`;
    }

    /* The page follows the oldest layer at work and keeps it about a third
       down the screen. As soon as the visitor scrolls on their own, it stops
       following. */
    function follow(run) {
      if (!run.running) {
        return;
      }
      if (run.following && !run.paused) {
        let top = Infinity;
        for (const layer of run.active) {
          top = Math.min(top, layer.y);
        }
        if (top === Infinity && run.queue.length > 0) {
          top = run.queue[0].y;
        }
        if (top !== Infinity) {
          const target = clamp(top - innerHeight * 0.32, 0, root.scrollHeight - innerHeight);
          const delta = target - scrollY;
          if (Math.abs(delta) > 1) {
            window.scrollTo(0, scrollY + Math.sign(delta) * Math.max(1, Math.abs(delta) * 0.07));
          }
        }
      }
      run.frame = requestAnimationFrame(() => follow(run));
    }

    function move(run, agent, x, y, duration, easing = EASE) {
      const from = `translate(${agent.x}px, ${agent.y}px)`;
      const to = `translate(${x}px, ${y}px)`;
      agent.x = x;
      agent.y = y;
      agent.element.style.transform = to;
      return play(run, agent.element, [{ transform: from }, { transform: to }], { duration, easing });
    }

    /* Every animation of the run goes through here, so pausing, resuming
       and finishing reach all of them. A wait is an animation without
       effect, and pauses and cancels like the rest. Once the run is over,
       nothing new starts. */
    function play(run, target, keyframes, options) {
      if (!run.running) {
        return Promise.reject(new DOMException('The simulation finished', 'AbortError'));
      }
      const animation = target.animate(keyframes, options);
      run.animations.add(animation);
      if (run.paused) {
        animation.pause();
      }
      const forget = () => run.animations.delete(animation);
      animation.finished.then(forget, forget);
      return animation.finished;
    }

    function sleep(run, duration) {
      return play(run, run.stage, null, { duration });
    }

    async function whilePaused(run) {
      while (run.paused) {
        await run.gate;
      }
    }

    function togglePause(run) {
      if (!run.running) {
        return;
      }
      run.paused = !run.paused;
      if (run.paused) {
        run.pausedAt = performance.now();
        run.gate = new Promise((resolve) => {
          run.release = resolve;
        });
        for (const animation of run.animations) {
          if (animation.playState === 'running') {
            animation.pause();
          }
        }
      } else {
        run.pausedFor += performance.now() - run.pausedAt;
        for (const animation of run.animations) {
          if (animation.playState === 'paused') {
            animation.play();
          }
        }
        run.release();
      }
      run.ui.pause.textContent = run.paused ? run.text.resume : run.text.pause;
      run.ui.pause.setAttribute('aria-pressed', String(run.paused));
    }

    function unmark(element, ...names) {
      element.classList.remove(...names);
      if (element.getAttribute('class') === '') {
        element.removeAttribute('class');
      }
    }

    function restoreFocus(run) {
      const target = [run.trigger, run.returnFocus].find((node) => node
        && node !== document.body && node.isConnected && typeof node.focus === 'function');
      if (target) {
        target.focus({ preventScroll: true });
      }
    }

    function finish(run, skipped) {
      if (!run.running) {
        return;
      }
      run.running = false;
      if (current === run) {
        current = null;
      }
      cancelAnimationFrame(run.frame);
      run.listeners.abort();
      if (run.paused) {
        run.paused = false;
        run.pausedFor += performance.now() - run.pausedAt;
        run.release();
      }
      for (const animation of [...run.animations]) {
        animation.cancel();
      }
      run.animations.clear();

      /* The page gets its elements back as they were, without even an
         empty class attribute. */
      unmark(root, 'agent-building');
      for (const { element } of run.layers.concat(run.shown)) {
        unmark(element, 'agent-build-shown', 'agent-build-frame');
      }
      for (const element of triggers()) {
        element.removeAttribute('aria-disabled');
      }

      const seconds = (performance.now() - run.startedAt - run.pausedFor) / 1000;
      const { stage, ruler, ui, live } = run;
      for (const layer of [stage, ruler]) {
        if (layer) {
          const remove = () => layer.remove();
          layer.animate(fadeOut, { duration: 320 }).finished.then(remove, remove);
        }
      }
      if (ui) {
        if (ui.hud.contains(document.activeElement)) {
          restoreFocus(run);
        }
        if (live) {
          live.textContent = run.text.finished;
        }
        if (skipped) {
          ui.hud.remove();
          setTimeout(() => live && live.remove(), 3000);
        } else {
          ui.pause.remove();
          ui.stop.remove();
          ui.fill.style.transform = 'scaleX(1)';
          ui.info.textContent = run.text.built(run.decimal.format(seconds));
          setTimeout(() => {
            const remove = () => ui.hud.remove();
            ui.hud.animate(fadeOut, { duration: 400 }).finished.then(remove, remove);
            if (live) {
              live.remove();
            }
          }, 2800);
        }
      }
      emit('end', { skipped, built: run.built, total: run.layers.length, seconds });
    }

    const api = Object.freeze({
      version: VERSION,
      start,
      stop,
      isRunning: () => current !== null,
    });
    window.AgentBuild = api;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setUpTriggers, { once: true });
    } else {
      setUpTriggers();
    }
    return api;
  }

  const api = typeof window !== 'undefined' && typeof document !== 'undefined'
    ? (window.AgentBuild || boot())
    : inert();
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = Object.assign({}, api, { _internals: internals });
  }
})();
