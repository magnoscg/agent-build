/* The README's examples use only what the package really offers: the names
   it exports, the entries it maps and the members of window.AgentBuild. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as api from '../../src/index.ts';
import { OPTION_KEYS } from '../../src/options.ts';
import { codeBlocks } from '../markdown.mjs';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [readme, llms, index, auto, pkg] = await Promise.all([
  read('README.md'),
  read('llms.txt'),
  read('src/index.ts'),
  read('src/auto.ts'),
  read('package.json').then(JSON.parse),
]);

const PACKAGE = '@magnoscg/agent-build';
const code = codeBlocks(readme).map((block) => block.code).join('\n');
const values = new Set(Object.keys(api));
const types = new Set([...index.matchAll(/export type \{([^}]+)\}|export interface (\w+)/g)]
  .flatMap(([, list, name]) => (list ? list.split(',').map((part) => part.trim()) : [name])));
const globals = new Set(auto.match(/Object\.freeze\(\{([^}]+)\}\)/)[1].split(',').map((part) => part.trim()));

test('the examples import only names the package exports', () => {
  const imports = [...code.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+'([^']+)'/g)]
    .filter(([, , , specifier]) => specifier.startsWith(PACKAGE));
  assert.ok(imports.length >= 4, 'the README shows named imports');
  for (const [, typeOnly, list, specifier] of imports) {
    assert.equal(specifier, PACKAGE, 'named imports come from the main entry');
    for (const entry of list.split(',').map((part) => part.trim()).filter(Boolean)) {
      const [name] = entry.replace(/^type\s+/, '').split(/\s+as\s+/);
      const known = typeOnly || entry.startsWith('type ') ? types.has(name) : values.has(name);
      assert.ok(known, `${name} is exported`);
    }
  }
});

test('the examples use only entries the package maps', () => {
  const specifiers = [...code.matchAll(/'(@magnoscg\/agent-build(?:\/[^']*)?)'/g)].map(([, specifier]) => specifier);
  assert.ok(specifiers.length > 0);
  for (const specifier of specifiers) {
    const entry = `.${specifier.slice(PACKAGE.length)}` || '.';
    const mapped = entry === '.' || Object.hasOwn(pkg.exports, entry) || entry.startsWith('./dist/');
    assert.ok(mapped, `${specifier} is in package.json exports`);
  }
});

test('the README calls only members window.AgentBuild has', () => {
  const members = new Set([...readme.matchAll(/\bAgentBuild\.(\w+)/g)].map(([, member]) => member));
  assert.ok(members.size >= 5);
  for (const member of members) {
    assert.ok(globals.has(member), `AgentBuild.${member}`);
  }
});

test('llms.txt names every option and every member of window.AgentBuild', () => {
  for (const name of [...globals, ...OPTION_KEYS]) {
    assert.match(llms, new RegExp(`\\b${name}\\b`), name);
  }
});
