import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const server = await chromium.launchServer({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
await writeFile('/tmp/np-ws.txt', server.wsEndpoint());
console.log('WS', server.wsEndpoint());
setInterval(() => {}, 1 << 30);
