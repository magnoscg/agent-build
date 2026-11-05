import type { Locale } from './types.ts';

export default {
  kicker: 'Simulação',
  label: 'Simulação: agentes de IA montando a página',
  cta: 'Veja os agentes montarem a página',
  agents: { one: '{count} agente', other: '{count} agentes' },
  layers: '{done}/{total} camadas',
  pause: 'Pausar',
  resume: 'Continuar',
  finish: 'Encerrar',
  started: 'Simulação em andamento: um enxame de agentes de IA está montando a página. Pressione Esc para encerrar.',
  built: 'Montada em {seconds} s · era uma simulação',
  finished: 'Simulação encerrada. A página está completa.',
} satisfies Locale;
