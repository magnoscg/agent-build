import { makeDots } from './dom.ts';
import { LOCALES, resolveLanguage } from './locales/index.ts';
import { env, languageOf, supported, triggers } from './page.ts';
import { start } from './run/run.ts';

export function setUpTriggers() {
  if (!supported()) {
    return;
  }
  for (const trigger of triggers()) {
    const text = LOCALES[resolveLanguage(languageOf(trigger))];
    if (trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type')) {
      trigger.type = 'button';
    }
    /* An empty button gets the agent dots and a label in the page's
       language, so it always has an accessible name. */
    const named = trigger.textContent.trim() !== ''
      || trigger.hasAttribute('aria-label')
      || trigger.hasAttribute('aria-labelledby')
      || trigger.querySelector('img[alt]:not([alt=""])');
    if (!named) {
      trigger.append(makeDots(), text.cta);
    }
    const accent = String(trigger.dataset.agentAccent ?? '').trim();
    if (accent && env.isColor(accent)) {
      trigger.style.setProperty('--agent-accent', accent);
    }
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      start({ trigger });
    });
    trigger.hidden = false;
  }
}
