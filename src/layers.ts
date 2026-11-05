import type { Config } from './options.ts';
import { BLOCKS, BUTTONISH, CONTROL_TAGS, MEDIA_TAGS, TEXT_TAGS } from './vocabulary.ts';

export type Kind = 'frame' | 'pop' | 'type';
/* 'rest' is shown as it is, without being built; 'skip' is left alone;
   null is a wrapper whose children are looked at. */
export type Classification = Kind | 'rest' | 'skip' | null;

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
  parent: Layer<Node> | null;
  tag: string;
}

export interface Rest<Node = Element> {
  element: Node;
  parent: Layer<Node> | null;
}

type Side = 'Top' | 'Right' | 'Bottom' | 'Left';
export type PageStyle = Partial<Pick<CSSStyleDeclaration,
  'display' | 'visibility' | 'position' | 'backgroundImage' | 'backgroundColor' | 'boxShadow'
  | `border${Side}${'Width' | 'Style' | 'Color'}`>>;

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const FOREIGN_ROOTS = new Set(['svg', 'math']);
const SKIP = new Set(['script', 'style', 'template', 'noscript', 'link', 'meta', 'base', 'title', 'slot']);
const SILENT = new Set(['script', 'style', 'template', 'noscript', 'title', 'svg']);
const MEDIA_SELECTOR = MEDIA_TAGS.join(', ');
const NAMED = new Set([...TEXT_TAGS, ...CONTROL_TAGS, 'summary']);
const SIDES: Side[] = ['Top', 'Right', 'Bottom', 'Left'];

/* The labels whose boxes are drawn as grey media placeholders. */
export const MEDIA_LABELS = new Set(MEDIA_TAGS.filter((tag) => tag !== 'picture'));

export function hasOwnText(element: Pick<Element, 'childNodes'>): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && /\S/.test(node.nodeValue ?? '')) {
      return true;
    }
  }
  return false;
}

/* Text a reader sees: not the title or styles inside an SVG, nor scripts and
   noscript fallbacks. */
export function hasVisibleText(element: Pick<Element, 'childNodes'>): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && /\S/.test(node.nodeValue ?? '')) {
      return true;
    }
    if (node.nodeType === 1 && !SILENT.has((node as Element).localName) && hasVisibleText(node as Element)) {
      return true;
    }
  }
  return false;
}

/* A block holding media and no text, such as a link around a screenshot, a
   store badge or a list item with a logo, is an image. */
export function isMediaOnly(element: Pick<Element, 'childNodes' | 'querySelector'>): boolean {
  return element.querySelector(MEDIA_SELECTOR) !== null && !hasVisibleText(element);
}

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

/* A background, a shadow or a border all round makes an element a frame even
   when no selector names it, so cards built from plain divs get built too. */
export function paintsBox(style: PageStyle | null | undefined): boolean {
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

/* Explicit frames win, then atoms. What the page itself hides is left
   alone, and what is fixed to the window is shown as it is. Loose text is
   typed, or makes a frame when blocks sit next to it, and a painted box is a
   frame. */
export function makeClassifier(config: Config, getStyle: (element: Element) => PageStyle | null | undefined) {
  const candidates = `${config.frames}, ${config.atoms}`;
  return (element: Element): Classification => {
    const name = element.localName;
    if (SKIP.has(name) || element.classList.contains('agent-build-layer')) {
      return 'skip';
    }
    const foreign = FOREIGN_ROOTS.has(name);
    if (element.namespaceURI !== HTML_NS && !foreign) {
      return 'skip';
    }
    const style = getStyle(element);
    if (style?.display === 'none' || (style?.visibility && style.visibility !== 'visible')) {
      return 'skip';
    }
    if (style?.position === 'fixed') {
      return 'rest';
    }
    if (element.matches(config.frames)) {
      return 'frame';
    }
    if (foreign || element.shadowRoot || element.matches(config.atoms)) {
      const pop = foreign || element.shadowRoot !== null || element.matches(config.pop) || isMediaOnly(element);
      if (name === 'a' && !pop && element.querySelector(BLOCKS)) {
        return 'frame';
      }
      return pop ? 'pop' : 'type';
    }
    if (hasOwnText(element)) {
      if (element.querySelector(candidates)) {
        return 'frame';
      }
      return element.matches(config.pop) ? 'pop' : 'type';
    }
    return paintsBox(style) ? 'frame' : null;
  };
}

interface Walk<Node> {
  childrenOf: (node: Node) => ArrayLike<Node>;
  classify: (node: Node) => Classification;
  measure: (node: Node) => Box;
  limit?: number;
}

/* Walks the tree in document order. A frame is kept and looked inside, and
   becomes the parent of what is found there; an atom is kept with everything
   it holds, which deduplicates nested matches. Whatever no layer covers is
   kept as rest, to be shown rather than hidden until the end: leaves that
   are neither frames nor atoms, blocks under 2 px with nothing inside, and
   everything after the layer limit. */
export function selectLayers<Node>(root: Node, { childrenOf, classify, measure, limit = Infinity }: Walk<Node>) {
  const layers: Layer<Node>[] = [];
  const rest: Rest<Node>[] = [];
  const visit = (parent: Node, frame: Layer<Node> | null) => {
    for (const node of Array.from(childrenOf(parent))) {
      if (layers.length >= limit) {
        rest.push({ element: node, parent: frame });
        continue;
      }
      const kind = classify(node);
      if (kind === 'skip') {
        continue;
      }
      if (kind === 'rest') {
        rest.push({ element: node, parent: frame });
        continue;
      }
      if (kind) {
        const box = measure(node);
        if (box.w >= 2 && box.h >= 2) {
          const layer: Layer<Node> = { element: node, kind, index: layers.length, parent: frame, tag: '', ...box };
          layers.push(layer);
          if (kind === 'frame') {
            visit(node, layer);
          }
          continue;
        }
      }
      if (childrenOf(node).length === 0) {
        rest.push({ element: node, parent: frame });
        continue;
      }
      visit(node, frame);
    }
  };
  visit(root, null);
  return { layers, rest };
}

function mediaLabel(name: string) {
  return name === 'picture' ? 'img' : name;
}

export function labelOf(element: Element, kind: Kind): string {
  if (kind === 'frame') {
    return 'frame';
  }
  const name = element.localName;
  if (name === 'button' || element.matches(BUTTONISH)) {
    return 'button';
  }
  if (MEDIA_TAGS.includes(name)) {
    return mediaLabel(name);
  }
  if (name === 'figure' || isMediaOnly(element)) {
    return mediaLabel(element.querySelector(MEDIA_SELECTOR)?.localName ?? 'img');
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
