import type { Texts } from './types.ts';

export default {
  kicker: 'Simulation',
  label: 'Simulation: KI-Agenten bauen die Seite',
  cta: 'Sieh zu, wie Agenten die Seite bauen',
  agents: (count) => `${count} ${count === 1 ? 'Agent' : 'Agenten'}`,
  layers: (done, total) => `${done}/${total} Ebenen`,
  pause: 'Pause',
  resume: 'Weiter',
  finish: 'Beenden',
  started: 'Simulation läuft: Ein Schwarm von KI-Agenten baut die Seite. Drücke Escape zum Beenden.',
  built: (seconds) => `In ${seconds} s gebaut · es war eine Simulation`,
  finished: 'Simulation beendet. Die Seite ist vollständig.',
} satisfies Texts;
