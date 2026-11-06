import { FADE_IN, FADE_OUT } from '../dom.ts';
import { bottomOf, measure, pointOf } from '../geometry.ts';
import type { Layer } from '../layers.ts';
import { LIMITS } from '../options.ts';
import { clamp } from '../util.ts';
import { EASE, ignoreAbort, move, play, sleep } from './animate.ts';
import { paintProgress } from './hud.ts';
import { reveal, showNow, whenOpen } from './reveal.ts';
import { growStage, makeBox, makeGuide } from './stage.ts';
import type { Agent, Run } from './types.ts';

const elapsed = (run: Run) => performance.now() - run.startedAt - run.pausedFor;

/* Each agent takes the next layer in document order until the queue is
   empty or the time is up, when the rest of the page appears at once.
   Finishing cancels the animations, whose promises reject with AbortError:
   the normal way out. */
export async function work(run: Run, stage: HTMLElement, agent: Agent, delay: number) {
  try {
    await sleep(run, delay);
    while (run.running) {
      if (elapsed(run) > LIMITS.seconds * 1000) {
        finishQueue(run);
        return;
      }
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

function finishQueue(run: Run) {
  for (const layer of run.queue) {
    showNow(run, layer);
  }
  run.built += run.queue.length;
  run.queue = [];
  if (run.ui) {
    paintProgress(run, run.ui);
  }
}

async function build(run: Run, stage: HTMLElement, agent: Agent, layer: Layer) {
  /* Measured when the agent takes it, so the box matches the page as it is
     now, after fonts, images or transitions moved things. */
  Object.assign(layer, measure(layer.element));
  if (layer.w < 2 || layer.h < 2) {
    showNow(run, layer);
    return;
  }
  growStage(stage, bottomOf(layer));
  const qa = layer.index % 9 === 4;
  const [startX, startY] = pointOf(layer, 0, 0);
  await move(run, agent, startX, startY,
    clamp(Math.hypot(startX - agent.x, startY - agent.y) * 0.42, 200, 540) * run.pace);

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
    move(run, agent, ...pointOf(layer, 1, 1), draw),
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

  await whenOpen(run, layer.parent);
  await reveal(run, layer, agent);
  await Promise.all([
    play(run, box.element, FADE_OUT, { duration: 200 * run.pace, fill: 'forwards' }),
    rule && play(run, rule, FADE_OUT, { duration: 320 * run.pace, fill: 'forwards' }),
  ]);
  box.element.remove();
  rule?.remove();
}
