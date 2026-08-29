import { connect, shot, textDump } from './lib.mjs';
const { b, page } = await connect();
const script = JSON.parse(process.argv[2]);
await page.bringToFront();
for (const a of script) {
  const [op, arg, arg2] = a;
  if (op === 'hold') { await page.keyboard.down(arg); await page.waitForTimeout(arg2 || 500); await page.keyboard.up(arg); }
  else if (op === 'holdmany') { for (const k of arg) await page.keyboard.down(k); await page.waitForTimeout(arg2 || 500); for (const k of arg) await page.keyboard.up(k); }
  else if (op === 'key') { await page.keyboard.press(arg); }
  else if (op === 'type') { await page.keyboard.type(arg, { delay: 60 }); }
  else if (op === 'click') { await page.mouse.click(arg, arg2); }
  else if (op === 'move') { await page.mouse.move(arg, arg2, { steps: 12 }); }
  else if (op === 'wait') { await page.waitForTimeout(arg); }
  else if (op === 'shot') { console.log('SHOT ' + await shot(page, arg)); }
  else if (op === 'dump') { console.log('=== DUMP ' + (arg || '') + '\n' + await textDump(page)); }
  else if (op === 'errs') { console.log('ERRS ' + JSON.stringify(await page.evaluate(() => window.__h6 && window.__h6.errs))); }
  else if (op === 'url') { console.log('URL ' + page.url()); }
}
process.exit(0);
