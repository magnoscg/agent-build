/* The demo page's own script. It loads before agent-build.js, so it can set
   the trigger's language from ?lang= before the library labels the button.
   It also wires the API buttons and logs the library's events. */
(() => {
  'use strict';

  const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt', 'sv'];
  const requested = new URLSearchParams(location.search).get('lang');
  const language = LANGUAGES.includes(requested) ? requested : 'en';

  /* Only the trigger changes language: the page itself stays in English. */
  for (const trigger of document.querySelectorAll('[data-agent-build]')) {
    trigger.lang = language;
  }
  for (const link of document.querySelectorAll('[data-demo-lang]')) {
    if (link.dataset.demoLang === language) {
      link.setAttribute('aria-current', 'true');
    }
  }

  /* Deferred scripts run before DOMContentLoaded, so by then the library
     has shown its button, or left it hidden when it cannot run. */
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.querySelector('[data-agent-build]');
    if (!window.AgentBuild || !trigger || trigger.hidden) {
      return;
    }
    for (const button of document.querySelectorAll('[data-demo-run]')) {
      const options = JSON.parse(button.dataset.demoRun);
      button.addEventListener('click', () => window.AgentBuild.start(options));
      button.hidden = false;
    }
  });

  const log = document.getElementById('event-log');
  const write = (text) => {
    const empty = log.querySelector('.log-empty');
    if (empty) {
      empty.remove();
    }
    const item = document.createElement('li');
    item.textContent = text;
    log.prepend(item);
    while (log.children.length > 6) {
      log.lastElementChild.remove();
    }
  };

  document.addEventListener('agentbuild:start', (event) => {
    write(`agentbuild:start · from ${event.detail.trigger ? 'the button' : 'AgentBuild.start()'}`);
  });
  document.addEventListener('agentbuild:end', (event) => {
    const { skipped, built, total, seconds } = event.detail;
    write(`agentbuild:end · ${skipped ? 'stopped' : 'finished'} · ${built}/${total} layers · ${seconds.toFixed(1)} s`);
  });
})();
