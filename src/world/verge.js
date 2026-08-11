import * as THREE from 'three';
import { ISLAND_R } from './world.js';
import { t } from '../i18n/index.js';

/**
 * THE VERGE — where Shard Nine stops, made visible.
 *
 * The client's report, again:
 *
 *   "tried to fly to the far away island but seems thats outside our
 *    boundaries"
 *
 * He was over open air, wing out, committed, aimed at a landmass — and slid
 * sideways along a sphere he could not see. `src/player/locomotion.js` clamps
 * the cadet at `RIM() * 1.62`, silently, for ever. An invisible wall in the
 * middle of a flight is the most disappointing thing an open world can do,
 * because it does not merely refuse the journey: it retracts the invitation
 * the sky already issued.
 *
 * Two things fix that, and only one of them is code.
 *
 *  1. The wall is now a *place*. A standing curtain of lattice light sits at
 *     the clamp radius: invisible from the island, unmistakable from a hundred
 *     metres out, and loud when you touch it. You can see the edge of the world
 *     coming, which turns "the game cheated" into "I flew to the edge of the
 *     world" — the same fact, honestly staged.
 *  2. Nothing you can plausibly aim at now lives past it (see
 *     `createFloatingRocks` in props.js, whose near rocks were drifting out to
 *     430 m — a hundred and sixty metres beyond anything reachable). The far
 *     shards stay where they are: enormous, hazed, and manifestly *other
 *     islands in the sky*, which is what they always were.
 *
 * The curtain is one draw call, additive, no shadow, and it renders only when
 * the cadet is inside its fade band, so it costs nothing for the ninety-nine
 * percent of a session spent on the island.
 */

// Must track `RIM() * 1.62` in src/player/locomotion.js: the light has to stand
// exactly where the leash does, or it is decoration lying about a boundary.
export const VERGE_R = ISLAND_R * 1.62;
const FADE = 190;            // metres out from the curtain where it starts to show
const HEIGHT = 460;          // …and it has a top edge, because a wall you cannot
const BASE = -170;           //    see the end of is weather, not a boundary

export function createVerge(scene) {
  const geo = new THREE.CylinderGeometry(VERGE_R, VERGE_R, HEIGHT, 128, 1, true);
  const mat = new THREE.ShaderMaterial({
    // Normal blending, not additive. The verge is met at three hundred metres
    // over a bright cloud deck, and an additive curtain against a sky that is
    // already near white survives tone mapping as precisely nothing — which is
    // how the first cut of this shipped an invisible wall with extra steps.
    // A curtain has to be able to *occlude*.
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.NormalBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uNear: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vW;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      varying vec3 vW;
      uniform float uTime, uNear;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y);
      }
      void main(){
        // RIBS. The lattice is an argument the founders wrote down, and this is
        // where it runs out: a standing rank of light every twelve metres of
        // arc. Structure is the whole job — a smooth gradient at nine metres
        // fills the screen and reads as weather, and weather is not a boundary.
        float ribX = fract(vUv.x * 68.0 + 0.5) - 0.5;
        float rib = exp(-ribX * ribX * 70.0);
        // …with the ranks breathing out of phase, so it is alive
        rib *= 0.58 + 0.42 * sin(uTime * 0.8 + floor(vUv.x * 68.0) * 1.7);

        // and the cross-members: this is a *lattice* running out, and the one
        // place in the world where you can see the thing itself
        float railY = fract(vUv.y * 3.0 + 0.5) - 0.5;
        float rail = exp(-railY * railY * 420.0) * 0.5;

        // drifting filaments between the ribs
        float fil = smoothstep(0.42, 0.96, n(vec2(vUv.x * 260.0, vUv.y * 5.0 - uTime * 0.09)));

        // the body of the curtain: solid at the base, gone before the top, so
        // there is a visible upper edge with sky above it
        float body = smoothstep(0.03, 0.15, vUv.y) * smoothstep(0.99, 0.86, vUv.y);
        // the top edge itself, drawn hot
        float lip = exp(-pow((vUv.y - 0.90) * 15.0, 2.0)) * 0.7;

        // Only the arc you are actually near lights up. The curtain is a
        // cylinder around the whole world, so fading it by the *player's*
        // radius veils the entire sky the moment he leaves the meadow — which
        // reads as a rendering fault, not as a boundary. Fade by the distance
        // to this fragment and it becomes what it is: a wall, ahead of you.
        float prox = 1.0 - smoothstep(55.0, 210.0, distance(vW, cameraPosition));
        float weave = clamp(rib + rail * 0.8, 0.0, 1.2);
        float a = clamp(body * (0.22 + fil * 0.18 + weave * 0.70) + lip * rib, 0.0, 0.92) * uNear * prox;
        vec3 col = mix(vec3(0.22, 0.44, 0.88), vec3(0.99, 0.68, 0.40), clamp(weave * 0.6 + fil * 0.2, 0.0, 1.0));
        col = mix(col, vec3(1.0, 0.94, 0.86), clamp(weave * 0.5 + lip, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = HEIGHT * 0.5 + BASE;
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.userData.noCamBlock = true;
  mesh.visible = false;
  scene.add(mesh);

  let near = 0;
  let saidT = 0;
  const _m = new THREE.Vector3();

  return {
    mesh,
    /** Where the curtain stands, from where the cadet is — or null, if far. */
    mark(p) {
      const r = Math.hypot(p.x, p.z) || 1;
      if (VERGE_R - r > FADE * 0.62) return null;
      return _m.set((p.x / r) * VERGE_R, Math.max(p.y + 6, 30), (p.z / r) * VERGE_R);
    },
    update(dt, time, player, hud) {
      mat.uniforms.uTime.value = time;
      const r = Math.hypot(player.pos.x, player.pos.z);
      // Full strength well before you reach it. The point is to be *seen
      // coming*: a boundary you only notice on impact has already failed.
      const k = Math.max(0, Math.min(1, 1 - (VERGE_R - r) / FADE));
      const want = k * k * (3 - 2 * k) * 1.35;
      near += (want - near) * Math.min(1, dt * 2.4);
      mat.uniforms.uNear.value = Math.min(1, near);
      mesh.visible = near > 0.02;

      // Contact. The leash puts you back on the inside on the same frame, so
      // the only thing that can tell the story is this.
      if (saidT > 0) saidT -= dt;
      if (r > VERGE_R - 1.2 && saidT <= 0) {
        saidT = 12;
        hud?.flash?.(t('field.vergeHit'), 'bad');
      }
    },
  };
}
