export default async ({ page, shot, wait }) => {
  const k = { '0':[720,655],'1':[581,598],'2':[673,598],'3':[767,598],'4':[581,542],'5':[673,542],'6':[767,542],'7':[581,487],'8':[673,487],'9':[767,487] };
  for (const d of '28') { await page.mouse.click(...k[d]); await wait(200); }
  await page.mouse.click(720, 713); await wait(2000);
  await shot('t131-wrong');
  await wait(2500); await shot('t134-wrong2');
};
