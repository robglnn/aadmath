export default async ({ page, shot, wait }) => {
  await page.keyboard.down('s'); await wait(3000); await page.keyboard.up('s');
  await wait(600); await shot('t250-recover');
  await page.keyboard.down('s'); await wait(3000); await page.keyboard.up('s');
  await wait(600); await shot('t254-recover2');
};
