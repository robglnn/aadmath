/**
 * Atomic updater for the live progress page. Agents call this instead of
 * hand-editing state.json, so concurrent writers cannot clobber each other.
 *
 *   node tools/progress.mjs piece world building "reworking grass + biomes"
 *   node tools/progress.mjs piece world passed 9 "critic: beats BOTW on silhouette"
 *   node tools/progress.mjs log "wave 2" "world critic round 3: still loses on colour"
 *   node tools/progress.mjs metric fps 118
 */
import { readFile, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'progress/state.json');
const LOCK = FILE + '.lock';

async function withLock(fn) {
  for (let i = 0; i < 200; i++) {
    try {
      const fh = await open(LOCK, 'wx');
      try { return await fn(); } finally { await fh.close(); await import('node:fs/promises').then(m => m.unlink(LOCK).catch(() => {})); }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      await new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 90)));
    }
  }
  throw new Error('progress.json lock timeout');
}

const [cmd, ...rest] = process.argv.slice(2);

await withLock(async () => {
  const s = JSON.parse(await readFile(FILE, 'utf8'));

  if (cmd === 'piece') {
    const [id, status, ...tail] = rest;
    const p = s.pieces.find((x) => x.id === id);
    if (!p) throw new Error(`unknown piece "${id}" — known: ${s.pieces.map(x => x.id).join(', ')}`);
    p.status = status;
    const maybeScore = Number(tail[0]);
    if (Number.isFinite(maybeScore) && tail.length > 1) { p.score = maybeScore; tail.shift(); }
    if (tail.length) p.note = tail.join(' ');
  } else if (cmd === 'log') {
    const [t, ...m] = rest;
    s.log.push({ t, m: m.join(' ') });
    if (s.log.length > 200) s.log = s.log.slice(-200);
  } else if (cmd === 'metric') {
    const [k, v] = rest;
    s.metrics[k] = Number.isFinite(Number(v)) ? Number(v) : v;
  } else if (cmd === 'wave') {
    s.wave = Number(rest[0]);
    s.updated = `wave ${rest[0]}`;
    if (rest.length > 1) s.summary = rest.slice(1).join(' ');
  } else {
    console.error('usage: progress.mjs piece|log|metric|wave …');
    process.exit(1);
  }

  await writeFile(FILE, JSON.stringify(s, null, 2));
});
