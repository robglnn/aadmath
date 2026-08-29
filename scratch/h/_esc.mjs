import { heightAt } from '../../src/world/terrain.js';
import { escapable, wayOut, routeFrom, warmRoutes, routeStats } from '../../src/world/paths.js';
warmRoutes();
for (const [x,z] of [[30,-135.7],[29,-136],[24,-134],[15.1,-110.1],[-116.6,-81.6],[-114,-84]]) {
  const r = routeFrom(x,z,-13.25,-56.63);
  console.log(`(${x},${z}) h=${(heightAt(x,z)??NaN).toFixed(1)} esc=${escapable(x,z)} wayOut=${JSON.stringify(wayOut(x,z))} route=${r?r.metres.toFixed(0)+'m starts '+r.cells[0][0].toFixed(1)+','+r.cells[0][2].toFixed(1)+'(h'+r.cells[0][1].toFixed(1)+')':'none'}`);
}
