export default async ({ page, shot, wait }) => {
  // pitch camera up to see more
  await page.mouse.move(720, 450); await page.mouse.down({ button: 'right' });
  for (let i=0;i<20;i++){ await page.mouse.move(720, 450 - i*15); await wait(20); }
  await page.mouse.up({ button: 'right' });
  await wait(500); await shot('t268-pitch');
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await wait(6000);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await wait(600); await shot('t275-run');
};
