import type { Config } from './options.ts';

export type Kind = 'frame' | 'pop' | 'type';
export type Classification = Kind | 'skip' | null;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layer<Node = Element> extends Box {
  element: Node;
  kind: Kind;
  index: number;
  tag: string;
}

type Side = 'Top' | 'Right' | 'Bottom' | 'Left';
export type PaintStyle = Partial<Pick<CSSStyleDeclaration,
  'backgroundImage' | 'backgroundColor' | 'boxShadow' | `border${Side}${'Width' | 'Style' | 'Color'}`>>;

const HTML_NS = 'http://www.w3.org/1999/xhtml';
/* A link that wraps blocks, the usual card, is a frame: its parts get built
   one by one inside it. */
const BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, figure, picture, img, video, table, blockquote, pre';
const MEDIA_SELECTOR = 'img, picture, svg, video, canvas';
export const BUTTONISH = '.button, .btn, [role="button"], [data-agent-build]';
const SKIP = new Set(['script', 'style', 'template', 'noscript', 'link', 'meta', 'base', 'title', 'slot']);
const NAMED = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'pre',
  'img', 'svg', 'video', 'canvas', 'iframe', 'table',
  'button', 'input', 'select', 'textarea', 'label', 'summary',
]);
export const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'iframe']);
const SIDES: Side[] = ['Top', 'Right', 'Bottom', 'Left'];

export function hasOwnText(element: Pick<Element, 'childNodes'>): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && /\S/.test(node.nodeValue ?? '')) {
      return true;
    }
  }
  return false;
}

/* Reads a computed colour: transparent, rgba(…, 0) or anything ending in
   "/ 0)". */
export function isTransparent(color: string | null | undefined): boolean {
  const value = String(color || '').trim().toLowerCase();
  if (value === '' || value === 'transparent') {
    return true;
  }
  if (!value.endsWith(')')) {
    return false;
  }
  const inner = value.slice(value.indexOf('(') + 1, -1);
  const slash = inner.lastIndexOf('/');
  let alpha: string | undefined;
  if (slash !== -1) {
    alpha = inner.slice(slash + 1);
  } else if (/^(rgba|hsla)\(/.test(value)) {
    alpha = inner.split(',')[3];
  }
  return alpha !== undefined && parseFloat(alpha) === 0;
}

/* A background, a shadow or a border all round makes an element a frame
   even when no selector names it, so cards built from plain divs get built
   too. */
export function paintsBox(style: PaintStyle | null | undefined): boolean {
  if (!style) {
    return false;
  }
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    return true;
  }
  if (!isTransparent(style.backgroundColor)) {
    return true;
  }
  if (style.boxShadow && style.boxShadow !== 'none') {
    return true;
  }
  return SIDES.every((side) => parseFloat(style[`border${side}Width`] ?? '') > 0
    && !/^(none|hidden)$/.test(style[`border${side}Style`] ?? '')
    && !isTransparent(style[`border${side}Color`]));
}

/* A block that holds media and no text, such as a link around a screenshot,
   a store badge or a list item with a logo, is an image. */
export function isMediaOnly(element: Pick<Element, 'textContent' | 'querySelector'>): boolean {
  return (element.textContent ?? '').trim() === '' && element.querySelector(MEDIA_SELECTOR) !== null;
}

/* Explicit frames win, then atoms. Then come the safety nets that keep any
   page from waiting hidden: loose text is typed (or becomes a frame when
   blocks sit next to it), and a painted box is a frame. 'skip' means neither
   the element nor anything in it is looked at; null means a wrapper to look
   inside. */
export function makeClassifier(config: Config, getStyle: (element: Element) => PaintStyle | null | undefined) {
  const candidates = `${config.frames}, ${config.atoms}`;
  return (element: Element): Classification => {
    const name = element.localName;
    if (SKIP.has(name) || element.classList.contains('agent-build-layer')) {
      return 'skip';
    }
    if (element.namespaceURI !== HTML_NS && name !== 'svg') {
      return 'skip';
    }
    if (element.matches(config.frames)) {
      return 'frame';
    }
    if (element.matches(config.atoms) || element.shadowRoot) {
      const pop = element.matches(config.pop);
      const media = isMediaOnly(element);
      if (name === 'a' && !pop && !media && element.querySelector(BLOCKS)) {
        return 'frame';
      }
      return pop || media || element.shadowRoot ? 'pop' : 'type';
    }
    if (hasOwnText(element)) {
      if (element.querySelector(candidates)) {
        return 'frame';
      }
      return element.matches(config.pop) ? 'pop' : 'type';
    }
    return paintsBox(getStyle(element)) ? 'frame' : null;
  };
}

interface Walk<Node> {
  childrenOf: (node: Node) => Iterable<Node>;
  classify: (node: Node) => Classification;
  measure: (node: Node) => Box;
}

/* Walks the tree in document order. Frames are kept and looked inside; atoms
   are kept with everything they hold, which is how nested matches are
   deduplicated. Anything smaller than 2 px is not a layer, but what it holds
   may be. */
export function selectLayers<Node>(root: Node, { childrenOf, classify, measure }: Walk<Node>): Layer<Node>[] {
  const layers: Layer<Node>[] = [];
  const visit = (parent: Node) => {
    for (const node of childrenOf(parent)) {
      const kind = classify(node);
      if (kind === 'skip') {
        continue;
      }
      if (kind) {
        const box = measure(node);
        if (box.w >= 2 && box.h >= 2) {
          layers.push({ element: node, kind, index: layers.length, tag: '', x: box.x, y: box.y, w: box.w, h: box.h });
          if (kind !== 'frame') {
            continue;
          }
        }
      }
      visit(node);
    }
  };
  visit(root);
  return layers;
}

export function planLayers<Item>(layers: Item[], max: number): { build: Item[]; shown: Item[] } {
  return { build: layers.slice(0, max), shown: layers.slice(max) };
}

export function tagOf(name: string, kind: Kind, buttonLike: boolean, mediaOnly: boolean): string {
  if (kind === 'frame') {
    return 'frame';
  }
  if (buttonLike || name === 'button') {
    return 'button';
  }
  if (mediaOnly || name === 'picture' || name === 'figure') {
    return 'img';
  }
  if (name === 'a') {
    return 'link';
  }
  if (NAMED.has(name)) {
    return name;
  }
  return kind === 'pop' ? 'block' : 'text';
}

/* Column guides come from the edges that repeat most across layers, so they
   follow the page's real grid without knowing it. */
export function columnEdges(layers: readonly Pick<Box, 'x' | 'w'>[]): number[] {
  const counts = new Map<number, number>();
  for (const layer of layers) {
    for (const edge of [layer.x, layer.x + layer.w]) {
      const key = Math.round(edge / 2) * 2;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const edges: number[] = [];
  for (const [x, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (count < 4 || edges.length === 4) {
      break;
    }
    if (edges.every((edge) => Math.abs(edge - x) > 24)) {
      edges.push(x);
    }
  }
  return edges;
}
