import { FADE_IN, FADE_OUT } from '../dom.ts';
import {
  BUTTONISH, columnEdges, isMediaOnly, type Layer, makeClassifier, planLayers, selectLayers, tagOf,
} from '../layers.ts';
import { LOCALES, resolveLanguage } from '../locales/index.ts';
import {
  AGENTS, type Config, datasetOptions, LIMITS, mergeOptions, normalizeOptions, type StartOptions,
} from '../options.ts';
import { cssLoaded, env, languageOf, supported, triggers } from '../page.ts';
import { ignoreAbort, play } from './animate.ts';
import { work } from './build.ts';
import { follow, listen } from './follow.ts';
import { makeHud } from './hud.ts';
import { intro, makeGuide, makeRulers, makeStage } from './stage.ts';
import type { Run } from './types.ts';

export interface StartDetail {
  trigger: Element | null;
}

export interface EndDetail {
  skipped: boolean;
  built: number;
  total: number;
  seconds: number;
}

/* Every building duration is multiplied by this and the pace option, so a
   higher pace means a slower build. */
const BASE_PACE = 1.4;

let current: Run | null = null;

export const isRunning = () => current !== null;

/* Options win over the data attributes of the pressed button or, without
   one, of the first [data-agent-build] on the page. */
export function start(options?: StartOptions): boolean {
  if (typeof document === 'undefined' || current || !document.body || !supported()) {
    return false;
  }
  if (!cssLoaded()) {
    env.warn('agent-build.css is not loaded, so the page stays as it is');
    return false;
  }
  const given: StartOptions = options && typeof options === 'object' ? options : {};
  const trigger = given.trigger?.nodeType === 1
    ? given.trigger
    : document.querySelector<HTMLElement>('[data-agent-build]');
  const config = normalizeOptions(mergeOptions(datasetOptions(trigger as HTMLElement | null), given),
    { narrow: innerWidth < AGENTS.breakpoint, ...env });
  void begin(config, resolveLanguage(languageOf(trigger)), trigger);
  return true;
}

export function stop(): boolean {
  if (!current) {
    return false;
  }
  finish(current, true);
  return true;
}

function emit(type: 'start', detail: StartDetail): void;
function emit(type: 'end', detail: EndDetail): void;
function emit(type: string, detail: StartDetail | EndDetail) {
  document.dispatchEvent(new CustomEvent(`agentbuild:${type}`, { bubbles: true, detail }));
}

async function begin(config: Config, language: string, trigger: Element | null) {
  const run: Run = {
    config,
    text: LOCALES[language],
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
  };
  current = run;

  /* Fired before anything is measured or hidden, so a page can force its
     scroll-reveal effects to their final state first. */
  emit('start', { trigger });
  if (!run.running) {
    return;
  }

  const end = () => finish(run, true);
  try {
    for (const hud of document.querySelectorAll('.agent-build-hud')) {
      hud.remove();
    }
    for (const element of triggers()) {
      element.setAttribute('aria-disabled', 'true');
    }
    document.documentElement.classList.add('agent-building');
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

    const stage = makeStage(run);
    run.stage = stage;
    run.ruler = makeRulers(run, stage);
    play(run, run.ruler, FADE_IN, { duration: 400 });
    run.ui = makeHud(run, end);
    run.ui.pause.focus({ preventScroll: true });
    listen(run, end);

    const agents = await intro(run, stage);
    for (const edge of columnEdges(run.layers)) {
      play(run, makeGuide(stage, 'column', edge), FADE_IN, { duration: 600, fill: 'forwards' });
    }
    follow(run);
    await Promise.all(agents.map((agent, index) => work(run, stage, agent, index * 60 * run.pace)));
  } catch (error) {
    ignoreAbort(error);
  }
  finish(run, false);
}

/* Waits for the web fonts and for every image still loading, lazy ones
   included, so boxes are measured on the final layout: an image without
   dimensions is 0×0 until it loads. The wait is capped. */
function settle() {
  const pending: Promise<unknown>[] = [];
  for (const image of document.querySelectorAll('img')) {
    if (image.loading === 'lazy') {
      image.loading = 'eager';
    }
    if (!image.complete) {
      pending.push(image.decode().catch(() => {}));
    }
  }
  pending.push(document.fonts.ready);
  return Promise.race([
    Promise.all(pending),
    new Promise((resolve) => {
      setTimeout(resolve, LIMITS.settle);
    }),
  ]);
}

function collectLayers(config: Config): Layer[] {
  const layers = selectLayers<Element>(document.body, {
    childrenOf: (node) => node.children,
    classify: makeClassifier(config, (element) => getComputedStyle(element)),
    measure: (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height };
    },
  });
  for (const layer of layers) {
    const block = layer.kind !== 'frame';
    layer.tag = tagOf(layer.element.localName, layer.kind,
      block && layer.element.matches(BUTTONISH), block && isMediaOnly(layer.element));
  }
  return layers;
}

/* Leaves an element as the page had it, without even an empty class
   attribute. */
function unmark(element: Element, ...names: string[]) {
  element.classList.remove(...names);
  if (element.getAttribute('class') === '') {
    element.removeAttribute('class');
  }
}

function restoreFocus(run: Run) {
  const target = [run.trigger, run.returnFocus].find((node): node is HTMLElement => node instanceof HTMLElement
    && node !== document.body && node.isConnected);
  target?.focus({ preventScroll: true });
}

function finish(run: Run, skipped: boolean) {
  if (!run.running) {
    return;
  }
  run.running = false;
  current = null;
  cancelAnimationFrame(run.frame);
  run.listeners.abort();
  if (run.paused) {
    run.pausedFor += performance.now() - run.pausedAt;
    run.paused = false;
  }
  for (const animation of [...run.animations]) {
    animation.cancel();
  }
  run.animations.clear();

  unmark(document.documentElement, 'agent-building');
  for (const { element } of run.layers.concat(run.shown)) {
    unmark(element, 'agent-build-shown', 'agent-build-frame');
  }
  for (const element of triggers()) {
    element.removeAttribute('aria-disabled');
  }

  const seconds = (performance.now() - run.startedAt - run.pausedFor) / 1000;
  for (const layer of [run.stage, run.ruler]) {
    if (layer) {
      const remove = () => layer.remove();
      layer.animate(FADE_OUT, { duration: 320 }).finished.then(remove, remove);
    }
  }
  const { ui } = run;
  if (ui) {
    if (ui.hud.contains(document.activeElement)) {
      restoreFocus(run);
    }
    ui.live.textContent = run.text.finished;
    if (skipped) {
      ui.hud.remove();
      setTimeout(() => ui.live.remove(), 3000);
    } else {
      ui.pause.remove();
      ui.stop.remove();
      ui.fill.style.transform = 'scaleX(1)';
      ui.info.textContent = run.text.built(run.decimal.format(seconds));
      setTimeout(() => {
        const remove = () => ui.hud.remove();
        ui.hud.animate(FADE_OUT, { duration: 400 }).finished.then(remove, remove);
        ui.live.remove();
      }, 2800);
    }
  }
  emit('end', { skipped, built: run.built, total: run.layers.length, seconds });
}
