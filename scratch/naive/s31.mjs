export default async ({ page, shot, wait }) => {
  const info = await page.evaluate(() => {
    const a = window.__ascent;
    return { keys: a ? Object.keys(a) : null, state: a && a.state ? JSON.parse(JSON.stringify(a.state())) : null };
  });
  console.log(JSON.stringify(info, null, 1).slice(0, 4000));
};
