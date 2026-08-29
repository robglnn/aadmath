export default async ({ page, shot, wait }) => {
  await page.keyboard.down('Shift'); await page.keyboard.down('w');
  await wait(2000); await shot('t231-sprint');
  await page.keyboard.press('Space'); await wait(400); await shot('t232-jump1');
  await page.keyboard.press('Space'); await wait(400); await shot('t233-jump2');
  await page.keyboard.down('Space'); await wait(1500); await shot('t235-hold');
  await page.keyboard.up('Space');
  await wait(1500); await shot('t237');
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
};
