import { heightAt } from '../src/world/terrain.js';
const cx = 62, cz = -98;
for (const r of [0, 8, 16, 24, 32, 40, 50, 60, 75]) {
  const row = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const h = heightAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    row.push(h === null ? 'OFF' : h.toFixed(0));
  }
  console.log(String(r).padStart(3), row.join(' '));
}
