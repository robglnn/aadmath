/**
 * The look — one pass, in the order a camera and a colourist actually work.
 *
 *   lens        shake, impact pinch, peripheral chromatic aberration
 *   contact     six depth taps of grounding, ambient only
 *   air         aerial perspective: a real depth ramp, sun-tinted
 *   volume      ray-marched in-scattering, upsampled bilaterally on depth
 *   bloom       the pyramid, added in linear space
 *   flare       ghosts along the sun→centre axis
 *   exposure → ACES
 *   grade       black point, split tone, filmic S, saturation
 *   impact      the one-beat answer kick
 *   vignette
 *   sRGB → luma grain
 *
 * Two things carry most of the frame's identity.
 *
 * **The aerial ramp.** Exponential vertex fog on a low-poly island gives a
 * uniform grey veil. What separates BOTW's three depth planes is that the far
 * plane is paler, cooler, lower-contrast and *less saturated* than the near
 * one, and that the air warms toward the sun. Doing that per pixel from depth
 * costs one fetch and buys the entire sense of scale. Crucially it starts
 * *late* — nothing inside fifty-five metres is touched at all — so near grass
 * stays saturated instead of being washed with everything else, and it never
 * saturates, so a ridge at eight hundred metres still reads as nearer than a
 * peak at two thousand.
 *
 * The defocus pass that used to sit between the contact term and the air is
 * gone — deleted, not disabled. A rack focus on a dialogue is a lens effect
 * that never once made this frame better, and the millisecond it was holding
 * open now belongs to the volumetric march and the near-field particulate,
 * both of which are visible in every single shot.
 *
 * **The split tone.** Warm in the light, cyan in the shadow. That single
 * decision is what makes every silhouette in the frame separate from what is
 * behind it at any distance, and it is most of what people are seeing when they
 * say a game "has a look".
 */
