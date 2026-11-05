import {
  addLocale, defineElement, isRunning, type Locale, mount, start, type StartOptions, stop, version,
} from '@magnoscg/agent-build';
import '@magnoscg/agent-build/auto';

const options: StartOptions = { pace: 2, count: '8', accent: '#0A84FF', trigger: document.querySelector('button') };
const started: boolean = start(options);
const stopped: boolean = stop();
const running: boolean = isRunning();
const label: string = version;

// @ts-expect-error pace is a number or a numeric string
start({ pace: true });

const catalan: Locale = {
  kicker: 'Simulació',
  label: "Simulació: agents d'IA construint la pàgina",
  cta: 'Mira com els agents construeixen la pàgina',
  agents: { one: '{count} agent', other: '{count} agents' },
  layers: '{done}/{total} capes',
  pause: 'Pausa',
  resume: 'Continua',
  finish: 'Acaba',
  started: "Simulació en curs: un eixam d'agents d'IA està construint la pàgina. Prem Esc per acabar.",
  built: 'Construïda en {seconds} s · era una simulació',
  finished: 'Simulació acabada. La pàgina està completa.',
};
addLocale('ca', catalan);

// @ts-expect-error a language needs every text
addLocale('xx', { kicker: 'Simulation' });

mount(document.getElementById('app') ?? document);
defineElement();
const button: HTMLElement = document.createElement('agent-build-button');
button.setAttribute('data-agent-count', '5');

document.addEventListener('agentbuild:end', (event) => {
  const summary: [boolean, number, number, number] = [
    event.detail.skipped, event.detail.built, event.detail.total, event.detail.seconds,
  ];
  console.log(summary);
});

window.AgentBuild?.start({ count: 3 });
window.AgentBuild?.mount();
window.AgentBuild?.addLocale('ca', catalan);

export { label, running, started, stopped };
