export default async ({ page, shot, wait }) => {
  await page.keyboard.press('q'); await wait(400);
  // face the diamond cluster to the right of screen
  await page.keyboard.down('ArrowRight'); await wait(700); await page.keyboard.up('ArrowRight');
  await wait(400); await shot('t187-face');
  await page.keyboard.down('w'); await wait(3000); await shot('t190'); await wait(3000); await page.keyboard.up('w');
  await wait(500); await shot('t194-atdiamond');
};
