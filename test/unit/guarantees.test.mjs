/* The promises the README makes, checked on the source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { OPTION_KEYS } from '../../src/options.ts';
import { VERSION } from '../../src/version.ts';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

async function sources(directory = 'src') {
  const entries = await readdir(new URL(`../../${directory}/`, import.meta.url), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory()
    ? sources(`${directory}/${entry.name}`)
    : entry.name.endsWith('.ts') ? [`${directory}/${entry.name}`] : [])));
  return nested.flat();
}

const [styles, page, demo, readme, pkg] = await Promise.all([
  read('src/agent-build.css'),
  read('src/page.ts'),
  read('index.html'),
  read('README.md'),
  read('package.json').then(JSON.parse),
]);

// MARK: - The trigger

test('the trigger stays hidden while it carries [hidden]', () => {
  assert.match(styles, /\[data-agent-build\]\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('reduced motion removes the trigger', () => {
  assert.match(styles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-agent-build\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('the script itself refuses reduced motion and missing Web Animations', () => {
  assert.match(page, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(page, /typeof Element\.prototype\.animate === 'function'/);
});

test('the script never runs without the stylesheet', () => {
  assert.match(styles, /:root \{ --agent-build-css: 1; \}/);
  assert.match(page, /getPropertyValue\('--agent-build-css'\)/);
});

test('during a run the page scrolls only where the script sends it', () => {
  const rule = styles.match(/html\[data-agent-build-run\] \{([^}]*)\}/)?.[1] ?? '';
  for (const declaration of ['scroll-behavior: auto', 'scroll-snap-type: none', 'overflow-anchor: none']) {
    assert.ok(rule.includes(`${declaration} !important;`), declaration);
  }
  assert.match(styles, /html\[data-agent-build-run\] > body \{ overflow-anchor: none !important; \}/);
});

// MARK: - CSP

test('the source builds nodes without HTML strings, eval or style attributes', async () => {
  const files = await sources();
  assert.ok(files.length > 10);
  for (const file of files) {
    const source = await read(file);
    for (const pattern of [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
      /\beval\(/, /new Function\(/, /setAttribute\(\s*['"]style['"]/, /\.cssText\b/]) {
      assert.doesNotMatch(source, pattern, file);
    }
  }
});

test('the stylesheet keeps every class it adds in its own namespace', () => {
  const rules = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = new Set([...rules.matchAll(/\.([a-z][\w-]*)/g)].map((match) => match[1]));
  assert.ok(classes.size > 20);
  for (const name of classes) {
    assert.match(name, /^agent-build(-|ing$)/, name);
  }
});

test('the demo runs under a strict CSP with nothing inline', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(demo)?.[1];
  assert.ok(csp, 'the demo declares a CSP');
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|data:/);
  assert.match(csp, /require-trusted-types-for 'script'/);
  assert.doesNotMatch(demo, /<script(?![^>]*\ssrc=)[^>]*>/, 'every script is a file');
  assert.doesNotMatch(demo, /<style\b|\sstyle="|\son[a-z]+="/);
});

// MARK: - The demo and the package

test('the demo ships its trigger hidden and loads the script deferred', () => {
  const triggers = demo.match(/<button\b[^>]*\bdata-agent-build\b[^>]*>/g) ?? [];
  assert.equal(triggers.length, 1);
  assert.match(triggers[0], /\shidden>/);
  assert.match(demo, /<link rel="stylesheet" href="dist\/agent-build\.css">/);
  assert.match(demo, /<script src="dist\/agent-build\.js" defer><\/script>/);
});

test('the source and the package agree on the version', () => {
  assert.equal(VERSION, pkg.version);
});

test('the package publishes the built files and nothing else, publicly', () => {
  assert.equal(pkg.name, '@magnoscg/agent-build');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.files, ['dist']);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.deepEqual(pkg.exports['.'], { types: './dist/types/index.d.ts', default: './dist/agent-build.mjs' });
  assert.deepEqual(pkg.exports['./auto'], { types: './dist/types/auto.d.ts', default: './dist/auto.mjs' });
  assert.ok(pkg.sideEffects.includes('./dist/auto.mjs'), 'bundlers keep the auto entry');
  assert.equal(pkg.exports['./agent-build.css'], './dist/agent-build.css');
  assert.equal(pkg.dependencies, undefined, 'no runtime dependencies');
  for (const version of Object.values(pkg.devDependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, 'development dependencies are pinned');
  }
});

test('every workflow pins its actions to a full commit SHA', async () => {
  const directory = new URL('../../.github/workflows/', import.meta.url);
  const workflows = (await readdir(directory)).filter((name) => name.endsWith('.yml'));
  assert.ok(workflows.length > 0);
  for (const name of workflows) {
    const workflow = await readFile(new URL(name, directory), 'utf8');
    for (const [, action] of workflow.matchAll(/uses:\s*(\S+)/g)) {
      assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${name}: ${action}`);
    }
  }
});

test('the README documents every option and no other', () => {
  const documented = [...readme.matchAll(/^\| `data-agent-([a-z]+)` \| `([a-z]+)` \|/gm)]
    .map(([, attribute, option]) => {
      assert.equal(attribute, option, `data-agent-${attribute} pairs with ${option}`);
      return option;
    });
  assert.deepEqual(documented.sort(), [...OPTION_KEYS].sort());
});

test('the credits are there', () => {
  for (const text of [readme, demo]) {
    assert.match(text, /https:\/\/califa\.github\.io\/swarm-site\//);
    assert.match(text, /@EHuanglu/);
    assert.match(text, /original/);
  }
});
