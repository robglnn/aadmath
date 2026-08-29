#!/usr/bin/env node
/**
 * A PORT THAT IS FREE, rather than a port that is probably free.
 *
 *   node tools/_freeport.mjs --self-test
 *
 * WHY THIS FILE EXISTS
 *
 * Five gates in the build stand up a static server, point a browser at it and
 * judge the page: check:figures, check:record, check:reachable, check:answerable
 * and check:choices. Every one of them picked its port the same way —
 *
 *     const port = 4900 + Math.floor(Math.random() * 400);
 *     await new Promise((r) => server.listen(port, '127.0.0.1', r));
 *
 * — and that has two failure modes, both of which this repo hit in one run.
 *
 *  1. THE GATE DIES FOR A REASON THAT IS NOT THE GAME. Several builders and
 *     critics run at once here; that is the documented working mode. Two of
 *     them draw the same number and the second one's `listen` emits `error`.
 *     Nothing is listening for `error`, so node re-throws it, the process dies
 *     with a stack trace, and `npm run check` records the gate as red:
 *
 *         ── check:reachable ──
 *         Error: listen EADDRINUSE: address already in use 127.0.0.1:5241
 *
 *     That is a red gate that says nothing about the product. The next person
 *     re-runs it, it passes, and the lesson learned is "the gates are flaky" —
 *     which is how a gate stops being read.
 *
 *  2. THE PROMISE NEVER SETTLES. `listen(port, host, cb)` calls `cb` on
 *     'listening' and nothing on 'error'. Wrapped in a bare `new Promise`, a
 *     bind failure that somebody HAS handled elsewhere hangs the run instead of
 *     failing it. A gate that hangs is worse than one that fails.
 *
 * Port 0 is the fix and it is not a workaround: it asks the kernel for a port
 * nothing is on, which is the actual question. The number is then read back off
 * the bound socket. There is no range to exhaust and no collision to lose.
 *
 * `freePort()` is here for the one caller that cannot use port 0 — check:record
 * hands a number to `vite preview --strictPort` in a child process. It binds
 * port 0, reads the number, closes, and returns it. That has a window in which
 * something else could take the port; it is far narrower than a 1-in-400 draw
 * against every other tool in the tree, and `--strictPort` turns the remaining
 * case into a clean refusal instead of a silently wrong build.
 */
import { createServer as createNetServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Bind a server to a port nothing else is on, and say which one it got.
 *
 * Unlike a bare `server.listen(n, host, cb)` this settles on BOTH outcomes: it
 * resolves with the port on 'listening' and rejects with the real error on
 * 'error', so a caller can never hang and node can never re-throw the error as
 * an unhandled event.
 *
 * @param {import('node:net').Server} server  any net/http server, unbound
 * @param {string} host
 * @returns {Promise<number>} the port the kernel assigned
 */
export function listenFree(server, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const onError = (err) => { server.removeListener('listening', onListening); reject(err); };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      if (!addr || typeof addr === 'string') { reject(new Error(`listening on ${addr}, which has no port`)); return; }
      resolve(addr.port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, host);
  });
}

/**
 * A free port number, for a caller that has to hand one to a child process.
 * Prefer `listenFree` wherever the server is in this process.
 *
 * @param {string} host
 * @returns {Promise<number>}
 */
export function freePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const s = createNetServer();
    s.once('error', reject);
    s.listen(0, host, () => {
      const { port } = s.address();
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

// ---------------------------------------------------------------------------
// Self-test. The defect this file exists for is a gate that went red without
// anything being wrong with the game, so the test plants exactly that: a port
// that is already taken, and two servers standing up at the same instant.
// ---------------------------------------------------------------------------
async function selfTest() {
  let bad = 0;
  const ok = (why) => console.log(`  ok     ${why}`);
  const fail = (why) => { console.error(`SELF-TEST FAIL: ${why}`); bad++; };

  const hello = () => createHttpServer((req, res) => { res.writeHead(200); res.end('hello'); });
  const get = async (port) => (await fetch(`http://127.0.0.1:${port}/`)).text();

  // 1. THE PLANTED DEFECT: hold a port, then prove the old way dies on it and
  //    the new way does not care.
  const held = hello();
  const heldPort = await listenFree(held);
  let oldWayDied = null;
  await new Promise((resolve) => {
    const s = hello();
    s.once('error', (e) => { oldWayDied = e.code; s.close(); resolve(); });
    s.once('listening', () => { s.close(); resolve(); });
    s.listen(heldPort, '127.0.0.1');            // the line every gate used to have
  });
  if (oldWayDied !== 'EADDRINUSE') fail(`a second bind to a held port did not report EADDRINUSE (got ${oldWayDied}); the rest of this test proves nothing`);
  else ok(`a fixed port that is already taken reports ${oldWayDied} — the crash five gates carried`);

  const survivor = hello();
  let survivorPort = null;
  try { survivorPort = await listenFree(survivor); ok(`listenFree got ${survivorPort} with ${heldPort} occupied, and did not throw`); }
  catch (e) { fail(`listenFree threw with another port occupied: ${e.message}`); }
  if (survivorPort === heldPort) fail('listenFree handed out a port that was already taken');

  // 2. It really serves, on the port it claims.
  if (survivorPort) {
    const body = await get(survivorPort).catch((e) => `ERROR ${e.message}`);
    if (body !== 'hello') fail(`the port listenFree reported does not serve the server that asked for it: got "${body}"`);
    else ok('the port it reports is the port the server answers on');
  }

  // 3. Two at once, which is the real shape of the collision: several critics
  //    standing up a server in the same second.
  const many = [hello(), hello(), hello(), hello(), hello(), hello(), hello(), hello()];
  let ports = [];
  try { ports = await Promise.all(many.map((s) => listenFree(s))); }
  catch (e) { fail(`eight servers at once: ${e.message}`); }
  if (new Set(ports).size !== many.length) fail(`eight concurrent binds produced ${new Set(ports).size} distinct ports: ${ports.join(', ')}`);
  else ok(`eight servers standing up at once got eight different ports (${Math.min(...ports)}…${Math.max(...ports)})`);
  for (const s of many) s.close();

  // 4. freePort hands back a number that can then be bound.
  const n = await freePort();
  const late = hello();
  try { await new Promise((res, rej) => { late.once('error', rej); late.listen(n, '127.0.0.1', res); }); ok(`freePort returned ${n} and it was still bindable`); }
  catch (e) { fail(`freePort returned ${n}, which could not then be bound: ${e.message}`); }
  late.close();

  // 5. A REJECTION, NOT A HANG. The whole reason the old wrapper was dangerous
  //    is that it settled on success only. Ask listenFree to bind a server that
  //    is already listening and it must reject inside a moment.
  const twice = hello();
  await listenFree(twice);
  const raced = await Promise.race([
    listenFree(twice).then(() => 'resolved').catch((e) => `rejected ${e.code || e.message}`),
    new Promise((r) => setTimeout(() => r('HUNG'), 3000)),
  ]);
  if (raced === 'HUNG') fail('listenFree hung instead of settling — a gate that hangs is worse than one that fails');
  else ok(`a bind that cannot succeed settles (${raced}) instead of hanging`);
  twice.close();

  held.close();
  survivor.close();

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — a gate cannot go red because another gate was already on its port');
}

const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (process.argv.includes('--self-test')) await selfTest();
  else console.log('usage: node tools/_freeport.mjs --self-test\nImported by the gates that stand up a server: listenFree(server) / freePort()');
}
