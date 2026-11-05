import type { Texts } from './types.ts';

export default {
  kicker: 'Simulation',
  label: 'Simulation : des agents d’IA construisent la page',
  cta: 'Regardez les agents construire la page',
  agents: (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`,
  layers: (done, total) => `${done}/${total} calques`,
  pause: 'Pause',
  resume: 'Reprendre',
  finish: 'Terminer',
  started: 'Simulation en cours : un essaim d’agents d’IA construit la page. Appuyez sur Échap pour terminer.',
  built: (seconds) => `Construite en ${seconds} s · c’était une simulation`,
  finished: 'Simulation terminée. La page est complète.',
} satisfies Texts;
