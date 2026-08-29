export default async ({ page, shot, wait }) => {
  await page.keyboard.press('q'); await wait(500);
  await page.keyboard.press('j'); await wait(1200); await shot('t162-J');
  await page.keyboard.press('Escape'); await wait(800);
  await page.mouse.click(1367, 110); await wait(1500); await shot('t165-progress');
};
