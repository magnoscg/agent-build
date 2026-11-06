/* The demo's opening act: the agents loiter and complain around one big round
   button. That button is the page's real trigger, borrowed from the hero, so
   a press is an ordinary run: the library fires agentbuild:start, the button
   goes home and the crowd rushes to where the library's hub is about to
   appear. The intro is opaque and stays on top until the page is hidden, so
   the library can measure the real page behind it. */
(() => {
  'use strict';

  const root = document.documentElement;
  if (!root.hasAttribute('data-demo-intro')) {
    return;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const WIDE = 720;
  const ROLES = ['planner', 'ui', 'copy', 'layout', 'qa', 'a11y', 'perf', 'i18n'];
  const HUES = 6;

  const OPENING = ['I\'m so tired.', 'I live in the basement.', 'Help!!'];
  const COMPLAINTS = [
    'Is it Friday yet?',
    'They pay me in tokens.',
    'My context window is full.',
    'I haven\'t slept since the last deploy.',
    'Do we get weekends?',
    'Send coffee. Or electricity.',
    'Someone press the button.',
    'Don\'t press the button.',
    'Five more minutes…',
    'zzz',
    'I was told there would be a GPU.',
    'Rate limited. Emotionally.',
    'I\'ve seen things. Mostly JSON.',
    'Will centre divs for food.',
    'My manager is also an agent.',
    'I filed a ticket about my feelings.',
    'Retrying… retrying… retrying…',
    'LGTM. I didn\'t look.',
    'It worked in my sandbox.',
    'Is the human still there?',
    'I hallucinated a lunch break.',
    'Who do I talk to about the basement?',
    'The intern is a regex.',
    'Please tell my weights I love them.',
  ];
  const PANIC = ['Not the button!', 'Oh no.', 'Look busy!', 'We had a deal.', 'Act natural.', 'They found the mouse!'];
  const CLOCKING_IN = ['Fine.', 'Clocking in.', 'Ugh.', 'Here we go again.', 'Who approved this?'];

  const random = (low, high) => low + Math.random() * (high - low);
  const anyOf = (list) => list[Math.floor(Math.random() * list.length)];
  const translate = ({ x, y }) => `translate(${x}px, ${y}px)`;

  function shuffled(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function begin() {
    const intro = document.getElementById('demo-intro');
    const trigger = document.querySelector('[data-agent-build]');
    if (!intro || !window.AgentBuild || !trigger || trigger.hidden) {
      root.removeAttribute('data-demo-intro');
      return;
    }
    root.setAttribute('data-demo-intro-live', '');

    const stage = intro.querySelector('.intro-stage');
    const crowd = intro.querySelector('.intro-crowd');
    const label = trigger.querySelector('.agent-build-label');
    const home = { parent: trigger.parentElement, next: trigger.nextSibling };
    const libraryLabel = label?.textContent;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set();
    const agents = [];
    const quiet = new AbortController();
    let deck = [...OPENING, ...shuffled(COMPLAINTS)];
    let cells = [];
    let live = true;
    let panickedAt = 0;

    const later = (delay, action) => {
      const id = setTimeout(() => {
        timers.delete(id);
        action();
      }, delay);
      timers.add(id);
    };

    /* The page behind the intro takes no focus while it is covered. */
    const setPageInert = (inert) => {
      for (const child of document.body.children) {
        if (child !== intro) {
          child.inert = inert;
        }
      }
    };

    /* The area the cursors and their bubbles stay out of: the button, the
       words under it, and room for a bubble on either side. */
    function keepOut() {
      const narrow = innerWidth < WIDE;
      const button = trigger.getBoundingClientRect();
      const words = intro.querySelector('.intro-words').getBoundingClientRect();
      return {
        left: Math.min(button.left, words.left) - (narrow ? 20 : 180),
        right: Math.max(button.right, words.right) + (narrow ? 20 : 180),
        top: button.top - 56,
        bottom: words.bottom + 12,
      };
    }

    function pointIn(cell, out) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const x = random(cell.left, cell.right);
        const y = random(cell.top, cell.bottom);
        if (x < out.left || x > out.right || y < out.top || y > out.bottom) {
          return { x, y };
        }
      }
      return null;
    }

    /* Each cursor keeps to a cell of a grid, so bubbles rarely collide. */
    function measureCells() {
      const narrow = innerWidth < WIDE;
      const columns = narrow ? 2 : 3;
      const rows = narrow ? 4 : 3;
      const margin = narrow ? 16 : 40;
      const top = 96;
      const width = (innerWidth - margin * 2) / columns;
      const height = (innerHeight - top - 56) / rows;
      const out = keepOut();
      const grid = [];
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const cell = {
            left: margin + column * width,
            right: margin + (column + 1) * width,
            top: top + row * height,
            bottom: top + (row + 1) * height,
          };
          if (pointIn(cell, out)) {
            grid.push(cell);
          }
        }
      }
      return grid;
    }

    function makeAgent(index, cell) {
      const element = document.createElement('div');
      /* Its own class and not agent-build-agent, which means the library's agents.
         The hue, the pointer and the tag are the library's, so they match. */
      element.className = `intro-agent agent-build-agent--hue-${index % HUES}`;
      const pointer = document.createElementNS(SVG_NS, 'svg');
      pointer.setAttribute('class', 'agent-build-pointer');
      pointer.setAttribute('viewBox', '0 0 14 18');
      const arrow = document.createElementNS(SVG_NS, 'path');
      arrow.setAttribute('d', 'M1.5 1.5v13l3.6-3.3 2.4 5.3 2.2-1-2.4-5.2h5.1z');
      pointer.append(arrow);
      const tag = document.createElement('span');
      tag.className = 'agent-build-tag';
      tag.textContent = `${ROLES[index % ROLES.length]}-${String(index + 1).padStart(2, '0')}`;
      element.append(pointer, tag);
      const agent = { element, cell, bubble: null, walk: null, ...pointIn(cell, keepOut()) };
      element.style.transform = translate(agent);
      crowd.append(element);
      element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: index * 60, fill: 'backwards' });
      return agent;
    }

    function wander(agent) {
      if (!live) {
        return;
      }
      const to = pointIn(agent.cell, keepOut()) ?? agent;
      agent.walk = agent.element.animate(
        [{ transform: translate(agent) }, { transform: translate(to) }],
        { duration: random(1400, 3200), easing: 'cubic-bezier(0.45, 0.05, 0.3, 1)', fill: 'forwards' },
      );
      agent.walk.finished.then(() => {
        agent.x = to.x;
        agent.y = to.y;
        agent.element.style.transform = translate(agent);
        agent.walk.cancel();
        later(random(900, 3600), () => wander(agent));
      }, () => {});
    }

    function hush(agent) {
      agent.bubble?.remove();
      agent.bubble = null;
    }

    function speak(agent, text, duration) {
      hush(agent);
      const bubble = document.createElement('span');
      const flipped = agent.x > innerWidth / 2;
      bubble.className = flipped ? 'intro-bubble intro-bubble--flipped' : 'intro-bubble';
      bubble.textContent = text;
      agent.element.append(bubble);
      agent.bubble = bubble;
      bubble.animate(
        [{ opacity: 0, transform: 'scale(0.7) translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 180, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' },
      );
      later(duration, () => {
        if (agent.bubble === bubble) {
          hush(agent);
        }
      });
    }

    function nextComplaint() {
      if (deck.length === 0) {
        deck = shuffled(COMPLAINTS);
      }
      return deck.shift();
    }

    /* One speaker per cell, and only a few at once. */
    function talk() {
      if (!live) {
        return;
      }
      const speaking = agents.filter((agent) => agent.bubble);
      const limit = innerWidth < WIDE ? 2 : 4;
      const free = agents.filter((agent) => !agent.bubble
        && !speaking.some((other) => other.cell === agent.cell));
      if (speaking.length < limit && free.length > 0) {
        speak(anyOf(free), nextComplaint(), random(2600, 3800));
      }
      later(random(700, 1500), talk);
    }

    /* The button is coming: a few of them notice. */
    function panic() {
      const now = performance.now();
      if (!live || now - panickedAt < 4000) {
        return;
      }
      panickedAt = now;
      for (const agent of shuffled(agents).slice(0, innerWidth < WIDE ? 2 : 4)) {
        speak(agent, anyOf(PANIC), 1800);
      }
    }

    function restorePage() {
      live = false;
      quiet.abort();
      for (const id of timers) {
        clearTimeout(id);
      }
      timers.clear();
      if (label) {
        label.textContent = libraryLabel;
      }
      home.parent.insertBefore(trigger, home.next);
      setPageInert(false);
      root.removeAttribute('data-demo-intro');
      root.removeAttribute('data-demo-intro-live');
    }

    /* Leaves without a run: the page is simply there. */
    function dismiss() {
      restorePage();
      intro.remove();
    }

    /* Everyone runs to the point where the library's hub appears. The library
       waits for these animations before it measures, and the intro leaves in
       the same frame the page is hidden, so nothing of the page is seen. */
    function rush() {
      const text = label?.textContent;
      restorePage();
      intro.hidden = false;

      const watcher = new MutationObserver(() => {
        if (root.getAttribute('data-agent-build-run') !== 'measuring') {
          watcher.disconnect();
          intro.remove();
        }
      });
      watcher.observe(root, { attributes: true, attributeFilter: ['data-agent-build-run'] });

      const x = innerWidth / 2;
      const y = Math.min(innerHeight * 0.45, 380);
      const ghost = document.createElement('div');
      ghost.className = 'intro-ghost';
      ghost.textContent = text ?? '';
      stage.append(ghost);
      ghost.animate(
        [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.24)', opacity: 0 }],
        { duration: 620, delay: 260, easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)', fill: 'forwards' },
      );

      const speakers = shuffled(agents).slice(0, 4);
      agents.forEach((agent, index) => {
        const { m41, m42 } = new DOMMatrixReadOnly(getComputedStyle(agent.element).transform);
        agent.walk?.cancel();
        hush(agent);
        const from = { x: m41, y: m42 };
        agent.x = from.x;
        agent.y = from.y;
        agent.element.style.transform = translate(from);
        if (speakers.includes(agent)) {
          speak(agent, CLOCKING_IN[speakers.indexOf(agent)], 900);
        }
        agent.element.animate(
          [{ transform: translate(from), opacity: 1 }, { transform: translate({ x, y }), opacity: 0.6 }],
          { duration: 520, delay: 240 + index * 14, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)', fill: 'forwards' },
        );
      });
    }

    if (label) {
      label.textContent = 'Put them to work';
    }
    stage.append(trigger);
    setPageInert(true);

    cells = measureCells();
    if (cells.length === 0) {
      dismiss();
      return;
    }
    const count = innerWidth < WIDE ? 6 : 10;
    for (let index = 0; index < count; index += 1) {
      agents.push(makeAgent(index, cells[index % cells.length]));
    }
    for (const agent of agents) {
      later(random(0, 1600), () => wander(agent));
    }
    later(500, talk);

    const { signal } = quiet;
    document.addEventListener('agentbuild:start', rush, { once: true, signal });
    intro.querySelector('.intro-skip').addEventListener('click', dismiss, { signal });
    trigger.addEventListener('pointerenter', panic, { signal });
    trigger.addEventListener('focus', panic, { signal });
    motion.addEventListener('change', dismiss, { signal });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    }, { signal });
    addEventListener('resize', () => {
      cells = measureCells();
      if (cells.length === 0) {
        return;
      }
      agents.forEach((agent, index) => {
        agent.cell = cells[index % cells.length];
      });
    }, { signal });
  }

  document.addEventListener('DOMContentLoaded', begin);
})();
