import type { Locale } from './types.ts';

export default {
  kicker: 'Simulatie',
  label: 'Simulatie: AI-agents bouwen de pagina',
  cta: 'Kijk hoe agents de pagina bouwen',
  agents: { one: '{count} agent', other: '{count} agents' },
  layers: '{done}/{total} lagen',
  pause: 'Pauze',
  resume: 'Hervatten',
  finish: 'Afronden',
  started: 'Simulatie bezig: een zwerm AI-agents bouwt de pagina. Druk op Escape om af te ronden.',
  built: 'Gebouwd in {seconds} s · het was een simulatie',
  finished: 'Simulatie afgerond. De pagina is compleet.',
} satisfies Locale;
