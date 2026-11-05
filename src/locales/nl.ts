import type { Texts } from './types.ts';

export default {
  kicker: 'Simulatie',
  label: 'Simulatie: AI-agents bouwen de pagina',
  cta: 'Kijk hoe agents de pagina bouwen',
  agents: (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`,
  layers: (done, total) => `${done}/${total} lagen`,
  pause: 'Pauze',
  resume: 'Hervatten',
  finish: 'Afronden',
  started: 'Simulatie bezig: een zwerm AI-agents bouwt de pagina. Druk op Escape om af te ronden.',
  built: (seconds) => `Gebouwd in ${seconds} s · het was een simulatie`,
  finished: 'Simulatie afgerond. De pagina is compleet.',
} satisfies Texts;
