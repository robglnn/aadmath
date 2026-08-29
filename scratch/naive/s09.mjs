export default async ({ page, shot, wait }) => {
  const k = { '0':[720,633],'1':[581,577],'2':[673,577],'3':[767,577],'4':[581,521],'5':[673,521],'6':[767,521],'7':[581,466],'8':[673,466],'9':[767,466] };
  for (const d of '288') { await page.mouse.click(...k[d]); await wait(200); }
  await page.mouse.click(720, 692); await wait(1800);
  await shot('t124-set2');
  await wait(2000); await shot('t127');
};
