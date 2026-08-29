export default async ({ page, shot, wait }) => {
  for (let i=0;i<6;i++){
    await page.keyboard.down('ArrowRight'); await wait(600); await page.keyboard.up('ArrowRight');
    await wait(400); await shot('t360-look'+i);
  }
};
