/* The promises the README makes, checked on the files that ship. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { internals } from './helpers.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [script, styles, demo, readme, pkg] = await Promise.all([
  read('dist/agent-build.js'),
  read('dist/agent-build.css'),
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
  assert.match(script, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(script, /typeof Element\.prototype\.animate === 'function'/);
});

test('the script never runs without the stylesheet', () => {
  assert.match(styles, /:root \{ --agent-build-css: 1; \}/);
  assert.match(script, /getPropertyValue\('--agent-build-css'\)/);
});

// MARK: - CSP

test('the script builds nodes without HTML strings, eval or style attributes', () => {
  for (const pattern of [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /\beval\(/, /new Function\(/, /setAttribute\(\s*['"]style['"]/, /\.cssText\b/]) {
    assert.doesNotMatch(script, pattern);
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

// MARK: - The demo

test('the demo ships its trigger hidden and loads the script deferred', () => {
  const triggers = demo.match(/<button\b[^>]*\bdata-agent-build\b[^>]*>/g) ?? [];
  assert.equal(triggers.length, 1);
  assert.match(triggers[0], /\shidden>/);
  assert.match(demo, /<link rel="stylesheet" href="dist\/agent-build\.css">/);
  assert.match(demo, /<script src="dist\/agent-build\.js" defer><\/script>/);
});

// MARK: - Releases

test('one version everywhere', () => {
  assert.equal(internals.VERSION, pkg.version);
  assert.ok(script.startsWith(`/*! agent-build ${pkg.version} | MIT License |`));
  assert.ok(styles.startsWith(`/*! agent-build ${pkg.version} | MIT License |`));
  assert.match(readme, new RegExp(`AgentBuild\\.version\\s+// "${pkg.version.replaceAll('.', '\\.')}"`));
  for (const [name, text] of [['README.md', readme], ['index.html', demo]]) {
    const pinned = [...text.matchAll(/@magnoscg\/agent-build@([\w.-]+)\//g)].map((match) => match[1]);
    assert.ok(pinned.length >= 2, `${name} pins the CDN version`);
    assert.deepEqual([...new Set(pinned)], [pkg.version], name);
  }
});

test('the integrity hashes in the snippets match the files', async () => {
  for (const file of ['agent-build.js', 'agent-build.css']) {
    const body = await readFile(new URL(`../dist/${file}`, import.meta.url));
    const hash = `sha384-${createHash('sha384').update(body).digest('base64')}`;
    const pattern = new RegExp(`dist/${file.replace('.', '\\.')}"[^>\\n]*?integrity="([^"]+)"`);
    for (const [name, text] of [['README.md', readme], ['index.html', demo]]) {
      assert.equal(pattern.exec(text)?.[1], hash, `${file} in ${name}: run pnpm sri`);
    }
  }
});

test('the package publishes dist and nothing else, publicly', () => {
  assert.equal(pkg.name, '@magnoscg/agent-build');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(pkg.files, ['dist']);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.main, 'dist/agent-build.js');
  assert.equal(pkg.exports['.'], './dist/agent-build.js');
  assert.equal(pkg.exports['./agent-build.css'], './dist/agent-build.css');
  assert.equal(pkg.type, undefined, 'dist/agent-build.js has to load with require() and as a classic script');
  assert.equal(pkg.dependencies, undefined, 'no runtime dependencies');
});

test('the workflow pins every action to a full commit SHA', async () => {
  const workflow = await read('.github/workflows/ci.yml');
  const actions = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);
  assert.ok(actions.length > 0);
  for (const action of actions) {
    assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, action);
  }
});

test('the credits are there', () => {
  for (const text of [readme, demo]) {
    assert.match(text, /https:\/\/califa\.github\.io\/swarm-site\//);
    assert.match(text, /@EHuanglu/);
    assert.match(text, /original/);
  }
});
