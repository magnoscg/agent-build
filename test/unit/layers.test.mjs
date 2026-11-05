import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnEdges, hasOwnText, hasVisibleText, isMediaOnly, isTransparent, labelOf, MEDIA_LABELS, paintsBox, selectLayers,
} from '../../src/layers.ts';
import { normalizeOptions } from '../../src/options.ts';
import { h, SVG, PAINTED, defaultClassifier, layersOf, select } from '../helpers.mjs';

const MATHML = 'http://www.w3.org/1998/Math/MathML';
const describe = (layers) => layers.map((layer) => `${layer.kind}:${layer.element.localName}`);
const restOf = (selection) => selection.rest.map(({ element }) => element.localName);

// MARK: - Classifier

test('the default classifier knows boxes, media and text', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('section')), 'frame');
  assert.equal(classify(h('footer')), 'frame');
  assert.equal(classify(h('p', {}, 'Hello')), 'type');
  assert.equal(classify(h('h1', {}, 'Title')), 'type');
  assert.equal(classify(h('img')), 'pop');
  assert.equal(classify(h('video')), 'pop');
  assert.equal(classify(h('audio')), 'pop');
  assert.equal(classify(h('progress')), 'pop');
  assert.equal(classify(h('button', {}, 'Go')), 'pop');
  assert.equal(classify(h('button', { attrs: { 'data-agent-build': '' } })), 'pop');
  assert.equal(classify(h('a', {}, 'Docs')), 'type');
  assert.equal(classify(h('a', { class: 'btn' }, 'Buy')), 'pop');
});

test('SVG and MathML roots are blocks and their insides are skipped', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('svg', { ns: SVG })), 'pop');
  assert.equal(classify(h('math', { ns: MATHML })), 'pop');
  assert.equal(classify(h('path', { ns: SVG })), 'skip');
  assert.equal(classify(h('mi', { ns: MATHML }, 'x')), 'skip');
});

test('what the page hides is left alone and what is fixed is shown as it is', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('p', { style: { visibility: 'hidden' } }, 'Required')), 'skip');
  assert.equal(classify(h('ul', { style: { display: 'none' } }, h('li', {}, 'Menu'))), 'skip');
  assert.equal(classify(h('div', { style: { position: 'fixed' } }, 'Chat')), 'rest');
  assert.equal(classify(h('p', { style: { visibility: 'visible', display: 'block', position: 'static' } }, 'Hi')), 'type');
});

test('a link that wraps blocks is a frame, like a card', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('a', {}, h('img'), h('h3', {}, 'Post'))), 'frame');
  assert.equal(classify(h('a', {}, h('span', {}, 'Icon'), 'Docs')), 'type');
});

test('a block that holds only media is an image that fades in', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('a', {}, h('img'))), 'pop');
  assert.equal(classify(h('a', {}, ' ', h('picture', {}, h('img')), ' ')), 'pop');
  assert.equal(classify(h('a', {}, h('svg', { ns: SVG }, h('title', { ns: SVG }, 'Download on the App Store')))), 'pop');
  assert.equal(classify(h('li', {}, h('img'))), 'pop');
  assert.equal(classify(h('p', {}, h('iframe'))), 'pop');
  assert.equal(classify(h('p', {}, h('img'), 'Caption')), 'type');
});

test('only text a reader sees counts as text', () => {
  assert.equal(hasVisibleText(h('a', {}, h('svg', { ns: SVG }, h('title', { ns: SVG }, 'Badge')))), false);
  assert.equal(hasVisibleText(h('a', {}, h('img'), h('noscript', {}, '<img src="x">'))), false);
  assert.equal(hasVisibleText(h('a', {}, h('span', {}, 'Download'))), true);
  assert.equal(isMediaOnly(h('a', {}, h('img'), h('noscript', {}, '<img src="x">'))), true);
  assert.equal(isMediaOnly(h('div', {}, h('span', {}, h('video')))), true);
  assert.equal(isMediaOnly(h('a', {}, h('img'), h('span', {}, 'Download'))), false);
  assert.equal(isMediaOnly(h('a', {}, '')), false);
});

