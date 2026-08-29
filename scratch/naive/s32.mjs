export default async ({ page, shot, wait }) => {
  await page.reload({ waitUntil: 'load' });
  await wait(6000); await shot('t320-reload');
  await wait(6000); await shot('t326-reload2');
};
