/* Release helpers. `pnpm release:prepare X.Y.Z` writes the version wherever
   it appears, dates the changelog, builds and refreshes the integrity hashes.
   The release workflow reads the notes with `node scripts/release.mjs notes
   X.Y.Z`. */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url);
const SEMVER = /^\d+\.\d+\.\d+$/;
const UNRELEASED = '## Unreleased';

/* Where the version is written, as patterns whose second group is it. */
export const PLACES = {
  'package.json': [/("version": ")([^"]+)(")/],
  'src/version.ts': [/(VERSION = ')([^']+)(')/],
  'README.md': [/(@magnoscg\/agent-build@)([\w.-]+)(\/)/g, /(AgentBuild\.version\s+\/\/ ")([^"]+)(")/],
  'index.html': [/(@magnoscg\/agent-build@)([\w.-]+)(\/)/g],
};

export function setVersion(text, patterns, version) {
  return patterns.reduce((result, pattern) => result.replace(pattern, `$1${version}$3`), text);
}

/* The notes under "## <version>" or "## <version> - <date>", or null. */
export function notesFor(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} - `));
  if (start === -1) {
    return null;
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

/* Gives the unreleased notes a dated heading of their own and leaves an
   empty "## Unreleased" above them. */
export function cutRelease(changelog, version, date) {
  if (!changelog.includes(`${UNRELEASED}\n`)) {
    throw new Error(`CHANGELOG.md has no "${UNRELEASED}" section`);
  }
  if (notesFor(changelog, version) !== null) {
    throw new Error(`CHANGELOG.md already has ${version}`);
  }
  if (!notesFor(changelog, 'Unreleased')) {
    throw new Error(`CHANGELOG.md has nothing under "${UNRELEASED}"`);
  }
  return changelog.replace(`${UNRELEASED}\n`, `${UNRELEASED}\n\n## ${version} - ${date}\n`);
}

const read = (file) => readFile(new URL(file, root), 'utf8');
const write = (file, text) => writeFile(new URL(file, root), text);

async function prepare(version) {
  for (const [file, patterns] of Object.entries(PLACES)) {
    await write(file, setVersion(await read(file), patterns, version));
  }
  await write('CHANGELOG.md', cutRelease(await read('CHANGELOG.md'), version, new Date().toISOString().slice(0, 10)));
  for (const script of ['scripts/build.mjs', 'scripts/sri.mjs']) {
    execFileSync(process.execPath, [script], { cwd: fileURLToPath(root), stdio: 'inherit' });
  }
  console.log(`Prepared ${version}: review the diff, commit it as "chore(release): ${version}" and follow CONTRIBUTING.md.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, version] = process.argv.slice(2);
  if (!['prepare', 'notes'].includes(command) || !SEMVER.test(version ?? '')) {
    console.error('Usage: node scripts/release.mjs prepare|notes X.Y.Z');
    process.exit(1);
  }
  if (command === 'prepare') {
    await prepare(version);
  } else {
    const notes = notesFor(await read('CHANGELOG.md'), version);
    if (!notes) {
      console.error(`CHANGELOG.md has no notes for ${version}`);
      process.exit(1);
    }
    process.stdout.write(`${notes}\n`);
  }
}
