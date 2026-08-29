export default async ({ page, shot, wait }) => {
  await page.mouse.click(88, 836); await wait(1200); await shot('t182-vaultplate');
  await page.mouse.move(88, 836); await wait(1200); await shot('t184-vaulthover');
};