test('loose text is typed, or makes a frame when blocks sit next to it', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('div', {}, 'Price: ', h('b', {}, '20'))), 'type');
  assert.equal(classify(h('span', {}, '2026')), 'type');
  assert.equal(classify(h('div', {}, 'Intro', h('p', {}, 'More'))), 'frame');
  assert.equal(classify(h('div', {}, '   \n  ')), null);
});

test('a painted box is a frame even when no selector names it', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('div', { style: PAINTED })), 'frame');
  assert.equal(classify(h('div', { style: { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', boxShadow: 'none' } })), null);
  assert.equal(classify(h('div')), null);
});

test('scripts and the library itself are skipped', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('script', {}, 'var x;')), 'skip');
  assert.equal(classify(h('template')), 'skip');
  assert.equal(classify(h('div', { class: 'agent-build-stage agent-build-layer' })), 'skip');
});

test('components with a shadow root are revealed whole', () => {
  assert.equal(defaultClassifier()(h('video-player', { shadow: true })), 'pop');
});

test('custom selectors replace the defaults', () => {
  const classify = defaultClassifier(normalizeOptions({ frames: '.card', atoms: '.title', pop: '.title' }, {}));

  assert.equal(classify(h('div', { class: 'card' })), 'frame');
  assert.equal(classify(h('div', { class: 'title' }, 'Hi')), 'pop');
  assert.equal(classify(h('section')), null);
});

// MARK: - Selection

test('layers come in document order', () => {
  const page = h('body', {},
    h('header', {}, h('a', {}, 'Brand')),
    h('section', {}, h('h1', {}, 'Title'), h('p', {}, 'Lead')),
    h('footer', {}, h('p', {}, '© 2026')));

  assert.deepEqual(describe(layersOf(page)), [
    'frame:header', 'type:a', 'frame:section', 'type:h1', 'type:p', 'frame:footer', 'type:p',
  ]);
});

test('each layer knows the frame it sits in', () => {
  const page = h('body', {},
    h('section', {}, h('div', {}, h('article', {}, h('h2', {}, 'Card'))), h('p', {}, 'Lead')),
    h('p', {}, 'Outside'));
  const [section, article, heading, lead, outside] = layersOf(page);

  assert.equal(section.parent, null);
  assert.equal(article.parent, section);
  assert.equal(heading.parent, article);
  assert.equal(lead.parent, section);
  assert.equal(outside.parent, null);
});

test('an atom keeps everything inside it, so nested matches are dropped', () => {
  const page = h('body', {},
    h('p', {}, 'Read ', h('a', {}, 'the docs'), ' or ', h('img')),
    h('ul', {}, h('li', {}, h('a', {}, h('svg', { ns: SVG })))),
    h('figure', {}, h('img'), h('figcaption', {}, 'Caption')));

  assert.deepEqual(describe(layersOf(page)), ['type:p', 'pop:li', 'pop:figure']);
});

test('frames are looked inside, including frames in frames', () => {
  const page = h('body', {},
    h('section', {},
      h('div', {},
        h('article', {}, h('h2', {}, 'Card'), h('p', {}, 'Body')))));

  assert.deepEqual(describe(layersOf(page)), ['frame:section', 'frame:article', 'type:h2', 'type:p']);
});

test('what no layer covers is kept to be shown, with its frame', () => {
  const page = h('body', {},
    h('section', {}, h('i', { class: 'icon' }), h('h2', {}, 'Fast'), h('closed-widget')),
    h('div', {}, h('br')),
    h('div', { style: { position: 'fixed' } }, 'Chat'));
  const selection = select(page);

  assert.deepEqual(describe(selection.layers), ['frame:section', 'type:h2']);
  assert.deepEqual(restOf(selection), ['i', 'closed-widget', 'br', 'div']);
  assert.equal(selection.rest[0].parent, selection.layers[0]);
  assert.equal(selection.rest[2].parent, null);
});

