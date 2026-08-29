export default async ({ page, shot, wait }) => {
  await page.mouse.click(661, 478); await wait(200); // backspace
  await page.mouse.click(661, 478); await wait(200);
  const k = { '0':[522,646],'1':[383,590],'2':[475,590],'3':[569,590],'4':[383,534],'5':[475,534],'6':[569,534],'7':[383,478],'8':[475,478],'9':[569,478] };
  for (const d of '195') { await page.mouse.click(...k[d]); await wait(200); }
  await shot('t137-typed');
  await page.mouse.click(522, 704); await wait(2500);
  await shot('t140-set3');
  await wait(3000); await shot('t143');
};
