import type { Texts } from './types.ts';

export default {
  kicker: 'Simulazione',
  label: 'Simulazione: agenti di IA che costruiscono la pagina',
  cta: 'Guarda gli agenti costruire la pagina',
  agents: (count) => `${count} ${count === 1 ? 'agente' : 'agenti'}`,
  layers: (done, total) => `${done}/${total} livelli`,
  pause: 'Pausa',
  resume: 'Riprendi',
  finish: 'Termina',
  started: 'Simulazione in corso: uno sciame di agenti di IA costruisce la pagina. Premi Esc per terminare.',
  built: (seconds) => `Costruita in ${seconds} s · era una simulazione`,
  finished: 'Simulazione terminata. La pagina è completa.',
} satisfies Texts;
