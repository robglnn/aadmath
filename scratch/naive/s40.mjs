export default async ({ page, shot, wait }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await wait(8000);
  for (let i=0;i<6;i++){
    await page.keyboard.down('w'); await wait(1500); await page.keyboard.up('w');
    await page.keyboard.press('e'); await wait(600);
    await shot('t380-fresh'+i);
  }
};
