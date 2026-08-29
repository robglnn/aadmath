export default async ({ page, shot, wait }) => {
  await page.mouse.move(720, 450);
  await page.mouse.down({ button: 'right' });
  for (let i = 0; i < 30; i++) { await page.mouse.move(720 + i*25, 450); await wait(20); }
  await page.mouse.up({ button: 'right' });
  await wait(600); await shot('t176-rmb-turn');
  // try arrow keys
  await page.keyboard.down('ArrowRight'); await wait(1500); await page.keyboard.up('ArrowRight');
  await wait(500); await shot('t179-arrow');
};
