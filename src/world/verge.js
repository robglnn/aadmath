import * as THREE from 'three';
import { ISLAND_R, heightAt } from './world.js';
import { coastRadius } from './terrain.js';
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

// ---------------------------------------------------------------------------
// THE BRINK — the coastline, made visible from the inside.
//
// The verge above is the far wall, three hundred metres out over open air, and
// it works. The thing that actually ends sessions is two hundred metres closer
// and had nothing on it at all: the *coastline*. Shard Nine simply stops, on
// grass, at walking pace, with no lip, no lighting change and no sound — and a
// cold player following the game's own "to your left" prompt walked over it at
// a jog and never came back.
//
// A fall-catch (src/player/terrain.js) makes that survivable. It does not make
// it good. An edge you only learn about by falling off it teaches the player
// that the ground cannot be trusted, and a player who does not trust the ground
// stops exploring — which costs this game the only thing it has that Fortnite
// also has. So the boundary is a *place* on this side of it too: a rank of
// lattice light standing along the last few metres of ground, lit only where
// you are, visible from forty metres out, brightest at the lip.
//
// It is drawn from `coastRadius`, the same function the heightfield cuts the
// coast with, so the light is on the edge rather than near it — and it costs
// one draw call that is skipped outright while the cadet is inland.
// ---------------------------------------------------------------------------

/** How far out the cadet has to be before it is drawn at all. */
const BRINK_SHOW = 95;
/**
 * Where the standing rank is planted, in metres inside the coastline.
 *
 * NOT on the lip. The first cut of this stood the light at the coast radius
 * itself, which is where the ground has already rolled over into the drop — so
 * the rank was planted down the far side of its own crest and was invisible
 * from four metres back, which is the only place it needed to be visible from.
 * Planted here it stands on the last flat ground, and the two metres of grass
 * past it are the margin a running cadet gets.
 */
const BRINK_AT = 3.2;

function createBrink(scene) {
  const N = 384;                       // segments around the coast
  const pos = [];
  const uvs = [];
  // Three rings: a feathered edge inland, the hot line on the last flat
  // ground, and a standing rank of light above it that fades into the air.
  const rows = [
    { inset: 11.0, lift: 0.16, v: 0.0 },
    { inset: BRINK_AT, lift: 0.22, v: 0.42 },
    { inset: BRINK_AT, lift: 6.2, v: 1.0 },
  ];
  const ring = rows.map((row) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const r = Math.max(2, coastRadius(ang) - row.inset);
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      // The ground under the lip, so the band lies on the land instead of
      // hovering over a cove or sinking into a headland.
      const h = heightAt(x, z);
      pts.push([x, (h === null ? 0 : h) + row.lift, z]);
    }
    return pts;
  });
  for (let k = 0; k < rows.length - 1; k++) {
    for (let i = 0; i < N; i++) {
      const a = ring[k][i], b = ring[k][i + 1];
      const c = ring[k + 1][i], d = ring[k + 1][i + 1];
      const u0 = i / N, u1 = (i + 1) / N;
      const v0 = rows[k].v, v1 = rows[k + 1].v;
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      uvs.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
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
      void main(){
        // RIBS. Same language as the verge: a rank of light, not a gradient.
        // Their pitch is set in metres of arc rather than in UV, so a headland
        // and a cove carry the same spacing.
        float ribX = fract(vUv.x * 300.0 + 0.5) - 0.5;
        float rib = exp(-ribX * ribX * 46.0);
        rib *= 0.62 + 0.38 * sin(uTime * 1.5 + floor(vUv.x * 300.0) * 2.1);

        // The line on the ground is the message; the rank above it is what
        // makes the line visible from forty metres and from a low camera.
        float lip = exp(-pow((vUv.y - 0.42) * 13.0, 2.0));
        float deck = smoothstep(0.0, 0.42, vUv.y) * step(vUv.y, 0.42);
        float wall = pow(smoothstep(1.0, 0.42, vUv.y), 1.15) * step(0.42, vUv.y);
        float body = max(deck * 0.70, wall);

        // Only the stretch of coast you are actually at lights up.
        float prox = 1.0 - smoothstep(30.0, 120.0, distance(vW, cameraPosition));
        // The floor of this is deliberately high. The first cut spent almost all
        // of its alpha on the ribs, and a rank that is only solid on a third of
        // its width disappears entirely against a sunlit cloud deck — which is
        // the same mistake, in the same file, that made the verge invisible
        // when it was additive. A boundary has to be able to occlude.
        float a = clamp(body * (0.58 + rib * 0.42) + lip * (0.55 + rib * 0.45), 0.0, 0.94)
                  * uNear * prox;
        vec3 col = mix(vec3(1.0, 0.55, 0.20), vec3(1.0, 0.95, 0.86), clamp(lip * 0.8 + rib * 0.55, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.userData.noCamBlock = true;
  mesh.visible = false;
  scene.add(mesh);

  let near = 0;
  return {
    mesh,
    /** How far the cadet is from the coast on their own bearing. Metres. */
    gap(p) {
      const r = Math.hypot(p.x, p.z);
      return coastRadius(Math.atan2(p.z, p.x)) - r;
    },
    update(dt, time, p) {
      mat.uniforms.uTime.value = time;
      const gap = this.gap(p);
      const want = gap > BRINK_SHOW ? 0 : Math.min(1, Math.max(0, (BRINK_SHOW - gap) / 55));
      near += (want - near) * Math.min(1, dt * 3.0);
      mat.uniforms.uNear.value = near;
      mesh.visible = near > 0.02;
      return gap;
    },
  };
}

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

  const brink = createBrink(scene);

  let near = 0;
  let saidT = 0;
  let brinkT = 0;
  const _m = new THREE.Vector3();

  return {
    mesh,
    brink,
    /** Where the curtain stands, from where the cadet is — or null, if far. */
    mark(p) {
      const r = Math.hypot(p.x, p.z) || 1;
      if (VERGE_R - r > FADE * 0.62) return null;
      return _m.set((p.x / r) * VERGE_R, Math.max(p.y + 6, 30), (p.z / r) * VERGE_R);
    },
    update(dt, time, player, hud) {
      mat.uniforms.uTime.value = time;

      // The near edge, first: it is the one a walking player meets.
      const gap = brink.update(dt, time, player.pos);
      if (brinkT > 0) brinkT -= dt;
      // Said once, at the distance where a running cadet can still stop —
      // and only while the boots are on the ground, so it never talks over a
      // glide that is deliberately crossing the coast with height to spare.
      if (gap < 11 && gap > -2 && brinkT <= 0 && player.grounded) {
        brinkT = 25;
        hud?.flash?.(t('field.brink'), 'bad');
      }

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
