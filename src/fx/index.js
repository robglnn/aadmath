import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GradeShader } from './shaders/grade.js';
import { BloomPass } from './passes/bloom.js';
import { VolumetricPass } from './passes/volumetrics.js';
import { SunPass } from './passes/sun.js';
import { createAtmosphere } from './atmosphere.js';
import { conditionScene } from './scene.js';
import { pickTier, prefersReducedMotion, onReducedMotionChange, makeGovernor, TIERS } from './quality.js';
import { SUN_DIR, SKY, KEY } from '../world/daylight.js';

/**
 * ASCENT's post stack.
 *
 *   scene ──▶ HDR + depth ──▶ ⊕ sun ──┬─▶ bloom pyramid ────┐
 *                                     └─▶ volumetric march ─┴─▶ grade ─▶ FXAA ─▶ screen
 *
 * There is **one hour of the day in this game and it lives in `daylight.js`**.
 * The sun vector that lights the world, the vector the sky paints its disc on,
 * the vector the shadow map is built along and the vector this file marches
 * toward are all literally the same object; the sun's colour here is `KEY`, the
 * air's colour is the sky's own horizon. Nothing in this file is allowed to
 * have a second opinion about what time it is.
 *
 * The dialogue defocus is **gone** — the file is deleted, not the flag flipped.
 * What it cost now buys a ray-marched volumetric pass that runs in every frame
 * of the game instead of during conversations, and near-field particulate that
 * is lit by the same shadow map.
 *
 * The scene lands in a linear half-float buffer (Three disables tone mapping
 * when it renders to a target), so everything downstream works in real HDR.
 * That is what makes the bloom selective for free: the island's own histogram
 * puts lit terrain around 0.35 and only the rifts, the crystals, the water
 * glints and the sun cross 1.05.
 *
 * The buffer carries a **depth texture**, and that one attachment pays for
 * three separate features: the volumetric march knows how much air stands in
 * front of every pixel, the grade's contact term knows where a silhouette sits
 * in front of what is behind it, and the aerial ramp knows how far away
 * everything is.
 *
 * There is no MSAA. A multisampled half-float buffer at retina resolution is
 * the most expensive thing you can put in a browser frame; one FXAA pass on the
 * graded image costs a fraction of it and, on a low-poly world with a strong
 * grade, is indistinguishable at rest.
 *
 * Everything here is hand-scheduled rather than run through `EffectComposer`.
 * The composer ping-pongs two buffers and would, at two points in this chain,
 * have us sampling a depth attachment belonging to the colour target we are
 * writing — a real feedback loop that ANGLE answers with a black screen. Owning
 * the order also means the passes that are switched off cost nothing at all,
 * which is most of the reason this round fits in the frame.
 */

