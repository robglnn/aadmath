import { warmRoutes, routeFrom } from '../../src/world/_px.js';
warmRoutes();
const T = { x: -13.25, z: -56.63 };
const S = { x: 44.73, z: -108.95 };
const r = routeFrom(S.x, S.z, T.x, T.z);
console.log(`ROADK=${process.env.ROADK ?? 5} FALLK=${process.env.FALLK ?? 4}: route ${r ? r.metres.toFixed(0) : 'none'} m for a ${Math.hypot(T.x-S.x, T.z-S.z).toFixed(0)} m line = ${r ? (r.metres/Math.hypot(T.x-S.x,T.z-S.z)).toFixed(2) : '-'}x`);
