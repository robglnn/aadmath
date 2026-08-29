export default async ({ page, shot, wait }) => {
  await page.keyboard.down('ArrowLeft'); await wait(600); await page.keyboard.up('ArrowLeft');
  await wait(300); await shot('t206');
  await page.keyboard.down('s'); await wait(2500); await page.keyboard.up('s');
  await wait(400); await shot('t209-back');
  await page.keyboard.down('ArrowLeft'); await wait(400); await page.keyboard.up('ArrowLeft');
  await wait(300); await shot('t211');
};
