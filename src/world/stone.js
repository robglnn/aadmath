import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';

/**
 * CUT STONE.
 *
 * Every ruin on this island was a box painted tan. A box painted tan is the
 * single most reliable way for a real-time frame to announce that it is a
 * prototype: it has no scale, because nothing on it tells you how big it is;
 * no age, because nothing on it has weathered; and no craft, because nobody
 * decided anything about it.
 *
 * One material fixes all three, for the cost of four noise taps, and it fixes
 * them for every ruin at once — the court's colonnade, the gate over the north
 * road, the Spine's broken ring, the aqueduct, the Reckoning, the watchtower.
 *
 *   **Scale** comes from coursing. The beds are 1.15 m, which is a stone two
 *   people can lift; the moment you can count them you know the lintel is six
 *   metres up rather than sixty. The joints are cut in the plane of the face —
 *   derived from the true face normal, not from world axes — so an angled wall
 *   is coursed along itself instead of being sliced by a global grid.
 *
 *   **Age** comes from weathering that has a direction. Rain runs *down*, so
 *   the streaks run down; lichen creeps up out of the ground and into the
 *   joints where the water sits; the arrises of every block are rubbed paler
 *   than its middle, because that is the part people and weather touch.
 *
 *   **Craft** comes from the blocks disagreeing. Each one gets its own tone
 *   from the quarry, and the courses are broken-bonded — every row offset from
 *   the one under it — so the wall reads as laid rather than as tiled.
 */
export function stoneMaterial(opts = {}) {
  const {
    course = 1.15,       // bed height, metres
    block = 1.75,        // block length, metres
    warm = [1.10, 1.03, 0.90],
    cool = [0.84, 0.83, 0.82],
    mossAmt = 0.34,
    roughness = 0.94,
  } = opts;
  const f = (n) => n.toFixed(4);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness, metalness: 0.0, flatShading: true,
  });

  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSP;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vSP = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_NOISE}\nvarying vec3 vSP;`)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        {
          // the true face normal, so the coursing lies in the plane of the wall
          vec3 fn = normalize(cross(dFdx(vSP), dFdy(vSP)));
          float up = clamp(abs(fn.y), 0.0, 1.0);
          vec2 tang = normalize(vec2(-fn.z, fn.x) + vec2(1e-5));
          float along = dot(vSP.xz, tang) + vSP.y * up * 1.7;

          float cy = vSP.y / ${f(course)};
          float row = floor(cy);
          float bed = abs(fract(cy) - 0.5) * 2.0;
          // broken bond: every course slides half a block on the one below
          float bx = along / ${f(block)} + fract(row * 0.4142) ;
          float head = abs(fract(bx) - 0.5) * 2.0;

          // 0 in the middle of a block, 1 in the mortar
          float jBed  = smoothstep(0.86, 0.99, bed);
          float jHead = smoothstep(0.90, 0.995, head);
          float joint = clamp(max(jBed, jHead), 0.0, 1.0) * (1.0 - up * 0.75);
          float shoulder = clamp(max(smoothstep(0.66, 0.88, bed),
                                     smoothstep(0.74, 0.92, head)), 0.0, 1.0);

          // every block came out of a different part of the quarry
          float blk = aa_h(vec2(floor(bx) * 1.7, row * 3.1));
          vec3 tint = mix(vec3(${f(cool[0])}, ${f(cool[1])}, ${f(cool[2])}),
                          vec3(${f(warm[0])}, ${f(warm[1])}, ${f(warm[2])}), blk);

          // pitting and tool marks
          tint *= 0.88 + aa_n(vec2(along * 3.1, vSP.y * 3.4)) * 0.26;

          // rain runs down: dark streaks hanging off every bed, only on faces
          float streak = smoothstep(0.50, 0.95, aa_n(vec2(along * 2.2, vSP.y * 0.085)));
          tint = mix(tint, tint * vec3(0.58, 0.58, 0.61), streak * (1.0 - up) * 0.60);

          // lichen creeps up out of the ground and sits in the wet joints
          float moss = smoothstep(0.52, 0.92, aa_n(vec2(along * 0.7, vSP.y * 0.24)));
          tint = mix(tint, tint * vec3(0.70, 0.94, 0.60),
                     moss * (0.45 + joint * 0.55) * ${f(mossAmt)});

          // the arrises are rubbed pale; the joint itself is a shadow
          float arris = clamp(shoulder - joint, 0.0, 1.0) * (1.0 - up * 0.6);
          tint *= 1.0 + arris * 0.30;
          tint = mix(tint, tint * 0.40, joint * 0.88);

          diffuseColor.rgb *= tint;
        }`);
  };
  return mat;
}
