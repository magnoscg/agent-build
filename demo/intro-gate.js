/* Runs before the page paints, so the intro covers it from the first frame.
   Visitors who follow a link to a section or a language came for the page,
   and reduced motion gets no intro at all. If intro.js never takes over, the
   page comes back when it finishes loading. */
(() => {
  'use strict';

  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  if (location.hash
    || query.has('lang')
    || query.get('intro') === 'off'
    || typeof Element.prototype.animate !== 'function'
    || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  root.setAttribute('data-demo-intro', '');
  addEventListener('load', () => {
    if (!root.hasAttribute('data-demo-intro-live')) {
      root.removeAttribute('data-demo-intro');
    }
  });
})();
