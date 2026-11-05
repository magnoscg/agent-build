import test from 'node:test';
import assert from 'node:assert/strict';
import { internals, h, SVG, PAINTED, defaultClassifier, layersOf } from './helpers.mjs';

const {
  selectLayers, planLayers, columnEdges, tagOf, isTransparent, paintsBox, hasOwnText, isMediaOnly, normalizeOptions,
} = internals;

const describe = (layers) => layers.map((layer) => `${layer.kind}:${layer.element.localName}`);

// MARK: - Classifier

test('the default classifier knows boxes, media and text', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('section')), 'frame');
  assert.equal(classify(h('footer')), 'frame');
  assert.equal(classify(h('p', {}, 'Hello')), 'type');
  assert.equal(classify(h('h1', {}, 'Title')), 'type');
  assert.equal(classify(h('img')), 'pop');
  assert.equal(classify(h('video')), 'pop');
  assert.equal(classify(h('button', {}, 'Go')), 'pop');
  assert.equal(classify(h('button', { attrs: { 'data-agent-build': '' } })), 'pop');
  assert.equal(classify(h('a', {}, 'Docs')), 'type');
  assert.equal(classify(h('a', { class: 'btn' }, 'Buy')), 'pop');
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
  assert.equal(classify(h('a', {}, h('svg', { ns: SVG }))), 'pop');
  assert.equal(classify(h('li', {}, h('img'))), 'pop');
  assert.equal(classify(h('p', {}, h('img'), 'Caption')), 'type');
});

test('only blocks without text and with media count as media', () => {
  assert.equal(isMediaOnly(h('a', {}, h('img'))), true);
  assert.equal(isMediaOnly(h('div', {}, h('span', {}, h('video')))), true);
  assert.equal(isMediaOnly(h('a', {}, h('img'), h('span', {}, 'Download'))), false);
  assert.equal(isMediaOnly(h('a', {}, '')), false);
  assert.equal(isMediaOnly(h('img')), false);
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

test('scripts, the library itself and SVG internals are skipped', () => {
  const classify = defaultClassifier();

  assert.equal(classify(h('script', {}, 'var x;')), 'skip');
  assert.equal(classify(h('template')), 'skip');
  assert.equal(classify(h('div', { class: 'agent-build-stage agent-build-layer' })), 'skip');
  assert.equal(classify(h('path', { ns: SVG })), 'skip');
  assert.equal(classify(h('svg', { ns: SVG })), 'pop');
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

// MARK: - Selection and deduplication

test('layers come in document order', () => {
  const page = h('body', {},
    h('header', {}, h('a', {}, 'Brand')),
    h('section', {}, h('h1', {}, 'Title'), h('p', {}, 'Lead')),
    h('footer', {}, h('p', {}, '© 2026')));

  assert.deepEqual(describe(layersOf(page)), [
    'frame:header', 'type:a', 'frame:section', 'type:h1', 'type:p', 'frame:footer', 'type:p',
  ]);
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

test('a block under 2 px is no layer, but what it holds can be', () => {
  const page = h('body', {},
    h('p', { box: { x: 0, y: 0, w: 300, h: 1 } }, h('img')),
    h('section', { box: { x: 0, y: 0, w: 0, h: 0 } }, h('h2', {}, 'Still here')));

  assert.deepEqual(describe(layersOf(page)), ['pop:img', 'type:h2']);
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
  const layers = layersOf(page);

  assert.deepEqual(layers.map(({ index, x, y, w, h: height }) => [index, x, y, w, height]), [
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
  const layers = selectLayers(tree, {
    childrenOf: (node) => node.children,
    classify: (node) => ({ a: 'frame', b: 'type', c: 'pop' })[node.name],
    measure: () => ({ x: 0, y: 0, w: 10, h: 10 }),
  });

  assert.deepEqual(layers.map((layer) => `${layer.kind}:${layer.element.name}`), ['frame:a', 'type:b', 'pop:c']);
});

// MARK: - Planning

test('long pages build the first layers and show the rest from the start', () => {
  const layers = Array.from({ length: 5 }, (_, index) => ({ index }));
  const plan = planLayers(layers, 3);

  assert.deepEqual(plan.build.map((layer) => layer.index), [0, 1, 2]);
  assert.deepEqual(plan.shown.map((layer) => layer.index), [3, 4]);
  assert.deepEqual(planLayers(layers, 10).shown, []);
  assert.equal(internals.LIMITS.layers, 160);
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

test('the box label names what is being built', () => {
  assert.equal(tagOf('section', 'frame', false, false), 'frame');
  assert.equal(tagOf('h1', 'type', false, false), 'h1');
  assert.equal(tagOf('h2', 'type', false, false), 'h2');
  assert.equal(tagOf('a', 'type', false, false), 'link');
  assert.equal(tagOf('a', 'pop', true, false), 'button');
  assert.equal(tagOf('div', 'pop', true, false), 'button');
  assert.equal(tagOf('button', 'pop', false, true), 'button');
  assert.equal(tagOf('img', 'pop', false, false), 'img');
  assert.equal(tagOf('figure', 'pop', false, false), 'img');
  assert.equal(tagOf('picture', 'pop', false, false), 'img');
  assert.equal(tagOf('a', 'pop', false, true), 'img');
  assert.equal(tagOf('li', 'pop', false, true), 'img');
  assert.equal(tagOf('span', 'type', false, false), 'text');
  assert.equal(tagOf('video-player', 'pop', false, false), 'block');
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

test('only non-blank text of its own counts as text', () => {
  assert.equal(hasOwnText(h('div', {}, 'Hi')), true);
  assert.equal(hasOwnText(h('div', {}, ' \n\t ')), false);
  assert.equal(hasOwnText(h('div', {}, h('p', {}, 'Nested'))), false);
});
