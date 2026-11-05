import { makeDots } from './dom.ts';
import { LOCALES, resolveLanguage } from './locales/index.ts';
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

function setUp(trigger: HTMLElement) {
  if (trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type')) {
    trigger.type = 'button';
  }
  /* An empty button gets the agent dots and a label in the page's language,
     so it always has an accessible name. */
  const named = trigger.textContent.trim() !== ''
    || trigger.hasAttribute('aria-label')
    || trigger.hasAttribute('aria-labelledby')
    || trigger.querySelector('img[alt]:not([alt=""])');
  if (!named) {
    trigger.append(makeDots(), LOCALES[resolveLanguage(languageOf(trigger))].cta);
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
