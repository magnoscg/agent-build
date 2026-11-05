import test from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../../src/index.ts';
import { AGENTS, DEFAULTS, LIMITS, datasetOptions, mergeOptions, normalizeOptions } from '../../src/options.ts';
import { VERSION } from '../../src/version.ts';

function strictEnv() {
  const warnings = [];
  return {
    warnings,
    env: {
      isSelector: (selector) => !selector.includes('!!'),
      isColor: (value) => /^(#[0-9a-f]{3,8}|rgb\(.+\)|rebeccapurple)$/i.test(value),
      warn: (message) => warnings.push(message),
    },
  };
}

test('no options give the defaults', () => {
  assert.deepEqual(normalizeOptions({}, {}), {
    frames: DEFAULTS.frames,
    atoms: DEFAULTS.atoms,
    pop: DEFAULTS.pop,
    hub: '',
    pace: 1,
    count: AGENTS.wide,
    accent: '',
  });
  assert.deepEqual(normalizeOptions(undefined, undefined), normalizeOptions({}, {}));
});

test('the defaults name generic boxes and blocks, nothing from one site', () => {
  assert.equal(DEFAULTS.frames, 'header, footer, section, article, aside');
  for (const tag of ['h1', 'h2', 'h3', 'p', 'li', 'img', 'figure', 'a', 'button']) {
    assert.ok(DEFAULTS.atoms.split(', ').includes(tag), `${tag} is an atom`);
  }
  assert.doesNotMatch(`${DEFAULTS.frames} ${DEFAULTS.atoms} ${DEFAULTS.pop}`, /reveal|work-|xp-|hero/);
  assert.equal(DEFAULTS.hub, '');
});

test('narrow screens get fewer agents unless a count is given', () => {
  assert.equal(normalizeOptions({}, { narrow: true }).count, AGENTS.narrow);
  assert.equal(normalizeOptions({ count: '9' }, { narrow: true }).count, 9);
});

test('custom selectors are kept and broken ones fall back with a warning', () => {
  const { env, warnings } = strictEnv();
  const config = normalizeOptions({ frames: '.card, .panel', atoms: 'h2!!', pop: '   ' }, env);

  assert.equal(config.frames, '.card, .panel');
  assert.equal(config.atoms, DEFAULTS.atoms);
  assert.equal(config.pop, DEFAULTS.pop);
  assert.deepEqual(warnings, ['ignoring the invalid atoms selector "h2!!"']);
});

test('pace is clamped and anything else falls back to 1', () => {
  const { env, warnings } = strictEnv();
  const pace = (value) => normalizeOptions({ pace: value }, env).pace;

  assert.equal(pace('2'), 2);
  assert.equal(pace(0.5), 0.5);
  assert.equal(pace('0.01'), LIMITS.pace[0]);
  assert.equal(pace('99'), LIMITS.pace[1]);
  assert.equal(pace('fast'), 1);
  assert.equal(pace('0'), 1);
  assert.equal(pace('-2'), 1);
  assert.equal(pace(''), 1);
  assert.equal(pace(undefined), 1);
  assert.equal(warnings.length, 3);
});

test('count is rounded and clamped', () => {
  const { env, warnings } = strictEnv();
  const count = (value) => normalizeOptions({ count: value }, env).count;

  assert.equal(count('8'), 8);
  assert.equal(count('3.6'), 4);
  assert.equal(count(1), 1);
  assert.equal(count('500'), LIMITS.count[1]);
  assert.equal(count('0'), AGENTS.wide);
  assert.equal(count('lots'), AGENTS.wide);
  assert.equal(warnings.length, 2);
});

test('the accent must be a colour', () => {
  const { env, warnings } = strictEnv();

  assert.equal(normalizeOptions({ accent: ' #FF5A5F ' }, env).accent, '#FF5A5F');
  assert.equal(normalizeOptions({ accent: 'rebeccapurple' }, env).accent, 'rebeccapurple');
  assert.equal(normalizeOptions({ accent: 'red; background: url(x)' }, env).accent, '');
  assert.equal(normalizeOptions({ accent: '' }, env).accent, '');
  assert.equal(warnings.length, 1);
});

test('without a colour check every accent is refused', () => {
  assert.equal(normalizeOptions({ accent: '#FF5A5F' }, {}).accent, '');
});

test('the hub is trimmed and optional', () => {
  assert.equal(normalizeOptions({ hub: ' /icon.svg ' }, {}).hub, '/icon.svg');
  assert.equal(normalizeOptions({ hub: 42 }, {}).hub, '');
});

test('data attributes are read from the dataset', () => {
  const button = {
    dataset: {
      agentFrames: '.card', agentAtoms: 'h2', agentPop: 'img', agentHub: '/logo.svg',
      agentPace: '2', agentCount: '6', agentAccent: '#0A84FF', unrelated: 'x',
    },
  };

  assert.deepEqual(datasetOptions(button), {
    frames: '.card', atoms: 'h2', pop: 'img', hub: '/logo.svg', pace: '2', count: '6', accent: '#0A84FF',
  });
  assert.deepEqual(Object.values(datasetOptions(null)).filter((value) => value !== undefined), []);
});

test('options passed to start() win over data attributes', () => {
  const merged = mergeOptions(
    { pace: '2', count: '6', accent: '#0A84FF' },
    { pace: 0.5, count: undefined, accent: null, trigger: {}, unknown: true },
  );

  assert.deepEqual(merged, { pace: 0.5, count: '6', accent: '#0A84FF' });
  assert.deepEqual(mergeOptions({ pace: '2' }, 'not an object'), { pace: '2' });
});

test('outside a browser the API exists and refuses to run', () => {
  assert.equal(library.version, VERSION);
  assert.equal(library.start(), false);
  assert.equal(library.stop(), false);
  assert.equal(library.isRunning(), false);
});
