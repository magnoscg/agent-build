import type { Locale } from './types.ts';

export default {
  kicker: 'Simulazione',
  label: 'Simulazione: agenti di IA che costruiscono la pagina',
  cta: 'Guarda gli agenti costruire la pagina',
  agents: { one: '{count} agente', other: '{count} agenti' },
  layers: '{done}/{total} livelli',
  pause: 'Pausa',
  resume: 'Riprendi',
  finish: 'Termina',
  started: 'Simulazione in corso: uno sciame di agenti di IA costruisce la pagina. Premi Esc per terminare.',
  built: 'Costruita in {seconds} s · era una simulazione',
  finished: 'Simulazione terminata. La pagina è completa.',
} satisfies Locale;
