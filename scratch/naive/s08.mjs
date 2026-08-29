export default async ({ page, shot, wait }) => {
  await page.mouse.click(673, 598); await wait(250); // 2
  await page.mouse.click(720, 655); await wait(250); // 0
  await page.mouse.click(720, 655); await wait(250); // 0
  await shot('t116-typed');
  await page.mouse.click(720, 712); await wait(1500); // SET
  await shot('t118-set');
  await wait(2500); await shot('t121-after');
};
