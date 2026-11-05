import { el, makeDots } from '../dom.ts';
import { EASE, play, setPaused } from './animate.ts';
import { float, layerElement } from './stage.ts';
import type { Hud, Run } from './types.ts';

/* Screen readers only hear a live region they already know about, so it
   goes in when the run starts and speaks a moment after anything changes. */
const ANNOUNCE_DELAY = 150;

function inRunLanguage(run: Run, element: HTMLElement) {
  element.lang = run.text.language;
  element.dir = run.text.dir;
}

export function makeLive(run: Run) {
  const live = layerElement(run, 'p', 'agent-build-live');
  live.setAttribute('aria-live', 'polite');
  inRunLanguage(run, live);
  document.body.append(live);
  return live;
}

export function announce(live: HTMLElement, message: string, unless = () => false) {
  setTimeout(() => {
    if (!unless()) {
      live.textContent = message;
    }
  }, ANNOUNCE_DELAY);
}

export function makeHud(run: Run, onFinish: () => void): Hud {
  const { text } = run;
  const hud = layerElement(run, 'div', 'agent-build-hud');
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', text.label);
  inRunLanguage(run, hud);
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
  const stop = el('button', 'agent-build-hud-btn', text.finish);
  stop.type = 'button';
  pause.addEventListener('click', () => togglePause(run));
  stop.addEventListener('click', onFinish);
  hud.append(makeDots('agent-build-hud-dots'), info, bar, pause, stop);
  float(hud);
  play(run, hud, [
    { opacity: 0, transform: 'translate(-50%, 12px)' },
    { opacity: 1, transform: 'translate(-50%, 0)' },
  ], { duration: 320, easing: EASE });
  if (run.live) {
    announce(run.live, text.started, () => !run.running);
  }
  return { hud, info, layers, fill, pause, stop };
}

export function paintProgress(run: Run, ui: Hud) {
  const total = run.layers.length;
  ui.layers.textContent = run.text.layers(run.built, total);
  ui.fill.style.transform = `scaleX(${total > 0 ? run.built / total : 1})`;
}

/* The label says what the button does next, so there is no aria-pressed:
   a toggle button keeps one name. */
function togglePause(run: Run) {
  if (!run.running || !run.ui) {
    return;
  }
  setPaused(run, !run.paused);
  run.ui.pause.textContent = run.paused ? run.text.resume : run.text.pause;
}
