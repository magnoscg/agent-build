/* Subresource Integrity for the CDN snippets in README.md and the demo.
   `pnpm sri` rewrites their hashes from dist/; the release tests import the
   same helpers to check them. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SNIPPET_FILES = ['agent-build.js', 'agent-build.css'];
export const DOCUMENTS = ['README.md', 'index.html'];

const root = new URL('..', import.meta.url);

export async function integrity(file) {
  const body = await readFile(new URL(`dist/${file}`, root));
  return `sha384-${createHash('sha384').update(body).digest('base64')}`;
}

export function snippetPattern(file) {
  return new RegExp(`(dist/${RegExp.escape(file)}"[^>\\n]*?integrity=")([^"]+)(")`, 'g');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const document of DOCUMENTS) {
    const url = new URL(document, root);
    let text = await readFile(url, 'utf8');
    for (const file of SNIPPET_FILES) {
      const hash = await integrity(file);
      text = text.replace(snippetPattern(file), `$1${hash}$3`);
      console.log(`${document} ${file} ${hash}`);
    }
    await writeFile(url, text);
  }
}
