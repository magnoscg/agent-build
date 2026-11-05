import {
  type AgentBuildApi, addLocale, defineElement, isRunning, mount, start, stop, version,
} from './index.ts';

/* What the <script> tag and `import '@magnoscg/agent-build/auto'` do: define
   window.AgentBuild, define <agent-build-button> and mount the triggers once
   the document is parsed. A second copy reuses the first; anything else that
   took the name, such as an element with id="AgentBuild", does not count. */
if (typeof window !== 'undefined' && typeof window.AgentBuild?.start !== 'function') {
  const api: AgentBuildApi = Object.freeze({ version, start, stop, isRunning, mount, addLocale });
  window.AgentBuild = api;
  defineElement();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  } else {
    mount();
  }
}
