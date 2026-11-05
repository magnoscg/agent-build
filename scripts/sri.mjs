/* Rewrites the Subresource Integrity hashes in README.md and in the demo's
   install snippet from the files in dist/. Run it after any change to dist/
   (`pnpm sri`); the tests fail while the snippets and the files disagree. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url);
const hashes = {};
for (const file of ['agent-build.js', 'agent-build.css']) {
  const body = await readFile(new URL(`dist/${file}`, root));
  hashes[file] = `sha384-${createHash('sha384').update(body).digest('base64')}`;
  console.log(`${file} ${hashes[file]}`);
}

for (const document of ['README.md', 'index.html']) {
  const url = new URL(document, root);
  let text = await readFile(url, 'utf8');
  for (const [file, hash] of Object.entries(hashes)) {
    const pattern = new RegExp(`(dist/${file.replace('.', '\\.')}"[^>\\n]*?integrity=")[^"]+(")`, 'g');
    text = text.replace(pattern, `$1${hash}$2`);
  }
  await writeFile(url, text);
}
