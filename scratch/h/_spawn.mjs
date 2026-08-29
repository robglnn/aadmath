import { heightAt } from '../../src/world/terrain.js';
import { warmRoutes, escapable, routeFrom, headingTo } from '../../src/world/paths.js';
warmRoutes();
for (const [x,z] of [[0,26],[0,0],[-1,-27],[-13,-57],[14,-51],[-35,-65],[-16,-119]]) {
  const r = routeFrom(x,z,-13,-57);
  console.log(`(${x},${z}) h=${(heightAt(x,z)??NaN).toFixed(1)} escapable=${escapable(x,z)} route=${r?r.metres.toFixed(0)+'m':'none'} yaw=${headingTo(x,z,-13,-57).yaw.toFixed(2)}`);
}
