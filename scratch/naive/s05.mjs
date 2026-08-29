export default async ({ page, shot, wait }) => {
  await page.keyboard.press('e'); await wait(1200); await shot('t090-E');
  await wait(2500); await shot('t093-rift');
};
