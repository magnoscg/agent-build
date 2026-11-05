import type { Texts } from './types.ts';

export default {
  kicker: 'Simulering',
  label: 'Simulering: AI-agenter bygger sidan',
  cta: 'Se agenterna bygga sidan',
  agents: (count) => `${count} ${count === 1 ? 'agent' : 'agenter'}`,
  layers: (done, total) => `${done}/${total} lager`,
  pause: 'Pausa',
  resume: 'Fortsätt',
  finish: 'Avsluta',
  started: 'Simulering pågår: en svärm av AI-agenter bygger sidan. Tryck på Escape för att avsluta.',
  built: (seconds) => `Byggd på ${seconds} s · det var en simulering`,
  finished: 'Simuleringen är klar. Sidan är komplett.',
} satisfies Texts;
