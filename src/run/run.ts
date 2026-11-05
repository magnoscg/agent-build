import { FADE_IN, FADE_OUT } from '../dom.ts';
import { columnEdges, labelOf, type Layer, makeClassifier, type Rest, selectLayers } from '../layers.ts';
import { LOCALES, resolveLanguage } from '../locales/index.ts';
import {
  AGENTS, type Config, datasetOptions, LIMITS, mergeOptions, normalizeOptions, type StartOptions,
} from '../options.ts';
import { cssLoaded, env, languageOf, REVEAL, RUN, supported, triggers } from '../page.ts';
import { ignoreAbort, play } from './animate.ts';
import { work } from './build.ts';
import { follow, listen } from './follow.ts';
import { makeHud } from './hud.ts';
import { mark, releaseAll, showNow } from './reveal.ts';
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

function createRun(config: Config, language: string, trigger: Element | null): Run {
  return {
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
    queue: [],
    marked: [],
    gates: new Map(),
    opened: new Set(),
    restIn: new Map(),
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
}

async function begin(config: Config, language: string, trigger: Element | null) {
  const run = createRun(config, language, trigger);
  current = run;

  /* Fired before anything is measured, so a page can put its scroll-reveal
     effects in their final state first. */
  emit('start', { trigger });
  if (!run.running) {
    return;
  }

  const root = document.documentElement;
  const end = () => finish(run, true);
  listen(run, end);
  root.setAttribute(RUN, 'measuring');
  for (const element of triggers()) {
    element.setAttribute('aria-disabled', 'true');
  }
  for (const hud of document.querySelectorAll('.agent-build-hud')) {
    hud.remove();
  }
  window.scrollTo(0, 0);
  try {
    await settle();
    if (!run.running) {
      return;
    }
    const { layers, rest } = collect(config);
    plan(run, layers, rest);
    run.width = innerWidth;
    root.setAttribute(RUN, 'building');

    const stage = makeStage(run);
    run.stage = stage;
    const last = run.layers.at(-1);
    run.ruler = makeRulers(run, stage, last ? last.y + last.h : innerHeight);
    play(run, run.ruler, FADE_IN, { duration: 400 });
    run.ui = makeHud(run, end);
    run.ui.pause.focus({ preventScroll: true });

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

/* Measures the page as it really looks: after the web fonts, and after any
   finite transition or animation in progress, such as the scroll reveals a
   page settles in its agentbuild:start listener. The wait is capped. */
function settle() {
  const pending: Promise<unknown>[] = [document.fonts.ready];
  for (const animation of document.getAnimations()) {
    const end = animation.effect?.getComputedTiming().endTime;
    if (animation.playState === 'running' && typeof end === 'number' && Number.isFinite(end)) {
      pending.push(animation.finished.catch(() => {}));
    }
  }
  return Promise.race([
    Promise.all(pending),
    new Promise((resolve) => {
      setTimeout(resolve, LIMITS.settle);
    }),
  ]);
}

function collect(config: Config) {
  const { layers, rest } = selectLayers<Element>(document.body, {
    childrenOf: (node) => node.children,
    classify: makeClassifier(config, (element) => getComputedStyle(element)),
    measure: (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height };
    },
    limit: LIMITS.layers,
  });
  for (const layer of layers) {
    layer.tag = labelOf(layer.element, layer.kind);
  }
  return { layers, rest };
}

const showable = (element: Element) => {
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility === 'visible';
};

/* What is not built is shown as it is: right away when nothing contains it,
   or with its frame. When the document itself does not scroll, because the
   page scrolls an inner container, only what is in view gets built. */
function plan(run: Run, layers: Layer[], rest: Rest[]) {
  const scrolls = document.documentElement.scrollHeight > innerHeight + 1;
  run.layers = scrolls ? layers : layers.filter((layer) => layer.y < innerHeight);
  run.queue = [...run.layers];
  for (const { element, parent } of rest) {
    if (!showable(element)) {
      continue;
    }
    if (parent) {
      run.restIn.set(parent, [...(run.restIn.get(parent) ?? []), element]);
    } else {
      mark(run, element, 'shown');
    }
  }
  if (!scrolls) {
    for (const layer of layers.filter((candidate) => candidate.y >= innerHeight)) {
      showNow(run, layer);
    }
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
  releaseAll(run);

  document.documentElement.removeAttribute(RUN);
  for (const element of run.marked) {
    element.removeAttribute(REVEAL);
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
