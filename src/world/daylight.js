import * as THREE from 'three';

/**
 * THE HOUR.
 *
 * There is exactly one time of day in ASCENT and it is defined here. Every
 * other module reads it; none of them gets to have an opinion.
 *
 * Before this file existed the frame was lit at two different hours at once:
 * the sky shader painted a deep navy zenith with stars and a moon while the
 * key light came in bright and neutral from near the top of the sky, and three
 * separate modules each set `scene.fog` to a different colour on the way past.
 * A viewer cannot name that fault, but they can see it — it is exactly what
 * makes a real-time frame read as "a game" rather than as a place.
 *
 * The hour is **late golden hour**: the sun twenty-two degrees up on a WNW
 * bearing, so every vertical thing on the island throws a shadow two and a half
 * times its own height, warm on the sunward face and cool in the shade. Every
 * number below follows from that one decision.
 *
 * Who reads what:
 *   SUN_DIR    world.js (the DirectionalLight), sky.js (disc, aureole, cloud
 *              lighting), ranges.js (baked facing), air.js (haze bearing),
 *              fx/index.js (shafts origin, sun flare, back-lit motes)
 *   SKY        sky.js, and fx/index.js so the post haze dissolves the far
 *              plane into exactly the colour the horizon already is
 *   AIR        air.js (per-material aerial perspective) and the grade's ramp
 *   FOG        set once, in sky.js. Nothing else may touch scene.fog.
 */

/** Unit vector *toward* the sun. Twenty-two degrees up, bearing WNW. */
export const SUN_DIR = new THREE.Vector3(-0.740, 0.375, -0.500).normalize();

/** Elevation in radians, for anything that wants to reason about shadow length. */
export const SUN_ELEVATION = Math.asin(SUN_DIR.y);

/** The key. Warm, and strong enough to be unmistakably the only key. */
export const KEY = { color: new THREE.Color('#ffd6a1'), intensity: 5.6 };

/**
 * The fill, in three parts, and the ratio between them and the key is the
 * whole look. It used to run at about 1.5:1, which is an overcast afternoon
 * with a warm gel on it — flat, no modelling, no rim. This runs near 3:1.
 *
 *  hemi    the sky dome itself, cool from above, warm bounce from the ground
 *  bounce  a cheap directional from the anti-sun bearing standing in for the
 *          light the lit ground throws back onto leeward faces, without which
 *          every east slope collapses to black
 *  rim     a warm kicker placed *behind whatever the lens is looking at*, so
 *          grass tips, rock edges and the cadet's shoulders all carry a hot
 *          contour against the shade. This is the light that makes a low sun
 *          look low.
 */
export const HEMI = {
  sky: new THREE.Color('#8fb2e0'),
  ground: new THREE.Color('#6f5d47'),
  intensity: 0.60,
};
export const BOUNCE = { color: new THREE.Color('#ffb887'), intensity: 0.80 };
export const RIM = { color: new THREE.Color('#ffd2a4'), intensity: 1.05 };

/**
 * The sky's own palette. The zenith is deep, but it is a *daylight* deep —
 * lift it any darker and the stars have to come out, and then it is dusk up
 * there and golden hour down here.
 */
export const SKY = {
  zenith: new THREE.Color('#284a86'),
  mid: new THREE.Color('#5789c8'),
  horizonWarm: new THREE.Color('#ffc38a'),
  horizonCool: new THREE.Color('#c9a7bd'),
  sun: new THREE.Color('#ffd9a8'),
  fog: new THREE.Color('#b9c6de'),
};

/**
 * Stars at golden hour: essentially none. A couple of the brightest points
 * near the zenith is defensible on an alien world with a gas giant in frame;
 * a full field of them is a different hour and reads as a bug.
 */
export const STARS = 0.11;
export const GALACTIC = 0.045;

/**
 * `scene.fog` is set exactly once, by sky.js. It is switched on so that
 * `USE_FOG` is defined and `air.js` gets to run; the colour and density below
 * are what the built-in chunks *would* have used, kept honest so that anything
 * rendering without the replacement still lands in the right family.
 */
export const FOG = { color: SKY.fog, density: 0.00045 };

/**
 * THE AIR, in the renderer's linear working space.
 *
 * The rule that was being broken: **air must never darken what is behind it.**
 * The zenith term used to be a dark navy, so a snow peak two kilometres out
 * got *dimmer* the further away it stood — which is why a kilometre of mountain
 * measured darker than the grass at the player's feet and read as a wall three
 * metres away. Every colour here is at or above the luminance of the terrain it
 * is allowed to veil, so distance can only ever lift and cool.
 */
export const AIR = {
  warm: [1.10, 0.79, 0.56],    // looking into the light
  cool: [0.47, 0.59, 0.89],    // the light behind you
  zenith: [0.43, 0.57, 0.95],  // looking up through it — brighter than any ridge
  ground: [0.55, 0.56, 0.69],  // down into the gulf
  // The split between the two terms is the whole trick. The near term is the
  // dust lying on the island itself and is deliberately weak: this island is
  // 170 m across, and hazing its own peak is how a place turns milky. The far
  // term is the depth of atmosphere out to the ranges, and it is allowed to do
  // almost all the work — that is what separates 700 m from 2,800 m.
  near: 18.0,
  nearAmt: 0.15, nearScale: 190.0,
  // The far term used to spend two thirds of its budget inside a kilometre and
  // charge half of it in chroma, which meant every landmass past five hundred
  // metres arrived as the same white paper cone — three differently-coloured
  // regions on the horizon and not one of them still had a hue. Aerial
  // perspective is supposed to *separate* depth bands, so it now runs longer,
  // shallower, and takes far less of its toll in saturation: at nine hundred
  // metres a landmass keeps three fifths of its own colour instead of a third.
  farAmt: 0.30, farScale: 2000.0,
  max: 0.78,
  chroma: 0.26,                // how much of the haze is paid in saturation first
  scaleHeight: 900.0,
  baseY: -70.0,
};

/** Sun / sky colours handed to the shader-driven cover (grass, water). */
export const COVER = {
  grassSun: new THREE.Color('#fff0d4'),
  grassSky: new THREE.Color('#9cbdee'),
  waterSky: new THREE.Color('#9dbcea'),
  waterSun: new THREE.Color('#ffe3bd'),
};
