import * as THREE from 'three';
import { AIR } from './daylight.js';

/**
 * THE AIR.
 *
 * Aerial perspective is the single thing that separates a diorama from a
 * landscape. Breath of the Wild's Great Plateau reveal is five depth bands,
 * each one lighter, cooler and lower in contrast than the one in front of it,
 * until the Hebra range is a pale lavender wash you could mistake for cloud.
 * Three.js gives you one flat grey `fogColor` instead, which does the opposite:
 * it *greys* distance rather than lightening it, and it has no idea which way
 * the sun is, so the hills toward the light and the hills away from it fade to
 * exactly the same mud.
 *
 * This replaces the built-in fog chunks, once, globally, before anything has
 * compiled. Every lit material, every instanced tree, the grass, the water, the
 * player and anything the build system spawns all inherit the same air, because
 * they all `#include <fog_fragment>` whether they know it or not.
 *
 * What the replacement adds:
 *   - **Bearing.** The haze is gold toward the sun and cornflower away from it,
 *     using the same two colours the sky shader paints its horizon with, so a
 *     ridge dissolving into the distance dissolves into the sky *behind it*
 *     rather than into a grey card.
 *   - **Elevation.** Looking up, the haze tends toward the sky's mid blue;
 *     looking down into the gulf, toward a warmer, denser ground haze.
 *   - **Altitude falloff.** The air is a fluid with a scale height. Peaks stand
 *     out of it; valleys drown in it. Without this, climbing the Spine makes
 *     the whole world go uniformly milky.
 *   - **A short scale.** This island is a hundred and seventy metres across.
 *     Real-world haze over that distance is nothing, so the scale height is
 *     tuned for the island we have rather than for Earth: half the effect is
 *     spent inside two hundred metres, which is what puts the far snow peak a
 *     full value-step above the rock at your feet.
 */

let installed = false;

/**
 * @param {THREE.Vector3} sunDir  unit vector *toward* the sun
 * @param {object} opts
 */