test('a block under 2 px is no layer, but what it holds can be', () => {
  const page = h('body', {},
    h('p', { box: { x: 0, y: 0, w: 300, h: 1 } }, h('img')),
    h('section', { box: { x: 0, y: 0, w: 0, h: 0 } }, h('h2', {}, 'Still here')));

  assert.deepEqual(describe(layersOf(page)), ['pop:img', 'type:h2']);
});

test('after the limit the walk stops and keeps the rest to be shown', () => {
  const page = h('body', {},
    h('section', {}, h('h2', {}, 'One'), h('p', {}, 'Two'), h('p', {}, 'Three')),
    h('footer', {}, h('p', {}, 'Four')));
  const selection = select(page, { limit: 3 });

  assert.deepEqual(describe(selection.layers), ['frame:section', 'type:h2', 'type:p']);
  assert.deepEqual(restOf(selection), ['p', 'footer']);
  assert.equal(selection.rest[0].parent, selection.layers[0]);
  assert.equal(selection.rest[1].parent, null);
});

test('skipped elements are not looked inside', () => {
  const page = h('body', {},
    h('noscript', {}, h('p', {}, 'Enable JavaScript')),
    h('div', { class: 'agent-build-hud agent-build-layer' }, h('button', {}, 'Pause')),
    h('p', {}, 'Real'));

  assert.deepEqual(describe(layersOf(page)), ['type:p']);
});

test('each layer carries its index and box in page coordinates', () => {
  const page = h('body', {},
    h('h1', { box: { x: 24, y: 80, w: 640, h: 72 } }, 'Title'),
    h('p', { box: { x: 24, y: 170, w: 520, h: 48 } }, 'Lead'));

  assert.deepEqual(layersOf(page).map(({ index, x, y, w, h: height }) => [index, x, y, w, height]), [
    [0, 24, 80, 640, 72],
    [1, 24, 170, 520, 48],
  ]);
});

test('a generic page built from divs still gets every part', () => {
  const page = h('body', {},
    h('div', { class: 'app' },
      h('div', { class: 'nav', style: PAINTED },
        h('div', { class: 'logo' }, 'Acme'),
        h('div', { class: 'links' }, h('span', {}, 'Pricing'), h('span', {}, 'Blog'))),
      h('div', { class: 'hero' },
        h('div', { class: 'title' }, 'Ship faster'),
        h('div', { class: 'card', style: PAINTED }, h('div', {}, 'Fast'), h('small', {}, 'Really')))));

  assert.deepEqual(describe(layersOf(page)), [
    'frame:div', 'type:div', 'type:span', 'type:span', 'type:div', 'frame:div', 'type:div', 'type:small',
  ]);
});

test('selectLayers works with any classifier', () => {
  const tree = { children: [{ name: 'a', children: [{ name: 'b', children: [] }] }, { name: 'c', children: [] }] };
  const { layers } = selectLayers(tree, {
    childrenOf: (node) => node.children,
    classify: (node) => ({ a: 'frame', b: 'type', c: 'pop' })[node.name],
    measure: () => ({ x: 0, y: 0, w: 10, h: 10 }),
  });

  assert.deepEqual(layers.map((layer) => `${layer.kind}:${layer.element.name}`), ['frame:a', 'type:b', 'pop:c']);
});

// MARK: - Labels and guides

test('the box label names what is being built', () => {
  assert.equal(labelOf(h('section'), 'frame'), 'frame');
  assert.equal(labelOf(h('h1', {}, 'Title'), 'type'), 'h1');
  assert.equal(labelOf(h('a', {}, 'Docs'), 'type'), 'link');
  assert.equal(labelOf(h('a', { class: 'btn' }, 'Buy'), 'pop'), 'button');
  assert.equal(labelOf(h('div', { attrs: { role: 'button' } }, 'Go'), 'pop'), 'button');
  assert.equal(labelOf(h('button', {}, h('svg', { ns: SVG })), 'pop'), 'button');
  assert.equal(labelOf(h('img'), 'pop'), 'img');
  assert.equal(labelOf(h('picture', {}, h('img')), 'pop'), 'img');
  assert.equal(labelOf(h('figure', {}, h('video'), h('figcaption', {}, 'Clip')), 'pop'), 'video');
  assert.equal(labelOf(h('a', {}, h('img')), 'pop'), 'img');
  assert.equal(labelOf(h('p', {}, h('iframe')), 'pop'), 'iframe');
  assert.equal(labelOf(h('math', { ns: MATHML }), 'pop'), 'math');
  assert.equal(labelOf(h('span', {}, 'Text'), 'type'), 'text');
  assert.equal(labelOf(h('video-player', { shadow: true }), 'pop'), 'block');
});

