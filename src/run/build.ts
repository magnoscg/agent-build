import { FADE_IN, FADE_OUT } from '../dom.ts';
import type { Layer } from '../layers.ts';
import { clamp } from '../util.ts';
import { EASE, ignoreAbort, move, play, sleep } from './animate.ts';
import { paintProgress } from './hud.ts';
import { makeBox, makeGuide } from './stage.ts';
import type { Agent, Run } from './types.ts';

/* One agent per worker: it takes the next layer in document order until the
   queue is empty. Finishing cancels the animations, whose promises reject
   with AbortError: the normal way out. */
export async function work(run: Run, stage: HTMLElement, agent: Agent, delay: number) {
  try {
    await sleep(run, delay);
    while (run.running) {
      const layer = run.queue.shift();
      if (!layer) {
        return;
      }
      run.active.add(layer);
      await build(run, stage, agent, layer);
      run.active.delete(layer);
      run.built += 1;
      if (run.ui) {
        paintProgress(run, run.ui);
      }
    }
  } catch (error) {
    ignoreAbort(error);
  }
}

async function build(run: Run, stage: HTMLElement, agent: Agent, layer: Layer) {
  const qa = layer.index % 9 === 4;
  await move(run, agent, layer.x, layer.y,
    clamp(Math.hypot(layer.x - agent.x, layer.y - agent.y) * 0.42, 200, 540) * run.pace);

  const box = makeBox(stage, layer, qa);
  const rule = layer.kind === 'frame' || /^h[12]$/.test(layer.tag) ? makeGuide(stage, 'row', layer.y) : null;
  if (rule) {
    play(run, rule, FADE_IN, { duration: 160 * run.pace, fill: 'forwards' });
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
    play(run, label, FADE_IN, { duration: 140 * run.pace, fill: 'forwards' });
  }

  /* One layer in nine goes through review first: the box turns red, "qa"
     fixes it, and only then is it revealed. */
  if (qa) {
    await sleep(run, 340 * run.pace);
    box.element.classList.remove('agent-build-box--qa');
    box.tag.textContent = layer.tag;
  }

  await reveal(run, layer, agent);
  await Promise.all([
    play(run, box.element, FADE_OUT, { duration: 200 * run.pace, fill: 'forwards' }),
    rule && play(run, rule, FADE_OUT, { duration: 320 * run.pace, fill: 'forwards' }),
  ]);
  box.element.remove();
  rule?.remove();
}

/* Text gets typed: the agent switches to the I-beam, jumps to the start of
   the first line and runs along it while a stepped sweep follows. */
async function reveal(run: Run, layer: Layer, agent: Agent) {
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
  await play(run, element, FADE_IN, { duration: 300 * run.pace, easing: 'linear' });
}
