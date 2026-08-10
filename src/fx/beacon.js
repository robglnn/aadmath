import * as THREE from 'three';

/**
 * THE RIFT BEACON — a column of lit air, not a pane of blue glass.
 *
 * What was here before the rewrite was an open-ended cylinder, ten segments,
 * additive, with a fresnel-ish edge term. Everything wrong with it followed
 * from the fact that it was a **surface** pretending to be a volume: two dead
 * straight silhouette edges, constant brightness across the width, a core hot
 * enough to push the whole shaft through the bloom threshold, and nothing ever
 * *in* it.
 *
 * The rewrite fixed the geometry and then failed for a different reason, which
 * a screenshot makes obvious in half a second: **it had no colour and it did
 * not touch the ground.** Whitening the axis and then letting bloom and the
 * grade's highlight bleach have their turn produced a pale grey smear standing
 * on a dais that was lit exactly as if the smear were not there. A shaft of
 * light that does not illuminate the stone under it is a decal, no matter how
 * good its falloff is.
 *
 * So this version is three things, and the third is the one that sells it:
 *
 *   the column   a single camera-facing quad whose fragment shader integrates
 *                a **two-lobe radial density** — a tight core and a wide, faint
 *                skirt. The line integral of a Gaussian is another Gaussian, so
 *                both lobes are exact and analytic and neither has a silhouette
 *                anywhere: the edges dissolve instead of ending. The skirt is
 *                the airglow — the part that says the light is in a medium.
 *   the body     two octaves of value noise scrolling upward in *world* space
 *                so the structure is anchored to the place and does not swim
 *                when the camera orbits, a slow helical band of energy climbing
 *                the shaft, and a sparse field of rising sparks
 *   the pool     a horizontal disc of light laid on the dais, from the same
 *                uniforms, so the column visibly spills onto the stone it
 *                stands on and the stone visibly takes it
 *
 * Colour is now defended rather than bleached. Only a *thin* filament on the
 * axis is allowed to go cool-white, the rest stays the rift's own hue, and the
 * height gradient runs from a hot white foot to a deep saturated head — which
 * is what a real scattering column does, because the light has further to
 * travel through the medium by the time it gets up there.
 *
 * Two things keep it honest in the frame. It is **depth tested**, so the arch
 * in front of it cuts it exactly where the stone is. And it holds a minimum
 * angular width with distance, so a beacon four hundred metres away is still a
 * readable thread of light rather than a flickering sub-pixel line — which is
 * the entire navigational job the thing exists to do.
 */

const COLUMN_H = 118;     // metres of column the quad spans
const BASE_R = 1.9;       // metres: the waist radius of the shaft
// Cut to the dais, not to the light. The stone top of a rift dais is 5.4 m at
// the crown and 6.6 m at the skirt; a pool any wider than that is a horizontal
// sheet hanging in mid-air over the steps, which from a standing camera is the
// most obvious decal in the frame.
const POOL_R = 6.2;

const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
const disc = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);

