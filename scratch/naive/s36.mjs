export default async ({ page, shot, wait }) => {
  for (let i=0;i<4;i++){
    await page.keyboard.press('e'); await wait(900); await shot('t350-E'+i);
    await page.keyboard.down('s'); await wait(700); await page.keyboard.up('s'); await wait(300);
  }
};
