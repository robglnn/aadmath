import { chromium } from 'playwright';
import fs from 'node:fs';
const s = await chromium.launchServer({ headless: true, args: ['--use-gl=angle','--enable-unsafe-swiftshader','--force-device-scale-factor=1'] });
fs.writeFileSync('/tmp/h6-ws.txt', s.wsEndpoint());
console.log('ws', s.wsEndpoint());
