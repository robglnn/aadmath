export default async ({ page, shot, wait }) => {
  await page.keyboard.down('w'); await wait(1500); await page.keyboard.up('w');
  await wait(400); await shot('t106');
  // jump onto plinth
  await page.keyboard.down('w');
  await page.keyboard.press('Space'); await wait(500);
  await page.keyboard.press('Space'); await wait(900);
  await page.keyboard.up('w');
  await wait(600); await shot('t109-jump');
  await page.keyboard.down('w'); await wait(1500); await page.keyboard.up('w');
  await wait(600); await shot('t112');
  await page.keyboard.press('e'); await wait(1500); await shot('t114-E');
};
