export default async ({ page, shot, wait }) => {
  await page.keyboard.down('ArrowRight'); await wait(900); await page.keyboard.up('ArrowRight');
  await wait(300); await shot('t197-face2');
  await page.keyboard.down('w'); await wait(2500); await page.keyboard.up('w');
  await wait(400); await shot('t200');
  await page.keyboard.down('w'); await wait(2500); await page.keyboard.up('w');
  await wait(400); await shot('t203');
};
