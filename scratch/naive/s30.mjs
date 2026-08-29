export default async ({ page, shot, wait }) => {
  await wait(8000); await shot('t290-wait1');
  await wait(8000); await shot('t298-wait2');
  await wait(10000); await shot('t308-wait3');
};
