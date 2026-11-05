import type { Locale } from './types.ts';

export default {
  kicker: 'Simulación',
  label: 'Simulación: agentes de IA montando la página',
  cta: 'Mira cómo la montan los agentes',
  agents: { one: '{count} agente', other: '{count} agentes' },
  layers: '{done}/{total} capas',
  pause: 'Pausa',
  resume: 'Seguir',
  finish: 'Terminar',
  started: 'Simulación en curso: un enjambre de agentes de IA monta la página. Pulsa Escape para terminar.',
  built: 'Montada en {seconds} s · era una simulación',
  finished: 'Simulación terminada. La página está completa.',
} satisfies Locale;
