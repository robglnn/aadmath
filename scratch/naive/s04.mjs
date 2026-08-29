export default async ({ page, shot, wait }) => {
  await page.keyboard.press('q'); await wait(600); await shot('t074-cleared');
  // walk forward toward the ring/rift ahead
  await page.keyboard.down('w'); await wait(3000); await shot('t078-walk'); await wait(3000); await page.keyboard.up('w');
  await wait(500); await shot('t082-walked');
  await page.keyboard.down('w'); await wait(4000); await page.keyboard.up('w');
  await wait(500); await shot('t087-walked2');
};
