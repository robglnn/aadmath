export default async ({ page, shot, wait }) => {
  for (let i=0;i<4;i++){
    await page.keyboard.down('w'); await page.keyboard.press('Space'); await wait(1500); await page.keyboard.up('w');
    await wait(500); await shot('t340-in'+i);
  }
};
