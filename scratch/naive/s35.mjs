export default async ({ page, shot, wait }) => {
  await shot('t345-standing-at-ring');
  await page.keyboard.press('e'); await wait(1500); await shot('t347-E-works');
};
