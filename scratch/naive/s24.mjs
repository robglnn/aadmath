export default async ({ page, shot, wait }) => {
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await wait(4000);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await wait(500); await shot('t242-up');
  for (let i=0;i<8;i++){ await page.keyboard.down('ArrowRight'); await wait(400); await page.keyboard.up('ArrowRight'); await wait(200); await shot('t245-pan'+i); }
};
