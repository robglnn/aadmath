import { connect, shot, dumpText } from './nplib.mjs';
import { readFile } from 'node:fs/promises';
const t0 = Number(await readFile('/tmp/np-t0.txt', 'utf8'));
const el = () => Math.round((Date.now() - t0) / 1000);
const { page } = await connect();

// naive: click on the world to take control
await page.mouse.click(800, 450);
await page.waitForTimeout(500);
await shot(page, 't0' + String(el()).padStart(3, '0') + '-after-click');

// hold W to walk forward toward the thing with the E marker
await page.keyboard.down('w');
await page.waitForTimeout(6000);
await shot(page, 't0' + String(el()).padStart(3, '0') + '-walking');
await page.waitForTimeout(6000);
await page.keyboard.up('w');
await shot(page, 't0' + String(el()).padStart(3, '0') + '-walked');
await dumpText(page, el() + 's');
process.exit(0);
