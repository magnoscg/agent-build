import type { Env } from './options.ts';

export const triggers = () => document.querySelectorAll<HTMLElement>('[data-agent-build]');

export const supported = () => typeof Element.prototype.animate === 'function'
  && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export const cssLoaded = () => getComputedStyle(document.documentElement)
  .getPropertyValue('--agent-build-css').trim() === '1';

export const languageOf = (element: Element | null) => (element?.closest('[lang]') ?? document.documentElement)
  .getAttribute('lang') ?? '';

export const env: Required<Omit<Env, 'narrow'>> = {
  isSelector(selector) {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  },
  isColor(value) {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', value);
  },
  warn(message) {
    console.warn(`[agent-build] ${message}`);
  },
};
