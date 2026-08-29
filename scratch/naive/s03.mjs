export default async ({ page, shot, wait }) => {
  // A player clicks the screen first.
  await page.mouse.click(720, 500);
  await wait(600); await shot('t062-afterclick');
  // Try W
  await page.keyboard.down('w'); await wait(2000); await page.keyboard.up('w');
  await wait(300); await shot('t065-w');
  await page.keyboard.down('w'); await wait(2500); await page.keyboard.up('w');
  await shot('t068-w2');
  // mouse look
  await page.mouse.move(500, 450, { steps: 10 });
  await wait(400); await shot('t070-look');
  await page.mouse.move(900, 450, { steps: 10 });
  await wait(400); await shot('t072-look2');
};
