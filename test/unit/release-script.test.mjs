import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cutRelease, notesFor, PLACES, setVersion } from '../../scripts/release.mjs';
import { DOCUMENTS } from '../../scripts/sri.mjs';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const CHANGELOG = `# Changelog

## Unreleased

### Fixed

- A fix.

## 1.0.0 - 2026-11-05

### Added

- Everything.
`;

test('the version is written everywhere the release checks look for it', async () => {
  for (const document of DOCUMENTS) {
    assert.ok(Object.hasOwn(PLACES, document), `${document} gets the version`);
  }
  for (const [file, patterns] of Object.entries(PLACES)) {
    const text = setVersion(await read(file), patterns, '9.8.7');
    for (const pattern of patterns) {
      const found = [...text.matchAll(new RegExp(pattern.source, 'g'))].map((match) => match[2]);
      assert.ok(found.length > 0, `${file}: ${pattern}`);
      assert.deepEqual([...new Set(found)], ['9.8.7'], `${file}: ${pattern}`);
    }
  }
});

test('the notes of a version are what sits under its heading', () => {
  assert.equal(notesFor(CHANGELOG, '1.0.0'), '### Added\n\n- Everything.');
  assert.equal(notesFor(CHANGELOG, 'Unreleased'), '### Fixed\n\n- A fix.');
  assert.equal(notesFor(CHANGELOG, '2.0.0'), null);
});

test('cutting a release dates the unreleased notes and leaves room for the next', () => {
  const cut = cutRelease(CHANGELOG, '1.0.1', '2026-12-01');

  assert.equal(notesFor(cut, '1.0.1'), '### Fixed\n\n- A fix.');
  assert.equal(notesFor(cut, 'Unreleased'), '');
  assert.equal(notesFor(cut, '1.0.0'), '### Added\n\n- Everything.');
  assert.match(cut, /## Unreleased\n\n## 1\.0\.1 - 2026-12-01\n\n### Fixed/);
});

test('cutting a release refuses a changelog it cannot cut', () => {
  assert.throws(() => cutRelease('# Changelog\n', '1.0.1', '2026-12-01'), /no "## Unreleased" section/);
  assert.throws(() => cutRelease(CHANGELOG, '1.0.0', '2026-12-01'), /already has 1\.0\.0/);
  assert.throws(() => cutRelease(cutRelease(CHANGELOG, '1.0.1', '2026-12-01'), '1.0.2', '2026-12-02'),
    /nothing under "## Unreleased"/);
});

test('the changelog has notes waiting for the next release, or for this version', async () => {
  const [changelog, pkg] = await Promise.all([read('CHANGELOG.md'), read('package.json').then(JSON.parse)]);
  assert.ok(notesFor(changelog, 'Unreleased') || notesFor(changelog, pkg.version));
});
