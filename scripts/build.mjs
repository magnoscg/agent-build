/* Builds dist/ from src/: the classic script for <script defer> (plain and
   minified), the ES modules, the stylesheet (plain and minified) and the
   type declarations. */
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const banner = `/*! agent-build ${pkg.version} | MIT License | https://github.com/magnoscg/agent-build */`;
const common = {
  absWorkingDir: root,
  bundle: true,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
  target: 'es2022',
};

/* dist/auto.mjs imports dist/agent-build.mjs instead of bundling a copy, so a
   page that uses both gets one run state, not two. */
const sharedInstance = {
  name: 'shared-instance',
  setup(builder) {
    builder.onResolve({ filter: /^\.\/index\.ts$/ }, () => ({ path: './agent-build.mjs', external: true }));
  },
};

await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await Promise.all([
  build({ ...common, entryPoints: ['src/auto.ts'], format: 'iife', banner: { js: banner }, outfile: 'dist/agent-build.js' }),
  build({ ...common, entryPoints: ['src/auto.ts'], format: 'iife', banner: { js: banner }, minify: true, outfile: 'dist/agent-build.min.js' }),
  build({ ...common, entryPoints: ['src/index.ts'], format: 'esm', banner: { js: banner }, outfile: 'dist/agent-build.mjs' }),
  build({ ...common, entryPoints: ['src/auto.ts'], format: 'esm', banner: { js: banner }, plugins: [sharedInstance], outfile: 'dist/auto.mjs' }),
  build({ ...common, entryPoints: ['src/agent-build.css'], banner: { css: banner }, outfile: 'dist/agent-build.css' }),
  build({ ...common, entryPoints: ['src/agent-build.css'], banner: { css: banner }, minify: true, outfile: 'dist/agent-build.min.css' }),
  promisify(execFile)(fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url)), ['-p', 'tsconfig.build.json'], { cwd: root }),
]);
