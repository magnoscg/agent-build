import type { Locale } from './types.ts';

export default {
  kicker: 'Simulation',
  label: 'Simulation: AI agents building the page',
  cta: 'Watch the agents build it',
  agents: { one: '{count} agent', other: '{count} agents' },
  layers: '{done}/{total} layers',
  pause: 'Pause',
  resume: 'Resume',
  finish: 'Finish',
  started: 'Simulation running: a swarm of AI agents is building the page. Press Escape to finish.',
  built: 'Built in {seconds} s · it was a simulation',
  finished: 'Simulation finished. The page is complete.',
} satisfies Locale;
