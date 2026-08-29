import { heightAt } from '../../src/world/terrain.js';
// cost of heightAt
let t0 = performance.now(); let s = 0;
for (let i = 0; i < 200000; i++) s += heightAt((i % 300) - 150, ((i / 300) | 0) % 300 - 150) || 0;
let t1 = performance.now();
console.log(`heightAt: ${(200000 / (t1 - t0) * 1000 / 1e6).toFixed(2)} M/s -> ${(t1 - t0).toFixed(0)} ms for 200k  (sum ${s.toFixed(0)})`);
// the lip at (30,-91): profile across it
console.log('\nprofile along x=30, z from -96 to -86 at 0.25 m:');
let out = '';
for (let z = -96; z <= -86; z += 0.25) out += `${z.toFixed(2)}:${(heightAt(30, z) ?? NaN).toFixed(2)}  `;
console.log(out);
console.log('\nprofile along z=-58.5, x from 25 to 35 at 0.25 m:');
out = '';
for (let x = 25; x <= 35; x += 0.25) out += `${x.toFixed(2)}:${(heightAt(x, -58.5) ?? NaN).toFixed(2)}  `;
console.log(out);
