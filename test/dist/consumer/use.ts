import { isRunning, start, type StartOptions, stop, version } from '@magnoscg/agent-build';

const options: StartOptions = { pace: 2, count: '8', accent: '#0A84FF', trigger: document.querySelector('button') };
const started: boolean = start(options);
const stopped: boolean = stop();
const running: boolean = isRunning();
const label: string = version;

// @ts-expect-error pace is a number or a numeric string
start({ pace: true });

document.addEventListener('agentbuild:end', (event) => {
  const summary: [boolean, number, number, number] = [
    event.detail.skipped, event.detail.built, event.detail.total, event.detail.seconds,
  ];
  console.log(summary);
});

window.AgentBuild?.start({ count: 3 });

export { label, running, started, stopped };
