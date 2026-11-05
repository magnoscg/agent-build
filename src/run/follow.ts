import { clamp } from '../util.ts';
import type { Run } from './types.ts';

/* The page follows the topmost layer at work and keeps it about a third down
   the screen, until the visitor scrolls on their own: with the wheel, touch or
   keys, or any other way that moves the page somewhere it was not sent. */
export function follow(run: Run) {
  if (!run.running || !run.following) {
    return;
  }
  if (!run.paused) {
    let top = Infinity;
    for (const layer of run.active) {
      top = Math.min(top, layer.y);
    }
    if (top === Infinity && run.queue.length > 0) {
      top = run.queue[0].y;
    }
    if (top !== Infinity) {
      const target = clamp(top - innerHeight * 0.32, 0, document.documentElement.scrollHeight - innerHeight);
      const delta = target - scrollY;
      if (Math.abs(delta) > 1) {
        run.scrolledTo = scrollY + Math.sign(delta) * Math.max(1, Math.abs(delta) * 0.07);
        window.scrollTo(0, run.scrolledTo);
      }
    }
  }
  run.frame = requestAnimationFrame(() => follow(run));
}

export function listen(run: Run, onFinish: () => void) {
  const { signal } = run.listeners;
  const stopFollowing = () => {
    run.following = false;
  };
  addEventListener('wheel', stopFollowing, { passive: true, signal });
  addEventListener('touchmove', stopFollowing, { passive: true, signal });
  addEventListener('scroll', () => {
    if (Math.abs(scrollY - run.scrolledTo) > 2 || Math.abs(scrollX) > 2) {
      stopFollowing();
    }
  }, { passive: true, signal });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      onFinish();
    } else if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End)$/.test(event.key)) {
      stopFollowing();
    }
  }, { signal });
  addEventListener('resize', () => {
    if (innerWidth !== run.width) {
      onFinish();
    }
  }, { signal });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
    if (event.matches) {
      onFinish();
    }
  }, { signal });
}
