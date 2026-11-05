/* A tiny stand-in for DOM elements, enough for the layer logic, which the
   tests import straight from src/. */
import { makeClassifier, selectLayers } from '../src/layers.ts';
import { normalizeOptions } from '../src/options.ts';

export const HTML = 'http://www.w3.org/1999/xhtml';
export const SVG = 'http://www.w3.org/2000/svg';

/* h('div', { class: 'card', box, style }, 'loose text', h('p', {}, 'Hi'))
   builds an element-like object. `box` is what measure() returns and
   `style` stands in for getComputedStyle(). */
export function h(tag, props = {}, ...content) {
  const classes = props.class ? props.class.split(/\s+/) : [];
  const attributes = { ...(props.attrs || {}) };
  if (props.class) {
    attributes.class = props.class;
  }
  const childNodes = content.map((item) => (typeof item === 'string' ? { nodeType: 3, nodeValue: item } : item));
  const element = {
    nodeType: 1,
    localName: tag,
    namespaceURI: props.ns || HTML,
    classList: { contains: (name) => classes.includes(name) },
    attributes,
    shadowRoot: props.shadow ? {} : null,
    childNodes,
    children: childNodes.filter((child) => child.nodeType === 1),
    get textContent() {
      return childNodes.map((child) => (child.nodeType === 3 ? child.nodeValue : child.textContent)).join('');
    },
    box: props.box,
    style: props.style,
    matches: (selector) => matchesList(element, selector),
    querySelector: (selector) => find(element, selector),
  };
  return element;
}

/* Supports what the library's selectors use: tags, classes and attributes,
   compounded and in comma lists. */
function matchesList(element, list) {
  return list.split(',').some((part) => matchesCompound(element, part.trim()));
}

function matchesCompound(element, selector) {
  if (selector === '') {
    return false;
  }
  const match = /^([a-z][a-z0-9-]*)?((?:\.[\w-]+|\[[^\]]+\])*)$/i.exec(selector);
  if (!match) {
    throw new Error(`the fake DOM does not support the selector "${selector}"`);
  }
  const [, tag, rest] = match;
  if (tag && tag.toLowerCase() !== element.localName) {
    return false;
  }
  for (const token of rest.match(/\.[\w-]+|\[[^\]]+\]/g) || []) {
    if (token.startsWith('.')) {
      if (!element.classList.contains(token.slice(1))) {
        return false;
      }
      continue;
    }
    const [, name, value] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(token);
    if (!(name in element.attributes)) {
      return false;
    }
    if (value !== undefined && element.attributes[name] !== value) {
      return false;
    }
  }
  return true;
}

function find(element, selector) {
  for (const child of element.children) {
    if (child.matches(selector)) {
      return child;
    }
    const deeper = find(child, selector);
    if (deeper) {
      return deeper;
    }
  }
  return null;
}

export const PAINTED = Object.freeze({ backgroundColor: 'rgb(255, 255, 255)', backgroundImage: 'none', boxShadow: 'none' });

export function defaultClassifier(config = normalizeOptions({}, {})) {
  return makeClassifier(config, (element) => element.style);
}

export function select(root, { classify = defaultClassifier(), limit } = {}) {
  return selectLayers(root, {
    childrenOf: (element) => element.children,
    classify,
    measure: (element) => element.box || { x: 0, y: 0, w: 100, h: 20 },
    limit,
  });
}

export const layersOf = (root, options) => select(root, options).layers;
