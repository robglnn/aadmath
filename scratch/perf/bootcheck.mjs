/** Does the game boot at all, and with what console errors? Fast. */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
let booted = true;
try { await p.waitForFunction(() => !!window.__ascent, null, { timeout: 25000 }); } catch { booted = false; }
console.log(booted ? 'BOOT OK' : 'BOOT FAILED');
errs.slice(0, 6).forEach((e) => console.log('  ! ' + e));
await b.close();
process.exit(booted && !errs.length ? 0 : 1);
