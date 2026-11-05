import { el, FADE_IN, FADE_OUT, svg } from '../dom.ts';
import { type Layer, MEDIA_LABELS } from '../layers.ts';
import { EASE, move, play, sleep } from './animate.ts';
import type { Agent, Run } from './types.ts';

const ROLES = ['planner', 'ui', 'copy', 'layout', 'qa', 'a11y', 'perf', 'i18n'];
const HUES = 6;
const RULER = 16;

/* The script's own top-level nodes, which the stylesheet never hides, with
   the accent when one was given. */
export function layerElement<Tag extends keyof HTMLElementTagNameMap>(run: Run, tag: Tag, className: string) {
  const element = el(tag, `${className} agent-build-layer`);
  if (run.config.accent) {
    element.style.setProperty('--agent-accent', run.config.accent);
  }
  return element;
}

/* Fixed overlays go to the top layer where popovers exist, out of reach of
   the page's stacking contexts and of a body that would contain them. */
export function float(element: HTMLElement) {
  const popover = typeof element.showPopover === 'function';
  if (popover) {
    element.popover = 'manual';
  }
  document.body.append(element);
  if (popover) {
    element.showPopover();
  }
}

/* The work layer covers the whole document, so cursors and boxes use page
   coordinates and scroll with it, placed at the document's origin whatever
   the body's position or margins. */
export function makeStage(run: Run) {
  const root = document.documentElement;
  const stage = layerElement(run, 'div', 'agent-build-stage');
  stage.setAttribute('aria-hidden', 'true');
  document.body.append(stage);
  const origin = stage.getBoundingClientRect();
  stage.style.left = `${-(origin.left + scrollX)}px`;
  stage.style.top = `${-(origin.top + scrollY)}px`;
  stage.style.width = `${Math.max(root.scrollWidth, root.clientWidth)}px`;
  stage.style.height = `${Math.max(root.scrollHeight, document.body.scrollHeight)}px`;
  return stage;
}

export function growStage(stage: HTMLElement, bottom: number) {
  if (bottom > parseFloat(stage.style.height)) {
    stage.style.height = `${Math.ceil(bottom)}px`;
  }
}

/* The top ruler is fixed to the window; the side ruler lives in the work
   layer, so its figures are page coordinates. Figures stop a little past the
   last layer to be built. */
export function makeRulers(run: Run, stage: HTMLElement, bottom: number) {
  const top = layerElement(run, 'div', 'agent-build-ruler agent-build-ruler--top');
  top.setAttribute('aria-hidden', 'true');
  for (let x = 100; x < innerWidth; x += 100) {
    top.append(rulerMark(x, 'left'));
  }
  float(top);
  const side = el('div', 'agent-build-ruler agent-build-ruler--side');
  const end = Math.min(parseFloat(stage.style.height), bottom + innerHeight * 2);
  for (let y = 100; y < end; y += 100) {
    side.append(rulerMark(y, 'top'));
  }
  stage.append(side);
  return top;
}

function rulerMark(value: number, edge: 'left' | 'top') {
  const mark = el('span', '', String(value));
  mark.style[edge] = `${value}px`;
  return mark;
}

export function makeGuide(stage: HTMLElement, axis: 'column' | 'row', position: number) {
  const guide = el('span', `agent-build-guide agent-build-guide--${axis}`);
  guide.style[axis === 'column' ? 'left' : 'top'] = `${position}px`;
  stage.append(guide);
  return guide;
}

/* Media is drawn first as a grey block, like the placeholder a design tool
   leaves before the picture goes in. */
export function makeBox(stage: HTMLElement, layer: Layer, qa: boolean) {
  const element = el('div', ['agent-build-box', qa && 'agent-build-box--qa',
    MEDIA_LABELS.has(layer.tag) && 'agent-build-box--media'].filter(Boolean).join(' '));
  element.style.left = `${layer.x}px`;
  element.style.top = `${layer.y}px`;
  element.style.width = `${layer.w}px`;
  element.style.height = `${layer.h}px`;
  element.style.setProperty('--w', `${layer.w}px`);
  element.style.setProperty('--h', `${layer.h}px`);
  const line = el('span', 'agent-build-box-line');
  const tag = el('span', 'agent-build-box-label', qa ? `qa · ${layer.tag}` : layer.tag);
  const size = el('span', 'agent-build-box-size', `${Math.round(layer.w)} × ${Math.round(layer.h)}`);
  if (layer.y < RULER + 22) {
    element.classList.add('agent-build-box--inside');
  }
  if (layer.x < RULER + 4) {
    tag.style.left = `${RULER + 4 - layer.x}px`;
  }
  element.append(line, tag, size);
  stage.append(element);
  return { element, line, tag, size };
}

/* The page's own icon when data-agent-hub names one, or four blocks being
   assembled, drawn inline so `img-src` never needs `data:`. */
function makeHubIcon(source: string) {
  if (source) {
    const image = el('img');
    image.src = source;
    image.alt = '';
    image.width = 32;
    image.height = 32;
    return image;
  }
  return svg('agent-build-hub-icon', '0 0 32 32', [[4, 4], [18, 4], [4, 18], [18, 18]]
    .map(([x, y]) => ['rect', { x: String(x), y: String(y), width: '10', height: '10', rx: '2.5' }]));
}

/* Three cursors per agent, as in a design tool: an arrow to fly, a crosshair
   to draw and an I-beam to type. */
function makeAgent(stage: HTMLElement, index: number, x: number, y: number): Agent {
  const element = el('div', `agent-build-agent agent-build-agent--hue-${index % HUES}`);
  const role = `${ROLES[index % ROLES.length]}-${String(index + 1).padStart(2, '0')}`;
  element.append(
    svg('agent-build-pointer', '0 0 14 18', [['path', { d: 'M1.5 1.5v13l3.6-3.3 2.4 5.3 2.2-1-2.4-5.2h5.1z' }]]),
    svg('agent-build-cross', '0 0 16 16', [['path', { d: 'M8 1v14M1 8h14' }]]),
    svg('agent-build-ibeam', '0 0 10 18', [['path', { d: 'M2 1.5h6M2 16.5h6M5 1.5v15' }]]),
    el('span', 'agent-build-tag', role),
  );
  element.style.transform = `translate(${x}px, ${y}px)`;
  stage.append(element);
  return { element, x, y };
}

/* The hub appears in the middle and the agents fan out of it. */
export async function intro(run: Run, stage: HTMLElement) {
  const { count } = run.config;
  const centerX = scrollX + innerWidth / 2;
  const centerY = scrollY + Math.min(innerHeight * 0.45, 380);
  const hub = el('div', 'agent-build-hub');
  hub.append(makeHubIcon(run.config.hub));
  hub.style.left = `${centerX}px`;
  hub.style.top = `${centerY}px`;
  stage.append(hub);
  play(run, hub, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
  ], { duration: 420, easing: EASE, fill: 'forwards' });
  await sleep(run, 360);

  const agents = Array.from({ length: count }, (_, index) => makeAgent(stage, index, centerX, centerY));
  await Promise.all(agents.map((agent, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = 64 + (index % 3) * 34;
    play(run, agent.element, FADE_IN, { duration: 220 });
    return move(run, agent,
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius * 0.72,
      520 + index * 14);
  }));
  play(run, hub, FADE_OUT, { duration: 480, fill: 'forwards' });
  return agents;
}