test('media labels get the grey placeholder, other labels do not', () => {
  for (const tag of ['img', 'svg', 'video', 'iframe', 'audio', 'math']) {
    assert.ok(MEDIA_LABELS.has(tag), tag);
  }
  for (const tag of ['picture', 'p', 'button', 'frame']) {
    assert.ok(!MEDIA_LABELS.has(tag), tag);
  }
});

test('column guides follow the edges that repeat', () => {
  const layers = [
    ...Array.from({ length: 4 }, () => ({ x: 40, w: 300 })),
    ...Array.from({ length: 4 }, () => ({ x: 41, w: 600 })),
    { x: 700, w: 10 },
  ];

  assert.deepEqual(columnEdges(layers), [40, 340, 642]);
  assert.deepEqual(columnEdges([{ x: 0, w: 10 }]), []);
});

test('at most four column guides, at least 24 px apart', () => {
  const layers = [0, 10, 100, 200, 300, 400].flatMap((x) => Array.from({ length: 4 }, () => ({ x, w: 1000 })));
  const edges = columnEdges(layers);

  assert.equal(edges.length, 4);
  for (const [index, edge] of edges.entries()) {
    for (const other of edges.slice(index + 1)) {
      assert.ok(Math.abs(edge - other) > 24, `${edge} and ${other}`);
    }
  }
});

// MARK: - Painting

test('transparent colours are read in every computed syntax', () => {
  for (const color of ['', 'transparent', 'rgba(0, 0, 0, 0)', 'rgba(255,255,255,0)', 'hsla(0, 0%, 0%, 0)',
    'rgb(0 0 0 / 0)', 'color(srgb 1 0 0 / 0)', 'oklch(0.5 0.1 200 / 0%)', undefined]) {
    assert.equal(isTransparent(color), true, String(color));
  }
  for (const color of ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0.5)', 'color(srgb 1 0 0)', 'oklch(0.5 0.1 200)', '#000']) {
    assert.equal(isTransparent(color), false, color);
  }
});

test('a box paints with a background, a shadow or a border all round', () => {
  const none = { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', boxShadow: 'none' };
  const border = (style, width = '1px') => Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].flatMap((side) => [
    [`border${side}Width`, width], [`border${side}Style`, style], [`border${side}Color`, 'rgb(0, 0, 0)'],
  ]));

  assert.equal(paintsBox(none), false);
  assert.equal(paintsBox(null), false);
  assert.equal(paintsBox({ ...none, backgroundColor: 'rgb(20, 20, 26)' }), true);
  assert.equal(paintsBox({ ...none, backgroundImage: 'linear-gradient(red, blue)' }), true);
  assert.equal(paintsBox({ ...none, boxShadow: 'rgba(0, 0, 0, 0.2) 0px 1px 2px 0px' }), true);
  assert.equal(paintsBox({ ...none, ...border('solid') }), true);
  assert.equal(paintsBox({ ...none, ...border('none') }), false);
  assert.equal(paintsBox({ ...none, ...border('solid', '0px') }), false);
  assert.equal(paintsBox({ ...none, ...border('solid'), borderTopWidth: '0px' }), false);
});

test('only non-blank text of its own counts as own text', () => {
  assert.equal(hasOwnText(h('div', {}, 'Hi')), true);
  assert.equal(hasOwnText(h('div', {}, ' \n\t ')), false);
  assert.equal(hasOwnText(h('div', {}, h('p', {}, 'Nested'))), false);
});
