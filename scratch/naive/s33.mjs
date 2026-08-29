export default async ({ page, shot, wait }) => {
  for (let i=0;i<5;i++){ await page.keyboard.down('w'); await wait(2200); await page.keyboard.up('w'); await wait(400); await shot('t330-walkin'+i); }
};
