import type { Locale } from './types.ts';

export default {
  kicker: 'Simulation',
  label: 'Simulation: KI-Agenten bauen die Seite',
  cta: 'Sieh zu, wie Agenten die Seite bauen',
  agents: { one: '{count} Agent', other: '{count} Agenten' },
  layers: '{done}/{total} Ebenen',
  pause: 'Pause',
  resume: 'Weiter',
  finish: 'Beenden',
  started: 'Simulation läuft: Ein Schwarm von KI-Agenten baut die Seite. Drücke Escape zum Beenden.',
  built: 'In {seconds} s gebaut · es war eine Simulation',
  finished: 'Simulation beendet. Die Seite ist vollständig.',
} satisfies Locale;
