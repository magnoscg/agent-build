import { el, makeDots } from './dom.ts';
import { addLocale as register, type Locale, phrasesFor } from './locales/index.ts';
import { cssLoaded, env, languageOf, supported } from './page.ts';
import { isRunning, start } from './run/run.ts';

const mounted = new WeakSet<Element>();
let listening = false;
let waiting = false;
let warned = false;

/* One listener on the document serves every trigger, present or future. It
   runs after the page's own handlers, so a framework's click handler that
   calls start() with its options, or calls preventDefault(), wins. */
function onClick(event: MouseEvent) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-agent-build]') : null;
  if (!trigger || event.defaultPrevented || isRunning()) {
    return;
  }
  event.preventDefault();
  start({ trigger });
}

function write(label: HTMLElement) {
  const text = phrasesFor(languageOf(label.parentElement));
  label.textContent = text.cta;
  label.lang = text.language;
  label.dir = text.dir;
}

/* Adds or replaces a language. The labels the library gave its triggers
   follow, so it works before or after they are mounted. */
export function addLocale(tag: string, texts: Locale): void {
  register(tag, texts);
  if (typeof document !== 'undefined') {
    for (const label of document.querySelectorAll<HTMLElement>('[data-agent-build] > .agent-build-label')) {
      write(label);
    }
  }
}

function setUp(trigger: HTMLElement) {
  if (trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type')) {
    trigger.type = 'button';
  }
  /* An empty button gets the agent dots and a label in the page's language,
     so it always has an accessible name. The label says which language it is
     in, since it may be the English fallback. */
  const named = trigger.textContent.trim() !== ''
    || trigger.hasAttribute('aria-label')
    || trigger.hasAttribute('aria-labelledby')
    || trigger.querySelector('img[alt]:not([alt=""])');
  if (!named) {
    const label = el('span', 'agent-build-label');
    trigger.append(makeDots(), label);
    write(label);
  }
  const accent = String(trigger.dataset.agentAccent ?? '').trim();
  if (accent && env.isColor(accent)) {
    trigger.style.setProperty('--agent-accent', accent);
  }
  trigger.hidden = false;
}

/* Shows the [data-agent-build] triggers in `root` that can run, once each.
   Safe to call again after rendering more of them. A trigger only appears
   when the browser can play the simulation and the stylesheet is in: until
   the page has loaded, a missing stylesheet is waited for. */
export function mount(root: ParentNode = document): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (!listening) {
    document.addEventListener('click', onClick);
    listening = true;
  }
  if (!supported()) {
    return;
  }
  if (!cssLoaded()) {
    if (document.readyState !== 'complete' && !waiting) {
      waiting = true;
      addEventListener('load', () => mount(), { once: true });
    } else if (document.readyState === 'complete' && !warned) {
      warned = true;
      env.warn('agent-build.css is not loaded, so the button stays hidden');
    }
    return;
  }
  const own = root instanceof HTMLElement && root.matches('[data-agent-build]') ? [root] : [];
  for (const trigger of [...own, ...root.querySelectorAll<HTMLElement>('[data-agent-build]')]) {
    if (!mounted.has(trigger)) {
      mounted.add(trigger);
      setUp(trigger);
    }
  }
}
