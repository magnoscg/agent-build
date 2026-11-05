/* A tiny static server for the demo and the browser smoke test. The library
   itself needs no server; this only exists because file:// pages behave
   differently from real ones.

     pnpm demo            → http://127.0.0.1:4173/
     PORT=8080 pnpm demo  → another port */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

export function startServer({ port = 0, root = ROOT } = {}) {
  const server = createServer(async (request, response) => {
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      const path = decodeURIComponent(pathname);
      const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
      if (!file.startsWith(root + sep) || /[\\/](\.|node_modules[\\/])/.test(file.slice(root.length))) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      done({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((closed) => server.close(closed)),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startServer({ port: Number(process.env.PORT) || 4173 });
  console.log(`agent-build demo: ${url}`);
}
