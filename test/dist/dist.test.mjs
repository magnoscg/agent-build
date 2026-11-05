/* The built files, after `pnpm build`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const BUNDLES = ['dist/agent-build.js', 'dist/agent-build.min.js', 'dist/agent-build.mjs'];
const STYLES = ['dist/agent-build.css', 'dist/agent-build.min.css'];

test('every built file names its version and licence', async () => {
  for (const file of [...BUNDLES, ...STYLES]) {
    assert.ok((await read(file)).startsWith(`/*! agent-build ${pkg.version} | MIT License |`), file);
  }
});

test('the bundles build nodes without HTML strings or eval', async () => {
  for (const file of BUNDLES) {
    const bundle = await read(file);
    for (const pattern of [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\(/]) {
      assert.doesNotMatch(bundle, pattern, file);
    }
  }
});

test('every path the package exports exists', async () => {
  const targets = Object.values(pkg.exports).flatMap((target) => (typeof target === 'string' ? [target] : Object.values(target)));
  for (const target of targets.filter((path) => !path.includes('*'))) {
    await access(new URL(target, root));
  }
});

test('named imports work under Node ESM and refuse to run outside a browser', async () => {
  const library = await import('@magnoscg/agent-build');
  assert.equal(library.version, pkg.version);
  assert.equal(library.start(), false);
  assert.equal(library.stop(), false);
  assert.equal(library.isRunning(), false);
});

test('strict TypeScript consumers type-check against the declarations', async () => {
  const tsc = fileURLToPath(new URL('node_modules/.bin/tsc', root));
  for (const project of ['bundler', 'nodenext']) {
    const config = fileURLToPath(new URL(`test/dist/consumer/tsconfig.${project}.json`, root));
    await promisify(execFile)(tsc, ['-p', config]);
  }
});
