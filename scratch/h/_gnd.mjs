import { heightAt, PEAK, coastRadius } from '../../src/world/terrain.js';
for (const [x,z] of [[15.1,-110.1],[44.4,-122.3],[29.4,-93.5],[26.7,-42.2],[62,-98]]) {
  console.log(x, z, 'h=', heightAt(x,z), 'dPEAK=', Math.hypot(x-PEAK.x,z-PEAK.z).toFixed(1), 'R=', Math.hypot(x,z).toFixed(1), 'coast=', coastRadius(Math.atan2(z,x)).toFixed(1));
}
