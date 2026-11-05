import { el, makeDots } from '../dom.ts';
import { EASE, play, setPaused } from './animate.ts';
import { float, layerElement } from './stage.ts';
import type { Hud, Run } from './types.ts';

export function makeHud(run: Run, onFinish: () => void): Hud {
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

  const live = layerElement(run, 'p', 'agent-build-live');
  live.setAttribute('aria-live', 'polite');
  document.body.append(live);
  requestAnimationFrame(() => {
    if (run.running) {
      live.textContent = text.started;
    }
  });
  return { hud, info, layers, fill, pause, stop, live };
}

export function paintProgress(run: Run, ui: Hud) {
  const total = run.layers.length;
  ui.layers.textContent = run.text.layers(run.built, total);
  ui.fill.style.transform = `scaleX(${total > 0 ? run.built / total : 1})`;
}

function togglePause(run: Run) {
  if (!run.running || !run.ui) {
    return;
  }
  setPaused(run, !run.paused);
  run.ui.pause.textContent = run.paused ? run.text.resume : run.text.pause;
  run.ui.pause.setAttribute('aria-pressed', String(run.paused));
}
