/**
 * Serve a frozen build and run a probe against it, in ONE process.
 *
 * The two-process version — `vite preview &` then `node probe.mjs` — kept
 * losing its server halfway through a twenty-case sweep, and a probe that
 * dies at case fourteen reports nothing about cases fifteen to twenty while
 * looking exactly like a probe that found something. The server is a hundred
 * lines of `fs.createReadStream`; there is no reason for it to be somebody
 * else's process.
 *
 *   node tools/critic/_run.mjs <dist-dir> <probe.mjs> [probe args…]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = path.resolve(process.argv[2]);
const PROBE = path.resolve(process.argv[3]);
const REST = process.argv.slice(4);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;

// Probes read `--url` off argv; hand them this one and get out of the way.
process.argv = [process.argv[0], PROBE, ...REST, '--url', url];
try {
  await import(pathToFileURL(PROBE).href);
} finally {
  server.close();
}
