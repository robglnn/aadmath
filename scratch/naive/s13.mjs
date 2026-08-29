export default async ({ page, shot, wait }) => {
  await wait(4000); await shot('t155-ceremony-end');
  await page.keyboard.press('Escape'); await wait(1200); await shot('t157-closed');
  await page.mouse.click(1060, 124).catch(()=>{}); await wait(1200); await shot('t159-closed2');
};
