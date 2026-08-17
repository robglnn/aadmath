/** A plain static server over dist/, for gates that need one to stay up. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 4390);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not here'); }
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + ROOT + ' on ' + PORT));
