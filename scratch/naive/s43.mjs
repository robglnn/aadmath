export default async ({ page, shot, wait }) => {
  await page.keyboard.press('q'); await wait(600);
  for (let i=0;i<5;i++){
    await page.keyboard.down('w'); await wait(1300); await page.keyboard.up('w');
    await page.keyboard.press('e'); await wait(900); await shot('t415-e'+i);
  }
};
