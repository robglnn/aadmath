#!/usr/bin/env node
/** Scratch: build this tree into a private dir, serve it, run one critic against it. */
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { listenFree } from '../_freeport.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json' };
const [script, ...rest] = process.argv.slice(2);
const out = await mkdtemp(path.join(tmpdir(), 'laneE-'));
await build({ root: ROOT, base: './', logLevel: 'error', build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false } });
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(out, rel));
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
const port = await listenFree(server);
console.log(`frozen build on http://127.0.0.1:${port} -> ${script}`);
const child = spawn('node', [script, '--url', `http://127.0.0.1:${port}`, ...rest], { stdio: 'inherit', cwd: ROOT });
const code = await new Promise((r) => child.on('exit', r));
server.close();
await rm(out, { recursive: true, force: true });
process.exit(code ?? 1);
