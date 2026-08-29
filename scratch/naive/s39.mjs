export default async ({ page }) => {
  const out = await page.evaluate(() => {
    const a = window.__ascent;
    let obj = null; try { obj = a.nextObjective && a.nextObjective(); } catch(e) { obj = 'err ' + e.message; }
    let rifts = null;
    try {
      const r = a.rifts;
      rifts = { keys: Object.keys(r||{}), list: (r.list && r.list()) || (r.all && r.all()) || null };
    } catch(e) { rifts = 'err ' + e.message; }
    let pos = null;
    try { pos = a.player && a.player.object3D ? a.player.object3D.position.toArray() : (a.player.position ? a.player.position.toArray() : Object.keys(a.player)); } catch(e){ pos = 'err'; }
    return { obj: JSON.parse(JSON.stringify(obj||null)), riftKeys: rifts && rifts.keys, pos };
  });
  console.log(JSON.stringify(out, null, 1).slice(0, 3000));
};
