export default async ({ page, shot, wait }) => {
  await page.keyboard.down('w'); await wait(2500); await page.keyboard.up('w');
  await wait(400); await shot('t097-approach');
  await page.keyboard.down('w'); await wait(2000); await page.keyboard.up('w');
  await wait(400); await shot('t100-approach2');
  await page.keyboard.down('w'); await wait(2000); await page.keyboard.up('w');
  await wait(800); await shot('t103-in');
};