export const GradeShader = {
  name: 'AscentGradeShader',

  defines: { USE_CONTACT: 1 },

  uniforms: {
    tDiffuse: { value: null },
    tBloom: { value: null },
    tShafts: { value: null },
    tDepth: { value: null },

    uResolution: { value: [1, 1] },
    uShaftTexel: { value: [1 / 400, 1 / 225] },
    uTime: { value: 0 },
    uAspect: { value: 1.78 },

    // camera
    uNear: { value: 0.1 },
    uFar: { value: 4000 },

    // atmosphere
    uShaftStrength: { value: 0 },
    uSunUV: { value: [0.5, 1.2] },
    uSunVis: { value: 0 },
    uHazeCool: { value: [0.30, 0.42, 0.70] },
    uHazeWarm: { value: [1.25, 0.86, 0.58] },
    uHazeStart: { value: 55.0 },
    uHazeScale: { value: 1 / 420 },
    uHazeMax: { value: 0.94 },

    // bloom / contact occlusion
    uBloom: { value: 0.56 },
    uContact: { value: 0.55 },
    // vertical pixels per metre at one metre — H / (2 tan(fov/2)) — so the
    // contact term can work in metres instead of in screen pixels
    uProjScale: { value: 900.0 },

    // lens + grade
    uExposure: { value: 1.30 },
    uAberration: { value: 0.0013 },
    uVignette: { value: 0.80 },
    uGrain: { value: 0.020 },
    uGrainAnim: { value: 1 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 0.36 },
    uBlackPoint: { value: 0.014 },
    uFocusBlend: { value: 0 },

    // 0 off, 1 shafts, 3 bloom  (development inspection only)
    uDebug: { value: 0 },

    // the answer beat
    uImpact: { value: 0 },
    uImpactBad: { value: 0 },
    uShake: { value: [0, 0] },
    // THE SEAL. Not the lens kick above — the slow one underneath it, the
    // half-second where the sky agrees with what the cadet just wrote.
    uSeal: { value: 0 },
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,

  fragmentShader: /* glsl */`
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tBloom, tShafts, tDepth;
    uniform vec2 uResolution, uSunUV, uShaftTexel, uShake;
    uniform vec3 uHazeCool, uHazeWarm;
    uniform float uNear, uFar, uAspect;
    uniform float uShaftStrength, uSunVis;
    uniform float uHazeStart, uHazeScale, uHazeMax;
    uniform float uBloom, uContact, uProjScale;
    uniform float uTime, uExposure, uAberration, uVignette, uGrain, uGrainAnim;
    uniform float uSaturation, uContrast, uBlackPoint, uFocusBlend;
    uniform float uImpact, uImpactBad, uDebug, uSeal;

    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    float rawDepth(vec2 uv){ return texture2D(tDepth, uv).x; }
    float eyeDist(vec2 uv){
      float d = rawDepth(uv);
      if (d >= 1.0) return uFar;
      float z = 2.0 * d - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    // --- ACES filmic, Stephen Hill's fit of the full RRT/ODT ------------------
    const mat3 ACES_IN = mat3(
      0.59719, 0.07600, 0.02840,
      0.35458, 0.90834, 0.13383,
      0.04823, 0.01566, 0.83777);
    const mat3 ACES_OUT = mat3(
       1.60475, -0.10208, -0.00327,
      -0.53108,  1.10813, -0.07276,
      -0.07367, -0.00605,  1.07602);

    vec3 rrtOdtFit(vec3 v){
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 acesFitted(vec3 c){
      c = ACES_IN * c;
      c = rrtOdtFit(c);
      return clamp(ACES_OUT * c, 0.0, 1.0);
    }

    vec3 linearToSRGB(vec3 c){
      return mix(c * 12.92, 1.055 * pow(max(c, 1e-5), vec3(1.0/2.4)) - 0.055,
                 step(0.0031308, c));
    }

    float hash13(vec3 p){
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    void main(){
      vec2 base = vUv + uShake;
      vec2 d0 = base - 0.5;
      float r2 = dot(d0, d0);

      // --- lens: a wrong answer punches the glass ---------------------------
      vec2 uv = base - d0 * (uImpact * uImpact * 0.055 * smoothstep(0.0, 0.42, r2));
      uv = clamp(uv, 0.0005, 0.9995);

      // --- transverse chromatic aberration, dead zero across the middle -----
      // Fringing on a high-frequency field (distant grass, sand speckle) is the
      // fastest way to make a frame look like a compression artefact, so this
      // does not start until well outside the action safe area.
      float ab = uAberration * smoothstep(0.055, 0.30, r2) * (1.0 + uImpact * 1.1);
      vec3 col;
      if (ab > 1e-5) {
        col.r = texture2D(tDiffuse, uv + d0 * ab).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - d0 * ab).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      float rawd = rawDepth(uv);
      float isSky = step(0.99999, rawd);
      float dist = eyeDist(uv);

      // --- contact occlusion -------------------------------------------------
      // Six depth taps, no second buffer, no half-res chain.
      //
      // A separate Alchemy AO pass was built for this and thrown away: in a
      // world whose near field is a million instanced grass blades it spent
      // eight per cent of the frame scribbling noise into the turf and put
      // nothing under the things that actually needed grounding. What grounds a
      // low-poly object is far simpler — the ground *behind* its silhouette has
      // to go dark where the object meets it. So: if a neighbour is materially
      // closer to the lens than we are, we are sitting in something's pocket.
      //
      // Cheap, stable, and it darkens exactly the seam where a trunk, a pillar
      // or a boulder lands on the ground.
      #if USE_CONTACT
      if (uContact > 0.0 && isSky < 0.5) {
        // The radius is **half a metre**, not a fixed count of pixels. That is
        // the whole difference between a grounding term and an edge outline:
        // a fixed screen radius gives a two-metre object across the frame the
        // same thin band as a mountain a kilometre out, which is why the one
        // thing in every shot that needed grounding — the cadet, four metres
        // from the lens — got a hairline and read as a sticker on the ground.
        // In metres, the pocket under his boots is the size his boots are.
        //
        // THE CLAMP IS A FRACTION OF THE FRAME, NOT A COUNT OF PIXELS.
        //
        // It used to be clamp(..., 3.0, 42.0) — forty-two *drawing-buffer*
        // pixels. uProjScale already carries the buffer height, so the half
        // metre in the middle of the range was resolution-independent and the
        // two ends were not, and the ceiling binds over the whole near field,
        // which is where the cadet is. When the governor halves the buffer —
        // which is exactly what a long session does — forty-two buffer pixels
        // stop being 3.1% of the frame's height and become 6.5% of it, so the
        // black pocket around every near silhouette DOUBLES in apparent size
        // at the moment it is being drawn at half resolution and, at the
        // bottom tier, with FXAA switched off. A pocket that grows and
        // hardens the longer you play is exactly the reported symptom.
        //
        // Both ends are now a share of the buffer height, so the pocket is
        // the same size on screen at every resolution the governor can pick.
        // 0.031 is the old 42 px at the resolution this was authored on, so
        // the full-resolution look is unchanged.
        float rmin = max(2.0, uResolution.y * 0.0025);
        float rmax = uResolution.y * 0.031;
        float rpx = clamp(0.50 * uProjScale / max(dist, 0.5), rmin, rmax);
        vec2 px = vec2(rpx / max(uResolution.x, 1.0), rpx / max(uResolution.y, 1.0));
        float tol = max(0.18, dist * 0.026);
        // Eight fixed taps at a fixed phase is a rosette, and a rosette on a
        // hard depth test is a staircase: every silhouette in the frame steps
        // through the same eight angles at the same eight radii, so the
        // stepping correlates across the whole image instead of averaging out.
        // One interleaved-gradient rotation per pixel — the same trick the
        // volumetric march already uses on its own shadow taps — turns the
        // steps into a gradient at no extra samples.
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float ca = cos(ign * 6.2831853), sa = sin(ign * 6.2831853);
        float occ = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7853982 + 0.4;
          // two rings, so the pocket has a gradient instead of an edge
          float rr = (i < 4) ? 0.52 : 1.0;
          vec2 o = vec2(cos(a), sin(a));
          o = vec2(o.x * ca - o.y * sa, o.x * sa + o.y * ca) * px * rr;
          float ds = eyeDist(uv + o);
          occ += clamp((dist - ds) / tol, 0.0, 1.0) * (rr > 0.9 ? 0.62 : 1.0);
        }
        occ /= 6.5;
        occ *= 1.0 - smoothstep(90.0, 260.0, dist);       // near- and mid-field only
        float lum = dot(col, LUMA);
        occ *= 1.0 - smoothstep(0.72, 1.80, lum);         // never dirty a highlight
        // …and never take the last of the light either. This term is a
        // multiply, so on ground that is ALREADY in the sun's shadow — where
        // the terrain has taken its ambient down to 42% and the black point is
        // waiting a little further down the chain — it was the step that
        // finished the pixel off and left a hard black hole with a hard edge.
        // There is no contact shadow inside a shadow: nothing is left to
        // occlude. The highlight guard above has always existed; this is the
        // same guard at the other end, and it was missing.
        occ *= smoothstep(0.012, 0.085, lum);
        // cool the pocket as well as darkening it: light that reaches into a
        // contact shadow at golden hour is sky light, and sky light is blue
        col *= (1.0 - occ * uContact) * mix(vec3(1.0), vec3(0.88, 0.95, 1.10), occ * 0.55);
      }
      #endif

      // --- aerial perspective ------------------------------------------------
      {
        float x = max(0.0, dist - uHazeStart);
        float h = (1.0 - exp(-x * uHazeScale)) * uHazeMax * (1.0 - isSky);
        float m = (1.0 - exp(-x * uHazeScale * 2.4)) * (1.0 - isSky);

        vec2 sd = (uv - uSunUV) * vec2(uAspect, 1.0);
        float sunNear = exp(-length(sd) * 1.25);
        vec3 air = mix(uHazeCool, uHazeWarm, clamp(sunNear, 0.0, 1.0));

        float ml = dot(col, LUMA);
        col = mix(col, vec3(ml), m * 0.52);   // saturation falls off first
        col = mix(col, air, h);
      }

      // --- volumetric light, added in linear light ---------------------------
      // The volumetric buffer already *is* the scattering integral along this
      // pixel's own view ray — occlusion, phase, density and depth are all
      // resolved inside the march — so there is nothing left to weight it by
      // here. All this does is put a third-resolution buffer back on a full
      // resolution frame without haloing every silhouette in it.
      //
      // Alpha carries the length of the ray the low-res texel marched. Where a
      // pillar's edge cuts across a low-res texel, its neighbours marched a
      // completely different distance; weighting by that difference is a
      // one-instruction bilateral filter and is the whole reason the beams keep
      // hard silhouettes at a third of the pixels.
      if (uShaftStrength > 0.0) {
        vec2 t = uShaftTexel;
        vec4 c0 = texture2D(tShafts, uv);
        vec3 sh = c0.rgb; float wsum = 1.0;
        for (int i = 0; i < 4; i++) {
          vec2 o = (i == 0) ? vec2( t.x,  t.y)
                 : (i == 1) ? vec2(-t.x,  t.y)
                 : (i == 2) ? vec2( t.x, -t.y)
                            : vec2(-t.x, -t.y);
          vec4 s = texture2D(tShafts, uv + o);
          float w = exp(-abs(s.a - c0.a) * 0.22);
          sh += s.rgb * w; wsum += w;
        }
        col += (sh / wsum) * uShaftStrength;
      }

      // --- bloom -------------------------------------------------------------
      col += texture2D(tBloom, uv).rgb * uBloom;

      // --- lens ghosts along the sun→centre axis -----------------------------
      if (uSunVis > 0.001) {
        // four depth taps around the star: walk behind a pillar and the ghosts
        // go out with it, which is the difference between a flare and a decal
        vec2 sc = clamp(uSunUV, vec2(0.002), vec2(0.998));
        float occ = (step(0.99999, rawDepth(sc + vec2( 0.010 / uAspect, 0.0)))
                   + step(0.99999, rawDepth(sc + vec2(-0.010 / uAspect, 0.0)))
                   + step(0.99999, rawDepth(sc + vec2(0.0,  0.010)))
                   + step(0.99999, rawDepth(sc + vec2(0.0, -0.010)))) * 0.25;
        vec2 toC = (vec2(0.5) - uSunUV);
        vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
        vec3 gh = vec3(0.0);
        // three ghosts, each a soft disc with its own tint
        vec2 g1 = (uSunUV + toC * 1.34 - 0.5) * vec2(uAspect, 1.0);
        vec2 g2 = (uSunUV + toC * 1.72 - 0.5) * vec2(uAspect, 1.0);
        vec2 g3 = (uSunUV + toC * 0.55 - 0.5) * vec2(uAspect, 1.0);
        gh += vec3(0.42, 0.68, 1.0)  * exp(-pow(length(p - g1) / 0.085, 2.0)) * 0.055;
        gh += vec3(1.00, 0.62, 0.36) * exp(-pow(length(p - g2) / 0.052, 2.0)) * 0.075;
        gh += vec3(0.70, 1.00, 0.82) * exp(-pow(length(p - g3) / 0.135, 2.0)) * 0.030;
        col += gh * uSunVis * occ;
      }

      // --- exposure, with a slight dip while a rift is talking to you --------
      // The seal's lift goes in HERE, before the tone map, and that is the
      // whole of why it reads as light instead of as a white rectangle laid
      // over the frame: ACES rolls the highlights off, so the sky bleaches
      // toward its own colour, the lit faces of the stone go gold, and nothing
      // clips. Added after the tone map it would be a flashbang.
      float exposure = uExposure * mix(1.0, 0.88, uFocusBlend)
        * (1.0 + uImpact * 0.30 * (1.0 - uImpactBad))
        * (1.0 + uSeal * 0.42);
      col *= exposure;

      // --- tone map ---------------------------------------------------------
      col = acesFitted(col);

      // --- black point: an anchor and a TOE, not a guillotine ---------------
      //
      // The frame still gets a real anchor rather than a mid-grey floor. What
      // it no longer gets is a hole.
      //
      // 'max(col - bp, 0.0)' does two things this frame cannot afford. It
      // CLIPS — everything under the point comes out at exactly zero, so a face
      // that is merely dark arrives as a flat region with a hard edge round it
      // and no gradient in it to read the shape off. A critic named that
      // exactly: "a dead region with a hard edge". And it clips PER CHANNEL, so
      // a cool shadow loses red and green a good deal before it loses blue and
      // slides its hue as it goes down, which is the other half of why those
      // regions read as damage rather than as shade.
      //
      // So the roll-off is a quadratic toe on LUMINANCE, applied to all three
      // channels at once: zero still maps to zero — a black frame is still
      // black — but everything above it is monotonic, so a dark surface keeps
      // its shape instead of becoming an absence. Above the black point the
      // curve is the same straight line it always was, half a black point
      // higher, so nothing in the midtones or the highlights moves.
      //
      // It is a toe and NOT a fix for an unlit surface. What was actually
      // black in this build was black before the tone map: see the deck light
      // in src/world/terrain.js, which is where those pixels got their light.
      {
        float lb = dot(col, LUMA);
        float bp = max(1e-5, uBlackPoint);
        float lo = lb < bp ? (lb * lb) / (2.0 * bp) : lb - bp * 0.5;
        col *= (lo / max(1e-5, lb)) / (1.0 - bp * 0.5);
      }

      // --- grade: cyan in the shadows, gold in the highlights ---------------
      float l = dot(col, LUMA);
      vec3 shadowTint = vec3(0.74, 0.92, 1.16);
      vec3 midTint    = vec3(0.99, 1.00, 0.99);
      vec3 highTint   = vec3(1.08, 1.00, 0.88);
      vec3 tint = mix(shadowTint, midTint, smoothstep(0.0, 0.34, l));
      tint = mix(tint, highTint, smoothstep(0.34, 0.90, l));
      col *= tint;

      // --- curve: filmic S ---------------------------------------------------
      vec3 s = col * col * (3.0 - 2.0 * col);
      col = mix(col, s, uContrast);

      // --- saturation, with highlight bleach so bloom cores read as light ---
      l = dot(col, LUMA);
      float sat = uSaturation * mix(1.0, 0.72, uFocusBlend);
      col = mix(vec3(l), col, sat);
      col = mix(col, vec3(l), smoothstep(0.86, 1.0, l) * 0.5);

      // --- the answer beat ---------------------------------------------------
      if (uImpact > 0.0) {
        float k = uImpact;
        float rad = length(d0 * vec2(uAspect, 1.0));
        if (uImpactBad < 0.5) {
          // right: a warm shockwave ring runs out of the centre and the frame
          // lifts for a beat
          float ringR = (1.0 - k) * 0.78;
          float ring = exp(-pow((rad - ringR) / 0.030, 2.0)) * k;
          col += vec3(0.70, 1.00, 0.88) * ring * 1.05;
          col = mix(col, col * vec3(0.88, 1.05, 0.98) + vec3(0.015, 0.055, 0.04), k * 0.40);
        } else {
          // wrong: the light goes out of it — desaturate, bruise, close down
          float lb = dot(col, LUMA);
          col = mix(col, vec3(lb), k * 0.60);
          col = mix(col, col * vec3(1.14, 0.50, 0.48), k * 0.85);
          // the frame closes down hard from the edges — a flinch, not a flash
          col *= 1.0 - k * 0.55 * smoothstep(0.10, 0.80, rad);
        }
      }

      // --- the seal -----------------------------------------------------------
      // A statement just became true and the world is agreeing with it. The
      // light does not come from the lens: it comes from above, it lands on
      // what is already lit, and it is warm. Three terms, all cheap, and the
      // branch is on a uniform so a frame with no seal in it pays nothing.
      if (uSeal > 0.0) {
        float k = uSeal;
        float lum = dot(col, LUMA);
        // sky-down: strongest at the top of the frame, so a cadet looking at
        // the horizon sees the horizon take it
        col += vec3(1.00, 0.84, 0.55) * k * (0.028 + 0.085 * lum) * (0.52 + 0.70 * uv.y);
        // and everything the light touches turns fractionally gold
        col = mix(col, col * vec3(1.07, 1.01, 0.89), k);
      }

      // --- vignette: elliptical, follows the aspect so it never reads oval --
      // …and it OPENS on a seal. The frame is not closing in on the learner at
      // the moment they were right; it is getting wider.
      vec2 vd = d0 * vec2(uAspect, 1.0) / 1.42;
      float vig = 1.0 - smoothstep(0.26, 1.02, length(vd));
      vig = mix(1.0, vig, uVignette * mix(1.0, 1.30, uFocusBlend)
        * (1.0 + uImpact * uImpactBad * 0.8) * (1.0 - uSeal * 0.45));
      col *= vig;

      // --- output transfer, then grain on top so it lives in display space --
      col = linearToSRGB(clamp(col, 0.0, 1.0));

      if (uGrain > 0.0) {
        // luma grain, never colour: coloured speckle reads as compression.
        float g = hash13(vec3(gl_FragCoord.xy, floor(uTime * 24.0) * uGrainAnim));
        float shadowWeight = 1.0 - 0.62 * smoothstep(0.10, 0.82, dot(col, LUMA));
        col += vec3((g - 0.5) * uGrain * shadowWeight);
      }

      if (uDebug > 0.5) {
        if (uDebug < 1.5)      col = linearToSRGB(clamp(texture2D(tShafts, vUv).rgb * 3.0, 0.0, 1.0));
        else                   col = linearToSRGB(clamp(texture2D(tBloom, vUv).rgb, 0.0, 1.0));
      }

      gl_FragColor = vec4(col, 1.0);
    }`,
};
