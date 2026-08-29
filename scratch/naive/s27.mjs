export default async ({ page, shot, wait }) => {
  for (const k of ['m','Tab','r','f','c','h','Escape']) { await page.keyboard.press(k); await wait(700); await shot('t262-key-'+k); }
};
