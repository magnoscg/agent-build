import { defineElement } from './element.ts';
import { mount } from './mount.ts';
import { type EndDetail, isRunning, start, type StartDetail, stop } from './run/run.ts';
import { VERSION } from './version.ts';

export type { Options, StartOptions } from './options.ts';
export type { EndDetail, StartDetail } from './run/run.ts';
export { defineElement, isRunning, mount, start, stop, VERSION as version };

export interface AgentBuildApi {
  readonly version: string;
  start: typeof start;
  stop: typeof stop;
  isRunning: typeof isRunning;
  mount: typeof mount;
}

declare global {
  interface Window {
    AgentBuild?: AgentBuildApi;
  }

  interface DocumentEventMap {
    'agentbuild:start': CustomEvent<StartDetail>;
    'agentbuild:end': CustomEvent<EndDetail>;
  }

  interface HTMLElementTagNameMap {
    'agent-build-button': HTMLElement;
  }
}
