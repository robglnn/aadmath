export default async ({ page, shot, wait }) => {
  await page.keyboard.down('ArrowLeft'); await wait(1300); await page.keyboard.up('ArrowLeft');
  await wait(300); await shot('t365-face');
  for (let i=0;i<8;i++){
    await page.keyboard.down('w'); await wait(900); await page.keyboard.up('w');
    await page.keyboard.press('e'); await wait(500);
    await shot('t368-hammer'+i);
  }
};