/** The noise the column and the pool share, so they are made of one substance. */
const NOISE = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }`;

export function createBeacon(seed = 0) {
  // One set of uniform objects, shared by the column and the pool. `rifts.js`
  // writes uCol / uPow / uTime on the mesh's material and both surfaces move
  // together — the pool can never be a different colour from the light casting
  // it, which is exactly the class of mistake that reads as "overlay".
  const shared = {
    uTime: { value: 0 },
    uCol: { value: new THREE.Color(0x6fd0ff) },
    uPow: { value: 1 },
    uSeed: { value: seed * 1.618 },
  };

  const mat = new THREE.ShaderMaterial({
    name: 'AscentBeacon',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      ...shared,
      uHeight: { value: COLUMN_H },
      uRadius: { value: BASE_R },
    },
    vertexShader: /* glsl */`
      uniform float uHeight, uRadius;
      varying vec2 vP;        // x: metres from the axis, y: 0..1 up the column
      varying vec3 vWorld;
      varying float vDist;

      void main(){
        vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 toCam = cameraPosition - base;
        vDist = length(toCam);

        // billboard about the world Y axis: the quad always presents its face,
        // so the column never shows a silhouette or a seam
        vec3 right = normalize(vec3(-toCam.z, 0.0, toCam.x) + vec3(1e-4, 0.0, 0.0));

        // Wide enough to contain the *skirt*, not just the core. The previous
        // quad was cut to the core lobe, so the airglow — the entire reason
        // the shaft reads as light in a medium rather than a bar — was being
        // clipped off at fourteen per cent of its value by the polygon edge.
        // A beacon also has one job at range: be visible. Hold a minimum
        // angular width so a distant one is a thread of light, not a dotted
        // line.
        float halfW = max(uRadius * 5.6, vDist * 0.017);

        float h = position.y + 0.5;
        vec3 world = base + right * (position.x * 2.0 * halfW) + vec3(0.0, h * uHeight, 0.0);

        vP = vec2(position.x * 2.0 * halfW, h);
        vWorld = world;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vP;
      varying vec3 vWorld;
      varying float vDist;
      uniform float uTime, uPow, uSeed, uRadius;
      uniform vec3 uCol;
      ${NOISE}

      void main(){
        float u = vP.x;               // metres from the axis
        float h = vP.y;               // 0 at the dais, 1 at the top

        // --- the shape of the column -------------------------------------
        // a broad soft foot where it meets the stone, a waist just above it,
        // then a slow flare as the beam spreads into the sky
        float rad = uRadius * (1.0 + 1.55 * exp(-h * 30.0)) * (1.0 + h * 2.0);
        float k = u / rad;
        float k2 = k * k;

        // Two exact line integrals through two Gaussians. The tight one is the
        // beam; the wide one is the air around the beam catching it. Real
        // scattered light always has both, and a single lobe is the difference
        // between a shaft and a stripe.
        float core = exp(-k2 * 6.2);
        float beam = exp(-k2 * 2.0);
        float skirt = exp(-k2 * 0.34);
        float body = beam + skirt * 0.30;

        // --- how far up the light survives --------------------------------
        // dies out over the first third: the top has to *dissolve*, never end
        float rise = smoothstep(0.0, 0.010, h);
        float fade = exp(-h * 3.1) * 0.80 + exp(-h * 0.95) * 0.20;
        float shape = body * fade * rise;

        // THE SPILL. A wide, low lobe hugging the first couple of metres above
        // the stone: the light pooling where the column meets the dais. The
        // flat disc below does the same job on the surface itself, but a
        // standing player's eye is level with the crown of a dais and sees a
        // horizontal decal almost edge-on — so the cue that actually survives
        // every camera angle has to live on the billboard, where it cannot be
        // foreshortened away.
        float spill = exp(-h * 49.0) * exp(-(u * u) / 44.0);

        // --- what the light is made of ------------------------------------
        // world-anchored so it does not swim when the camera orbits
        float y = vWorld.y;
        float n = vnoise(vec2(u * 0.55 + uSeed, y * 0.42 - uTime * 1.15));
        n = n * 0.62 + 0.38 * vnoise(vec2(u * 1.7 - uSeed, y * 1.25 - uTime * 2.4));
        float grain = 0.52 + 0.74 * n;

        // slow helical banding: energy climbing the shaft
        float band = 0.84 + 0.16 * sin(y * 0.9 - uTime * 2.6 + uSeed * 6.0);

        // rising sparks — real flecks of something inside the column, and the
        // only part of it allowed to be individually resolvable
        vec2 sp = vec2(u * 2.4 + uSeed * 9.0, y * 1.5 - uTime * 2.6);
        float fl = vnoise(sp) * vnoise(sp * 2.13 + 7.0);
        float sparks = pow(max(0.0, fl - 0.40) * 1.66, 4.0) * beam * exp(-h * 2.4);

        // --- colour --------------------------------------------------------
        // The hue is defended. Only a filament on the axis goes cool-white —
        // the previous version whitened most of the visible width, and between
        // the bloom and the grade's highlight bleach the whole beacon came out
        // of the frame as a pale grey smear with no colour left in it at all.
        // Height carries the rest: a hot foot where the light leaves the stone,
        // a deeper, more saturated head where it has had further to travel.
        vec3 hue = mix(uCol, uCol * vec3(0.62, 0.88, 1.22), smoothstep(0.02, 0.42, h));
        vec3 col = mix(hue, vec3(0.86, 0.97, 1.06), core * 0.42);
        col = mix(col, vec3(0.80, 0.94, 1.08), spill * 0.35);
        col *= 1.0 + core * 0.85 * exp(-h * 5.0);   // the foot is the hot part

        float a = shape * grain * band * 0.86;
        a += spill * 0.62 * (0.80 + 0.20 * grain);
        a += sparks * 1.45;

        // do not blind the player standing on the dais
        a *= mix(0.40, 1.0, smoothstep(2.5, 16.0, vDist));

        gl_FragColor = vec4(col * a * uPow, a * uPow);
      }`,
  });

  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;

  // --- the pool ------------------------------------------------------------
  // The single cue that turns a bright shape in the frame into a light in the
  // world: the stone under it is lit by it. Laid flat on the dais, additive,
  // depth tested, so the steps and the four broken pillars all take it.
  const poolMat = new THREE.ShaderMaterial({
    name: 'AscentBeaconPool',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { ...shared, uPoolR: { value: POOL_R } },
    vertexShader: /* glsl */`
      uniform float uPoolR;
      varying vec2 vP;
      varying vec3 vView;
      void main(){
        vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vP = position.xz * 2.0 * uPoolR;
        // 0.34 m above the beacon's own base, which puts it a couple of
        // centimetres over the crown of the dais — on the stone, not floating
        vec3 world = base + vec3(vP.x, 0.34, vP.y);
        vView = world - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vP;
      varying vec3 vView;
      uniform float uTime, uPow, uSeed, uPoolR;
      uniform vec3 uCol;
      ${NOISE}

      void main(){
        float r = length(vP) / uPoolR;
        if (r > 1.0) discard;
        // A Gaussian pool with a hot centre, and a slow caustic crawl so the
        // stone is never lit by a static decal.
        float fall = exp(-r * r * 4.6);
        float hot  = exp(-r * r * 22.0);
        float ang = atan(vP.y, vP.x);
        float crawl = 0.78 + 0.36 * vnoise(vec2(ang * 2.4 + uSeed, r * 5.0 - uTime * 0.55));
        // and a ring of light creeping outward, so the dais reads as receiving
        // energy rather than as being painted
        float ring = exp(-pow((r - fract(uTime * 0.11)) / 0.19, 2.0)) * 0.20;
        float a = (fall * crawl + hot * 0.7 + ring * fall) * 0.40;

        // Seen edge-on a flat additive disc is a sheet of light standing on
        // nothing, which is the exact tell this whole file exists to avoid.
        // Weight it by how much of the surface the lens can actually see.
        vec3 v = normalize(vView);
        a *= smoothstep(0.012, 0.16, abs(v.y));
        a *= smoothstep(0.0, 4.0, length(vView));

        vec3 col = mix(uCol, vec3(0.90, 0.98, 1.06), hot * 0.55);
        gl_FragColor = vec4(col * a * uPow, a * uPow);
      }`,
  });
  const pool = new THREE.Mesh(disc, poolMat);
  pool.frustumCulled = false;
  pool.renderOrder = 3;
  mesh.add(pool);

  return mesh;
}
