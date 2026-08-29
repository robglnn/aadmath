export default async ({ page, shot, wait }) => {
  await page.mouse.click(551, 601); await wait(1500); await shot('t405-begun');
  for (let i=0;i<5;i++){
    await page.keyboard.down('w'); await wait(1200); await page.keyboard.up('w');
    await page.keyboard.press('e'); await wait(800); await shot('t408-e'+i);
  }
};
