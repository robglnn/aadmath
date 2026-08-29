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
export const KEY = { color: new THREE.Color('#ffd6a1'), intensity: 4.90 };

/**
 * THE CAST SHADOW IS NOT ALLOWED TO BE EMPTY.
 *
 * `light.shadow.intensity` is three's own floor — `getShadow()` ends
 * `return mix( 1.0, shadow, shadowIntensity )` — so this is the fraction of the
 * key a cast shadow is allowed to remove. It costs a uniform and nothing else.
 *
 * WHY IT IS NOT 1.0, MEASURED RATHER THAN ARGUED. On the shipped build the
 * arrival plaza's own obelisk threw a shadow across half the frame that came
 * out of the tone map at RGB 0,0,0 — a critic's *"dead region with a hard
 * edge"*, in the first thirty seconds of the game. Switching `castShadow` off
 * in the running build took that framing from **57.9% of the frame at RGB
 * 0,0,0 to 0.00%**, which is the proof that the dead region IS the cast shadow
 * and not a missing bounce term.
 *
 * AND THE OBVIOUS FIX WAS TRIED FIRST AND DISPROVED. An `AmbientLight` at
 * 0.70 — more than the entire sky fill — moved the same frame from 65.9% black
 * to 55.5%, because a shadow sitting at 1.5% of the lit value is not made
 * legible by doubling it: it needs about six times more light, and six times
 * the fill is an overcast afternoon. A floor under the shadow buys the same
 * six times, in the shadow only, for nothing.
 *
 * 0.70 leaves the cadet's own contact shadow at roughly half the luminance of
 * the ground beside it, which is a shadow anybody can see — the thing three
 * critics said was missing — while the island's own hillsides keep their shape.
 * `src/world/grass.js` applies the same floor by hand, because a blade shader
 * is outside three's lighting and a meadow that stays black inside a shadow the
 * ground under it has lifted is worse than either.
 */
export const SHADE = { intensity: 0.70 };

/**
 * The fill, in three parts, and the ratio between them and the key is the
 * whole look. It used to run at about 1.5:1, which is an overcast afternoon
 * with a warm gel on it — flat, no modelling, no rim.
 *
 *  hemi    the sky dome itself, cool from above, warm bounce from the ground
 *  bounce  a cheap directional from the anti-sun bearing standing in for the
 *          light the lit ground throws back onto leeward faces, without which
 *          every east slope collapses to black
 *  rim     a warm kicker placed *behind whatever the lens is looking at*, so
 *          grass tips, rock edges and the cadet's shoulders all carry a hot
 *          contour against the shade. This is the light that makes a low sun
 *          look low.
 *
 * THE FILL WAS TWENTY TIMES UNDER THE KEY AND THAT IS WHY THE SHADOWS WERE
 * EMPTY. At 5.6 the key delivers about 1.4 of irradiance onto flat ground at a
 * 22-degree sun; the fill delivered about 0.07 onto an anti-sun slope once the
 * terrain's own occlusion had taken its share. A surface lit only by that lands
 * at RGB 3 through ACES, which is not a dark surface — it is an absent one.
 * The key is down an eighth and the fill is up, so the LIT half of the frame
 * lands within a few percent of where it was (measured on the plaza: mean
 * luminance 95 before, 103 after) and the shaded half has something in it.
 */
export const HEMI = {
  sky: new THREE.Color('#8fb2e0'),
  ground: new THREE.Color('#6f5d47'),
  intensity: 1.10,
};
export const BOUNCE = { color: new THREE.Color('#ffb887'), intensity: 1.08 };

/**
 * THE DECK — the fourth light, and the one this world had forgotten it needs.
 *
 * Every light above is light from above. On a planet that is the whole story:
 * what faces down faces dirt, and dirt is dark. ASCENT is not on a planet. It
 * is a shard hanging over a lit cloud sea (src/world/deeps.js), and after the
 * sun the brightest thing in any frame is the deck BELOW the horizon line.
 *
 * Without this term every downward face in the game — the island's own keel,
 * the undersides of the floating shards, the overhangs — came out of the tone
 * map at RGB 0,0,0: not dark, absent, in runs a critic measured at up to a
 * third of the frame and called *"a dead region with a hard edge"*.
 *
 * It is not a fill light and it must not be used as one. It is scaled by how
 * far a surface faces DOWN, so it adds nothing at all to the upward-facing
 * ground where the cadet's shadow is read.
 *
 * ---- AND IT WAS A TERM IN TWO SHADERS, NOT A LIGHT --------------------------
 *
 * That is the defect this constant kept having. `intensity` below is a number
 * two hand-written shaders multiply their own albedo by — terrain.js and
 * grass.js, and NOBODY ELSE. The island got its deck; the seventy-odd other
 * `MeshStandardMaterial`s in `src/` — every prop, every hoodoo, every landmark,
 * every floating shard, every rift frame, every span, the cadet himself — got
 * nothing, because there was nothing for them to get. Two consecutive critics
 * described the result independently: *"a dead region with a hard edge"*, and
 * the undersides of the floating shards *"can occupy a fifth of the frame"*.
 * Both were looking at drawn solids, not at the island.
 *
 * A light is delivered by the renderer to everything that is lit, including
 * whatever another lane adds tomorrow. So the deck is now BOTH, from one
 * declaration, in the two units the two mechanisms count in:
 *
 *   `light`     three.js `HemisphereLight` intensity, pointed straight DOWN,
 *               with a black ground colour so nothing that faces up receives
 *               a photon of it. Created once, in world.js, beside the other
 *               three. This is what reaches the whole scene graph.
 *   `intensity` the same light as a hand-written shader has to add it: a
 *               multiplier on albedo, i.e. irradiance / π. Read by grass.js,
 *               which is a raw ShaderMaterial outside three's lighting
 *               entirely, and by terrain.js, which adds the deck AFTER its own
 *               ambient occlusion so that the cadet's shadow keeps its
 *               contrast on the ground it is read on.
 *
 * The conversion between them is π, and the two numbers are set so that a
 * fully down-facing prop gets the same deck the island's own keel already had:
 * terrain applies `intensity · 0.55` to a down-face, so the matching light
 * intensity is 0.55 · 0.30 · π ≈ 0.52. It is set a little under that, because
 * a hemisphere also lights VERTICAL faces at half weight — which the terrain
 * term only did at 0.16 — and vertical anti-sun faces are the other half of
 * what was black.
 */
export const DECK = { color: new THREE.Color('#cfd8ea'), intensity: 0.30, light: 0.68 };
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
