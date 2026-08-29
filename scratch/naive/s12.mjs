export default async ({ page, shot, wait }) => {
  const k = { '0':[720,717],'1':[581,665],'2':[673,665],'3':[767,665],'4':[581,614],'5':[673,614],'6':[767,614],'7':[581,564],'8':[673,564],'9':[767,564] };
  for (const d of '54') { await page.mouse.click(...k[d]); await wait(200); }
  await page.mouse.click(720, 770); await wait(2500);
  await shot('t147-set4');
  await wait(3000); await shot('t150');
};
