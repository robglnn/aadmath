export default async ({ page, shot, wait }) => {
  for (const k of ['a','d','s','w']) {
    await page.keyboard.down(k); await page.keyboard.press('Space'); await wait(2000); await page.keyboard.up(k);
    await wait(400); await shot('t258-esc-'+k);
  }
};
