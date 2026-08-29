export default async ({ page, shot, wait }) => {
  await wait(1500); await shot('t000-arrive');
  await wait(4000); await shot('t005');
  await wait(5000); await shot('t010');
  await wait(5000); await shot('t015');
  await wait(7000); await shot('t022');
  await wait(8000); await shot('t030');
  console.log('url', page.url());
};
