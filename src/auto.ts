import { type AgentBuildApi, isRunning, start, stop, version } from './index.ts';
import { setUpTriggers } from './triggers.ts';

/* The classic-script build: defines window.AgentBuild and wires the buttons
   once the document is parsed. A second copy of the script reuses the first. */
if (!window.AgentBuild) {
  const api: AgentBuildApi = Object.freeze({ version, start, stop, isRunning });
  window.AgentBuild = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setUpTriggers, { once: true });
  } else {
    setUpTriggers();
  }
}
