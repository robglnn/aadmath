export default async ({ page, shot, wait }) => {
  // walk to bronze pillar plaque
  await page.keyboard.down('ArrowRight'); await wait(250); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('w'); await wait(1600); await page.keyboard.up('w');
  await wait(400); await shot('t222-plaque');
  // now test glide: jump repeatedly and hold space
  await page.keyboard.down('w');
  await page.keyboard.press('Space'); await wait(300);
  await page.keyboard.press('Space'); await wait(200);
  await page.keyboard.down('Space'); await wait(2000);
  await shot('t226-glide');
  await page.keyboard.up('Space'); await page.keyboard.up('w');
  await wait(1000); await shot('t228-land');
};
