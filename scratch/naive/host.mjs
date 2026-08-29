import { chromium } from 'playwright';

const browser = await chromium.launchPersistentContext('/tmp/naive-profile', {
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  args: ['--remote-debugging-port=9333', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto('http://127.0.0.1:4788/', { waitUntil: 'load' });
console.log('ready');
// idle forever
await new Promise(() => {});
