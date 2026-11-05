/* Reading the README from tests without depending on what surrounds a
   section: a heading that goes missing or moves fails loudly instead of
   leaving an empty or oversized slice. */
import assert from 'node:assert/strict';

/* The text under `heading` (for example '### Languages') up to the next
   heading of the same or a higher level. */
export function section(markdown, heading) {
  const level = heading.match(/^#+/)[0].length;
  const lines = markdown.split('\n');
  const starts = lines.flatMap((line, index) => (line === heading ? [index] : []));
  assert.equal(starts.length, 1, `exactly one "${heading}" heading`);
  const end = lines.findIndex((line, index) => index > starts[0] && /^#+ /.test(line)
    && line.match(/^#+/)[0].length <= level);
  return lines.slice(starts[0] + 1, end === -1 ? undefined : end).join('\n');
}

export function codeBlocks(markdown) {
  return [...markdown.matchAll(/^```([\w-]*)\n([\s\S]*?)^```$/gm)].map(([, language, code]) => ({ language, code }));
}
