export default async ({ page, shot, wait }) => {
  await wait(6000);
  for (let i=0;i<7;i++){
    await page.keyboard.down('w'); await wait(1400); await page.keyboard.up('w');
    await page.keyboard.press('e'); await wait(700);
    await shot('t400-clean'+i);
  }
};
