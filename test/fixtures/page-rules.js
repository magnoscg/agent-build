/* What real pages do: settle scroll reveals when a run starts, and rewrite a
   header's whole class attribute on scroll, as React's className does. */
document.addEventListener('agentbuild:start', () => {
  document.getElementById('reveal').classList.add('is-revealed');
});
addEventListener('scroll', () => {
  document.getElementById('top').className = scrollY > 0 ? 'top scrolled' : 'top';
}, { passive: true });
