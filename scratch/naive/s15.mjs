export default async ({ page, shot, wait }) => {
  await page.mouse.click(1206, 58); await wait(1000); await shot('t168-closed');
  // turn around: many small relative moves
  for (let i = 0; i < 20; i++) { await page.mouse.move(400 + i*40, 450); await wait(30); }
  await wait(600); await shot('t171-turn');
  for (let i = 0; i < 20; i++) { await page.mouse.move(400 + i*40, 450); await wait(30); }
  await wait(600); await shot('t173-turn2');
};