export function createFX(engine, world, opts = {}) {
  const { renderer, scene, camera } = engine;
  let tier = opts.tier ? TIERS[opts.tier] : pickTier(opts.quality ?? 1);
  let reduced = prefersReducedMotion();

  const basePixelRatio = Math.min(devicePixelRatio || 1, tier.maxPixelRatio);
  renderer.setPixelRatio(basePixelRatio);

  const size = renderer.getSize(new THREE.Vector2());

  // ---- the one buffer everything reads ------------------------------------
  const sceneRT = new THREE.WebGLRenderTarget(2, 2, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  sceneRT.texture.name = 'ascent.hdr';
  sceneRT.texture.generateMipmaps = false;
  sceneRT.depthTexture = new THREE.DepthTexture(2, 2, THREE.UnsignedIntType);
  sceneRT.depthTexture.minFilter = THREE.NearestFilter;
  sceneRT.depthTexture.magFilter = THREE.NearestFilter;

  const ldrRT = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  ldrRT.texture.generateMipmaps = false;

  // ---- passes --------------------------------------------------------------
  const sun = new SunPass();
  sun.target = sceneRT;

  const bloom = new BloomPass({
    scale: tier.bloomScale, levels: tier.bloomLevels,
    threshold: tier.bloomThreshold, knee: tier.bloomKnee,
  });
  bloom.setSource(sceneRT.texture);

  const shafts = new VolumetricPass({ steps: tier.volumeSteps, scale: tier.volumeScale });
  shafts.setDepth(sceneRT.depthTexture);

  const grade = new ShaderPass(GradeShader);
  const fxaa = new ShaderPass(FXAAShader);

  const gu = grade.uniforms;
  gu.tBloom.value = bloom.texture;
  gu.tShafts.value = shafts.texture;
  gu.tDepth.value = sceneRT.depthTexture;
  gu.uNear.value = camera.near;
  gu.uFar.value = camera.far;

  // ---- the frame budget and the fog ---------------------------------------
  const conditioned = conditionScene(scene, { maxPointLights: tier === TIERS.low ? 1 : 2 });

  // ---- the air ------------------------------------------------------------
  const atmosphere = createAtmosphere(scene, {
    count: tier.motes,
    sunDir: (world && world.sunDir) || SUN_DIR,
  });

  // Aerial perspective is tuned to the sky's own palette — the same one the
  // sky shader, the fog and the in-scene air all read — so the far plane
  // dissolves into exactly the colour the horizon already is.
  const pal = (world && world.sky && world.sky.palette) || SKY;
  const hazeCool = pal.horizonCool.clone().lerp(pal.mid, 0.34).multiplyScalar(1.22);
  const hazeWarm = pal.horizonWarm.clone().multiplyScalar(1.02);
  gu.uHazeCool.value[0] = hazeCool.r; gu.uHazeCool.value[1] = hazeCool.g; gu.uHazeCool.value[2] = hazeCool.b;
  gu.uHazeWarm.value[0] = hazeWarm.r; gu.uHazeWarm.value[1] = hazeWarm.g; gu.uHazeWarm.value[2] = hazeWarm.b;

  // The air scatters *the key light*, in the key light's own colour — not a
  // colour picked to look nice next to it. The ambient term is the sky's mid
  // band, which is the light the air is actually receiving from above.
  const su = shafts.material.uniforms;
  su.uSunCol.value.set(KEY.color.r, KEY.color.g, KEY.color.b);
  const ambSky = pal.mid.clone().lerp(pal.horizonWarm, 0.38);
  su.uSkyCol.value.set(ambSky.r, ambSky.g, ambSky.b);
  // The sun disc is the same star: its core and aureole come from the sky's own
  // sun colour, so the disc, the shafts and the key can never disagree.
  sun.material.uniforms.uWarm.value.set(pal.sun.r * 1.0, pal.sun.g * 0.72, pal.sun.b * 0.46);

  // WHERE THE AIR IS. This is the only number in the file that decides whether
  // the pass draws shafts or a wash, and it has now been wrong in both
  // directions. At `y = 22` with a sixty-four metre scale height there was
  // still a third of a medium two hundred metres over the island, so every sky
  // ray integrated the same unoccluded constant and the volumetric buffer read
  // — literally, when you look at it on its own — as a flat cream rectangle.
  //
  // The island's coast stands at y ≈ 24, its median ground at 52, the plaza at
  // 58, the Spine at 161. The haze now pools at 34 and e-folds over 30 m, so it
  // is dense exactly through the band the trees, monoliths and arches occupy
  // (0.52 at the median ground, 0.38 at the plaza) and gone above them (0.13 at
  // a hundred metres, 0.02 at the summit). Occluders and medium share the same
  // cubic metres; that is what a shaft is.
  su.uBaseY.value = 34.0;
  su.uHeightFall.value = 30.0;
  // and the heavier mist lies on the coastal shelf below, so the gulf the plaza
  // looks out over has depth in it without any of it reaching the sky
  su.uMistY.value = 26.0;
  su.uMistFall.value = 15.0;

  // Read live: if the world ever moves its sun, everything follows it. The
  // fallback is the same vector the world would have handed us — there is one
  // sun in this game and `daylight.js` is where it is declared.
  const sunOf = () => (world && world.sunDir) || SUN_DIR;
  const sunWorld = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  const state = {
    dialogue: false,
    focus: 0,
    focusTarget: 0,
    impact: 0,
    impactBad: 0,
    // the seal: elapsed seconds since the statement held, and how big it was
    sealT: -1,
    sealBig: 0,
    sealAmp: 0,
    seal: 0,
    focusEff: 0,
    w: Math.max(2, size.x),
    h: Math.max(2, size.y),
  };

  const dims = new THREE.Vector2();

  const governor = makeGovernor({
    target: 58,
    onScale: () => { applyPixelRatio(); },
  });

  applyTier();
  applySize(size.x, size.y);

  function applyPixelRatio() {
    const pr = Math.max(0.7, basePixelRatio * governor.scale);
    if (Math.abs(renderer.getPixelRatio() - pr) < 0.001) return;
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    applySize(innerWidth, innerHeight);
  }

  function applyTier() {
    bloom.renderScale = tier.bloomScale;
    bloom.maxLevels = tier.bloomLevels;
    bloom.setThreshold(tier.bloomThreshold, tier.bloomKnee);
    gu.uBloom.value = tier.bloomStrength;

    shafts.renderScale = tier.volumeScale;
    shafts.setSteps(tier.volumeSteps);
    shafts.material.uniforms.uDensity.value = tier.volumeDensity;

    gu.uContact.value = tier.contact;

    fxaa.enabled = tier.fxaa;

    grade.material.defines.USE_CONTACT = tier.contact > 0 ? 1 : 0;
    grade.material.needsUpdate = true;

    gu.uAberration.value = tier.aberration * (reduced ? 0.35 : 1);
    gu.uGrain.value = tier.grain * (reduced ? 0.5 : 1);
    gu.uGrainAnim.value = reduced ? 0 : 1;

    atmosphere.setCount(tier.motes);
    atmosphere.setMotion(reduced ? 0.25 : 1);
    applySize(state.w, state.h);
  }

  function applySize(w, h) {
    state.w = Math.max(2, w); state.h = Math.max(2, h);
    renderer.getDrawingBufferSize(dims);
    const bw = Math.max(2, dims.x), bh = Math.max(2, dims.y);

    sceneRT.depthTexture.image.width = bw;
    sceneRT.depthTexture.image.height = bh;
    sceneRT.setSize(bw, bh);
    ldrRT.setSize(fxaa.enabled ? bw : 2, fxaa.enabled ? bh : 2);
    bloom.setSize(bw, bh);
    shafts.setSize(bw, bh);

    const aspect = bw / bh;
    sun.setAspect(aspect);
    fxaa.material.uniforms.resolution.value.set(1 / bw, 1 / bh);
    atmosphere.setViewportHeight(bh);
    gu.uResolution.value[0] = bw;
    gu.uResolution.value[1] = bh;
    gu.uAspect.value = aspect;
    gu.uShaftTexel.value[0] = 1 / Math.max(2, shafts.renderTarget.width);
    gu.uShaftTexel.value[1] = 1 / Math.max(2, shafts.renderTarget.height);
    // vertical pixels per metre at one metre: what lets the contact term size
    // its pocket in metres rather than in a fixed slice of the frame
    gu.uProjScale.value = bh * 0.5 / Math.tan(camera.fov * Math.PI / 360);
  }

  const offReduced = onReducedMotionChange((v) => { reduced = v; applyTier(); });

  /** Update every frame, before the stack renders. */
  let frame = 0;
  function update(dt, time) {
    governor.tick(dt);
    conditioned.update(camera, ++frame);

    gu.uTime.value = time;
    shafts.material.uniforms.uTime.value = time;
    atmosphere.update(dt, time, camera);

    // --- the dialogue cool-down -------------------------------------------
    // While a rift is talking the world steps back: exposure dips, saturation
    // comes down, the vignette closes a little and the air stops throwing
    // beams across the conversation. It does **not** blur — there is no
    // defocus pass in this game any more, so nothing the player is standing on
    // can ever be softened by a piece of UI.
    const k = reduced ? 1 : Math.min(1, dt * (state.dialogue ? 4.5 : 16));
    state.focus += (state.focusTarget - state.focus) * k;
    if (!state.dialogue && state.focus < 0.02) state.focus = 0;

    // --- the seal ----------------------------------------------------------
    // THE moment of this product. A learner answered a hard question and the
    // statement held; the card says so in words and the sky says so in light.
    //
    // The envelope is shaped against the SOUND, note for note. `Stings.seal()`
    // spends 200 ms drawing breath and lands its chord at +0.20 s — so this
    // rises over exactly those 200 ms and peaks on the same downbeat, holds
    // while the harp roll climbs, then leaves over the chord's own release.
    // Two systems arriving on the same frame is the entire difference between
    // "a sound played and a thing flashed" and "one event".
    if (state.sealT >= 0) {
      state.sealT += dt;
      const T = state.sealT;
      const decay = state.sealBig ? 2.9 : 1.55;
      let e;
      if (T < 0.20) { const a = T / 0.20; e = a * a * (3 - 2 * a); }   // the inhale
      else if (T < 0.20 + 0.26) e = 1;                                  // the landing
      else {
        const d = (T - 0.46) / decay;
        e = d >= 1 ? 0 : (1 - d) * (1 - d);                             // the room finishing it
      }
      state.seal = e * state.sealAmp;
      if (T > 0.46 + decay) { state.sealT = -1; state.seal = 0; }
    }
    const seal = state.seal;
    gu.uSeal.value = seal;
    // While the light is up the bloom pyramid is allowed to run hot, so every
    // rift column, every crystal and every water glint on the island blooms at
    // once. This costs nothing: it is one multiply on a pass that was already
    // running at the same resolution.
    gu.uBloom.value = tier.bloomStrength * (1 + seal * (state.sealBig ? 0.85 : 0.45));
    // And the near field lights up — the air itself catches it.
    atmosphere.setAmount(1 + seal * (state.sealBig ? 1.7 : 0.85));

    // The world steps back while a rift is talking. On the seal it steps
    // FORWARD again, under the card, for a second and a half: colour returns,
    // the exposure comes back up, the shafts come back through the conversation.
    // The learner is looking at their own equation and the island behind it is
    // visibly reacting to it.
    const focusEff = state.focus * (1 - seal * 0.78);
    state.focusEff = focusEff;
    gu.uFocusBlend.value = focusEff;

    // --- the answer beat ---------------------------------------------------
    if (state.impact > 0) {
      state.impact = Math.max(0, state.impact - dt * 2.2);
      const k2 = state.impact * state.impact;
      gu.uImpact.value = k2;
      const amp = reduced ? 0 : k2 * (state.impactBad ? 0.014 : 0.005);
      gu.uShake.value[0] = Math.sin(time * 74.0) * amp;
      gu.uShake.value[1] = Math.cos(time * 57.0) * amp * 0.62;
      if (state.impact === 0) { gu.uShake.value[0] = 0; gu.uShake.value[1] = 0; }
    }

    // --- where is the star -------------------------------------------------
    const sunDir = sunOf();
    atmosphere.setSun(sunDir);
    if (world && world.sun) atmosphere.setShadow(world.sun);
    camera.getWorldDirection(fwd);
    const facing = fwd.dot(sunDir);
    sunWorld.copy(camera.position).addScaledVector(sunDir, 2400);
    ndc.copy(sunWorld).project(camera);
    const sx = ndc.x * 0.5 + 0.5, sy = ndc.y * 0.5 + 0.5;
    gu.uSunUV.value[0] = sx;
    gu.uSunUV.value[1] = sy;
    const off = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));

    // --- the air -----------------------------------------------------------
    // The volumetric march does not care where the star is on screen: it asks
    // the sun's own shadow map whether each cubic metre of air is lit, so it
    // has something to say with the sun behind you, off the corner, or hidden
    // behind a ridge. That is the entire reason it exists. The only thing that
    // still fades it is a rift talking — the frame belongs to the conversation.
    shafts.setCamera(camera);
    shafts.setSun(sunDir);
    if (world && world.sun) shafts.setLight(world.sun);
    const volFade = 1 - state.focusEff * 0.62;
    gu.uShaftStrength.value = tier.volumeStrength * volFade * (1 + state.seal * 0.55);
    shafts.enabled = shafts.ready && shafts.allowed !== false;

    const discFade = smoothstep(-0.02, 0.22, facing) * (1 - smoothstep(0.72, 1.05, off));
    sun.enabled = discFade > 0.004 && sun.allowed !== false;
    sun.setIntensity(discFade * (1 - state.focusEff * 0.6) * (1 + state.seal * 0.5));
    sun.setSun(ndc.x, ndc.y);
    gu.uSunVis.value = discFade * (1 - state.focusEff * 0.8) * (1 + state.seal * 0.6);

  }

  /** Render the frame, hand-scheduled. */
  renderer.info.autoReset = false;
  function render() {
    renderer.info.reset();

    // 1. the world, into linear HDR with a depth attachment
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);

    // 2. the star, added before the pyramid so it blooms correctly
    if (sun.enabled) sun.render(renderer, null, sceneRT);

    // 3. everything that reads depth
    if (shafts.enabled) shafts.render(renderer);

    // 4. the pyramid
    if (bloom.enabled) bloom.render(renderer, null, sceneRT);

    // 5. the look
    grade.renderToScreen = !fxaa.enabled;
    grade.render(renderer, ldrRT, sceneRT);
    if (fxaa.enabled) {
      fxaa.renderToScreen = true;
      fxaa.render(renderer, null, ldrRT);
    }
    renderer.setRenderTarget(null);
  }

  return {
    render, update, atmosphere,
    setSize: applySize,
    passes: { sun, bloom, shafts, volumetrics: shafts, grade, fxaa },
    // the critic harness reads the HDR buffer through this
    composer: { renderTarget2: sceneRT, renderTarget1: ldrRT },
    get tier() { return tier.name; },
    get renderScale() { return governor.scale; },

    /**
     * Rift dialogue: cool the world down so the conversation carries the frame.
     * Exposure, saturation and the volumetrics step back; nothing is blurred.
     */
    setDialogue(on) {
      state.dialogue = !!on;
      state.focusTarget = on ? 1 : 0;
    },

    /** A one-beat lens kick when an answer lands. */
    impact(kind = 'good') {
      const bad = kind === 'bad' || kind === false;
      state.impactBad = bad ? 1 : 0;
      state.impact = reduced ? 0.45 : 1.0;
      gu.uImpactBad.value = state.impactBad;
      gu.uImpact.value = state.impact * state.impact;
    },

    /**
     * A statement held. The world takes the light.
     *
     * This is deliberately NOT the same event as `impact('good')` above, and
     * running both is the point. The impact is a lens kick: 450 ms, a ring out
     * of the centre, over before you have read the sentence. The seal is the
     * two seconds underneath it — the sky brightening, the gold arriving in the
     * highlights, the vignette opening, the shafts coming back through the
     * conversation. One is a hit; this is the consequence.
     *
     * @param {object} o
     *   mastery 0..1 — how much of this skill now stands. A first correct
     *           answer on a shaky line gets a real beat but not the big one.
     *   big     true when this answer closed the skill outright.
     */
    seal(o = {}) {
      const big = !!o.big;
      const m = Math.max(0, Math.min(1, o.mastery ?? 0.5));
      state.sealBig = big ? 1 : 0;
      // Escalation, so the four hundredth seal is not the first one again: an
      // ordinary correct answer is a glow, an answer that all but finishes a
      // line is most of the way there, and mastery is the whole sky.
      state.sealAmp = (big ? 1 : 0.42 + m * 0.34) * (reduced ? 0.45 : 1);
      state.sealT = 0;
    },

    setTier(name) {
      if (!TIERS[name] || TIERS[name] === tier) return;
      tier = TIERS[name];
      applyTier();
    },

    /** Test hook: pin the render scale so a measurement is comparable. */
    pinScale(s) { governor.set(s); },

    /** Development inspection: 0 off, 1 volumetrics, 3 bloom. */
    debug(n) { gu.uDebug.value = n | 0; },

    dispose() {
      offReduced();
      atmosphere.dispose();
      sun.dispose(); bloom.dispose(); shafts.dispose();
      grade.dispose?.(); fxaa.dispose?.();
      sceneRT.dispose(); ldrRT.dispose();
    },
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
