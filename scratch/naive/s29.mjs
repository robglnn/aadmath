export default async ({ page, shot, wait }) => {
  for (let i=0;i<6;i++){
    await page.keyboard.down('ArrowLeft'); await wait(300); await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('Shift'); await page.keyboard.down('w'); await wait(4000);
    await page.keyboard.up('w'); await page.keyboard.up('Shift');
    await wait(500); await shot('t280-wander'+i);
  }
};
