export default async ({ page, shot, wait }) => {
  await page.keyboard.down('ArrowRight'); await wait(200); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('w'); await wait(1200); await page.keyboard.up('w');
  await wait(400); await shot('t214-blackdiamond-a');
  await page.keyboard.down('w'); await wait(1000); await page.keyboard.up('w');
  await wait(400); await shot('t216-blackdiamond-b');
  await page.keyboard.press('e'); await wait(1000); await shot('t218-E');
};
