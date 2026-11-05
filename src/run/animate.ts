import type { Agent, Run } from './types.ts';

export const EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';

/* Every animation of a run goes through here, so pausing, resuming and
   finishing reach all of them. A wait is an animation without effect. Once
   the run is over nothing new starts, and the rejection is the AbortError the
   workers expect. */
export function play(run: Run, target: Element, keyframes: Keyframe[] | null, options: KeyframeAnimationOptions) {
  if (!run.running) {
    return Promise.reject(new DOMException('The simulation finished', 'AbortError'));
  }
  const animation = target.animate(keyframes, options);
  run.animations.add(animation);
  if (run.paused) {
    animation.pause();
  }
  const forget = () => {
    run.animations.delete(animation);
  };
  animation.finished.then(forget, forget);
  return animation.finished;
}

export function sleep(run: Run, duration: number) {
  return play(run, run.stage ?? document.documentElement, null, { duration });
}

export function move(run: Run, agent: Agent, x: number, y: number, duration: number, easing = EASE) {
  const from = `translate(${agent.x}px, ${agent.y}px)`;
  const to = `translate(${x}px, ${y}px)`;
  agent.x = x;
  agent.y = y;
  agent.element.style.transform = to;
  return play(run, agent.element, [{ transform: from }, { transform: to }], { duration, easing });
}

export function setPaused(run: Run, paused: boolean) {
  if (run.paused === paused) {
    return;
  }
  run.paused = paused;
  if (paused) {
    run.pausedAt = performance.now();
  } else {
    run.pausedFor += performance.now() - run.pausedAt;
  }
  for (const animation of run.animations) {
    if (paused && animation.playState === 'running') {
      animation.pause();
    } else if (!paused && animation.playState === 'paused') {
      animation.play();
    }
  }
}

export function ignoreAbort(error: unknown) {
  if (!(error instanceof DOMException && error.name === 'AbortError')) {
    console.error(error);
  }
}
