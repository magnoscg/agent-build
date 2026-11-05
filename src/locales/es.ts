import type { Texts } from './types.ts';

export default {
  kicker: 'Simulación',
  label: 'Simulación: agentes de IA montando la página',
  cta: 'Mira cómo la montan los agentes',
  agents: (count) => `${count} ${count === 1 ? 'agente' : 'agentes'}`,
  layers: (done, total) => `${done}/${total} capas`,
  pause: 'Pausa',
  resume: 'Seguir',
  finish: 'Terminar',
  started: 'Simulación en curso: un enjambre de agentes de IA monta la página. Pulsa Escape para terminar.',
  built: (seconds) => `Montada en ${seconds} s · era una simulación`,
  finished: 'Simulación terminada. La página está completa.',
} satisfies Texts;
