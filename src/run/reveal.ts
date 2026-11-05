import type { Layer } from '../layers.ts';
import { REVEAL } from '../page.ts';
import { clamp } from '../util.ts';
import { EASE, move, play } from './animate.ts';
import type { Agent, Gate, Run } from './types.ts';

/* One keyframe at offset 0: the animation ends on the element's own
   opacity, filter and clip-path, whatever the page set. */
const FROM_HIDDEN: Keyframe[] = [{ opacity: 0, offset: 0 }];
const FROM_BLURRED: Keyframe[] = [{ opacity: 0, filter: 'blur(6px)', offset: 0 }];

export function mark(run: Run, element: Element, value: 'shown' | 'frame') {
  element.setAttribute(REVEAL, value);
  run.marked.push(element);
}

function gate(run: Run, frame: Layer): Gate {
  let entry = run.gates.get(frame);
  if (!entry) {
    let open = () => {};
    const promise = new Promise<void>((resolve) => {
      open = resolve;
    });
    entry = { promise, open };
    run.gates.set(frame, entry);
  }
  return entry;
}

/* A block waits for its frame, so a box never appears behind content that
   is already there. */
export function whenOpen(run: Run, frame: Layer | null) {
  return frame && !run.opened.has(frame) ? gate(run, frame).promise : undefined;
}

export function open(run: Run, frame: Layer) {
  if (run.opened.has(frame)) {
    return;
  }
  run.opened.add(frame);
  mark(run, frame.element, 'frame');
  for (const element of run.restIn.get(frame) ?? []) {
    mark(run, element, 'shown');
  }
  gate(run, frame).open();
}

export function showNow(run: Run, layer: Layer) {
  if (layer.kind === 'frame') {
    open(run, layer);
  } else {
    mark(run, layer.element, 'shown');
  }
}

export function releaseAll(run: Run) {
  for (const entry of run.gates.values()) {
    entry.open();
  }
}

/* Frames fade in. Text is typed: the agent switches to the I-beam, jumps to
   the start of the first line and runs along it while a stepped sweep
   follows. Everything else fades in, blurred unless the page filters it. */
export async function reveal(run: Run, layer: Layer, agent: Agent) {
  const { element, kind } = layer;
  if (!run.running) {
    return;
  }
  if (kind === 'frame') {
    open(run, layer);
    await play(run, element, FROM_HIDDEN, { duration: 300 * run.pace, easing: 'linear' });
    return;
  }
  const style = getComputedStyle(element);
  if (kind === 'type' && style.clipPath === 'none') {
    const duration = clamp(180 + layer.w * 0.4, 220, 600) * run.pace;
    const steps = clamp(Math.round(layer.w / 18), 4, 32);
    const line = layer.y + Math.min(layer.h, 28) / 2;
    agent.element.classList.add('agent-build-agent--typing');
    await move(run, agent, layer.x, line, 120 * run.pace);
    if (!run.running) {
      return;
    }
    mark(run, element, 'shown');
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
  mark(run, element, 'shown');
  await play(run, element, style.filter === 'none' ? FROM_BLURRED : FROM_HIDDEN,
    { duration: 380 * run.pace, easing: EASE });
}
