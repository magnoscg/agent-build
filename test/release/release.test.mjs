/* What a release has to get right: the CDN snippets name this version and
   their integrity hashes match the built files. CI runs these on release/*
   branches and tags; between releases the README describes the last
   published version. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DOCUMENTS, integrity, SNIPPET_FILES, snippetPattern } from '../../scripts/sri.mjs';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(await read('package.json'));

test('the snippets pin this version', async () => {
  const readme = await read('README.md');
  assert.match(readme, new RegExp(`AgentBuild\\.version\\s+// "${RegExp.escape(pkg.version)}"`));
  for (const document of DOCUMENTS) {
    const text = await read(document);
    const pinned = [...text.matchAll(/@magnoscg\/agent-build@([\w.-]+)\//g)].map((match) => match[1]);
    assert.ok(pinned.length >= 2, `${document} pins the CDN version`);
    assert.deepEqual([...new Set(pinned)], [pkg.version], document);
  }
});

test('every integrity hash matches the built file', async () => {
  for (const document of DOCUMENTS) {
    const text = await read(document);
    for (const file of SNIPPET_FILES) {
      const hashes = [...text.matchAll(snippetPattern(file))].map((match) => match[2]);
      assert.ok(hashes.length > 0, `${document} has a snippet for ${file}`);
      for (const hash of hashes) {
        assert.equal(hash, await integrity(file), `${file} in ${document}: run pnpm sri`);
      }
    }
  }
});
