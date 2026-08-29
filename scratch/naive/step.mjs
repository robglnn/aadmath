// Connects to the already-running browser and runs a step file of real input.
import { chromium } from 'playwright';
import fs from 'node:fs';

const stepFile = process.argv[2];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('4788')) || ctx.pages()[0];

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const shot = async (name) => {
  await page.screenshot({ path: `/Users/harrison/dev/aadmath/scratch/naive/shots/${name}.png` });
  return name;
};
const key = async (k, ms = 120) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const mouse = async (dx, dy, steps = 12) => {
  // pointer-lock style relative movement
  await page.mouse.move(720 + dx, 450 + dy, { steps });
};
const wait = (ms) => page.waitForTimeout(ms);

const mod = await import(stepFile);
await mod.default({ page, shot, key, hold, mouse, wait, fs });

if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); }
else console.log('no console errors this step');
await browser.close();