export function installAir(sunDir, opts = {}) {
  if (installed) return;
  installed = true;

  const {
    // colours are authored in the renderer's working space, and every one of
    // them comes from daylight.js so the air can never disagree with the sky
    warm = AIR.warm,       // the air looking into the light
    cool = AIR.cool,       // the air with the light behind you
    zenith = AIR.zenith,   // looking up through it
    ground = AIR.ground,   // looking down into the gulf
    near = AIR.near,       // metres before the air starts to bite
    // Two terms, because one exponential cannot do both jobs. The near term is
    // the dust and moisture lying on the island itself — it has to be strong
    // enough that a snow peak a hundred and fifty metres off is visibly a value
    // step paler than the rock at your boots, and it saturates by two hundred
    // metres so it never touches the far bands. The far term is the depth of
    // atmosphere between the coast and the ranges, and it is what separates
    // seven hundred metres from twenty-seven hundred.
    nearAmt = AIR.nearAmt, nearScale = AIR.nearScale,
    farAmt = AIR.farAmt, farScale = AIR.farScale,
    max = AIR.max,                 // never fully erase a silhouette
    // Real distance eats *chroma* faster than it eats value. Spending part of
    // the haze on desaturation before any of it is spent on colour is what
    // separates a mountain that is far away from a mountain with a grey sheet
    // in front of it.
    chroma = AIR.chroma,
    scaleHeight = AIR.scaleHeight, // how fast the air thins with altitude
    baseY = AIR.baseY,             // the level the air pools at
  } = opts;

  const b = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const f = (n) => n.toFixed(4);
  const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogVDir;
#endif`;

  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogVDir = mvPosition.xyz;
#endif`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogVDir;
  #ifdef AIR_THIN
    // See thinAir() below. Opt-in, and declared only when a material has asked
    // for it, so nothing else in the world can end up reading an unset uniform
    // (which WebGL initialises to zero — i.e. no air at all, everywhere).
    uniform float uAirThin;
  #endif
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif

  const vec2  AIR_SUNB  = vec2(${f(b.x)}, ${f(b.y)});
  const vec3  AIR_WARM  = ${v3(warm)};
  const vec3  AIR_COOL  = ${v3(cool)};
  const vec3  AIR_ZEN   = ${v3(zenith)};
  const vec3  AIR_GRND  = ${v3(ground)};
  const float AIR_NEAR  = ${f(near)};
  const float AIR_A1    = ${f(nearAmt)};
  const float AIR_S1    = ${f(nearScale)};
  const float AIR_A2    = ${f(farAmt)};
  const float AIR_S2    = ${f(farScale)};
  const float AIR_MAX   = ${f(max)};
  const float AIR_CHROMA= ${f(chroma)};
  const float AIR_SH    = ${f(scaleHeight)};
  const float AIR_BASE  = ${f(baseY)};

  /** The colour the sky would be, along this world-space view ray. */
  vec3 ascentAir(vec3 wd) {
    float az = dot(normalize(vec2(wd.x, wd.z) + vec2(1e-5)), AIR_SUNB);
    vec3 c = mix(AIR_COOL, AIR_WARM, smoothstep(-0.60, 0.94, az));
    c = mix(c, AIR_ZEN, smoothstep(0.02, 0.55, wd.y));
    c = mix(c, mix(AIR_GRND, c, 0.35), smoothstep(-0.04, -0.50, wd.y));
    return c;
  }

  /** 0 at the eye, AIR_MAX at the horizon; thinner the higher you both are. */
  float ascentAirAmount(float dist, float y0, float y1) {
    float ym = max(0.5 * (y0 + y1) - AIR_BASE, 0.0);
    float thin = exp(-ym / AIR_SH);
    float x = max(0.0, dist - AIR_NEAR) * thin;
    float f = AIR_A1 * (1.0 - exp(-x / AIR_S1)) + AIR_A2 * (1.0 - exp(-x / AIR_S2));
    return min(f, AIR_MAX);
  }
#endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  {
    vec3 wd = normalize(vFogVDir * mat3(viewMatrix));
    float fy = cameraPosition.y + wd.y * vFogDepth;
    float fogFactor = ascentAirAmount(vFogDepth, cameraPosition.y, fy);
    #ifdef AIR_THIN
      fogFactor *= uAirThin;
    #endif
    // chroma goes first, then value. A distant range must lose its colour
    // before it loses its shape, which is what keeps a kilometre of mountain
    // from reading as a painted flat three metres away.
    float airLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(airLum), fogFactor * AIR_CHROMA);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, ascentAir(wd), fogFactor);
  }
#endif`;
}

/**
 * THIN AIR, for the things that are supposed to be silhouettes.
 *
 * Every colour in `AIR` is authored at or above the luminance of the ground it
 * veils, on the rule that distance must never *darken*. That rule is right for
 * a ridge dissolving into the sky behind it, and it has one consequence nobody
 * costed: it puts a floor under everything far away. At a kilometre the haze
 * contributes about a fifth of a luminance-1.0 colour, which is brighter than
 * the entire authored palette of a black obsidian massif — so the one landmass
 * in this world that exists to be a hard dark shape against a bright horizon
 * arrived as a pale grey card, indistinguishable from the fog it was standing
 * in. Four critics in a row read it as "the far worlds are occluded". It was
 * not occluded. It was the same colour as the air.
 *
 * A backlit mountain is not veiled by the air in front of it in the same way a
 * lit one is, because most of what haze does at this range is scatter *sunlight*
 * into the line of sight, and it does that far more strongly on the sunward
 * side than on the shadowed side. Letting a material ask for a fraction of the
 * air is therefore not a cheat, and it is the only lever that can put a value
 * below the fog floor back on the screen.
 *
 * @param {THREE.Material} mat
 * @param {number} amount 1 = the full air, 0 = vacuum.
 */
export function thinAir(mat, amount) {
  const prev = mat.onBeforeCompile;
  mat.defines = { ...(mat.defines || {}), AIR_THIN: 1 };
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uAirThin = { value: amount };
  };
  mat.needsUpdate = true;
  return mat;
}
