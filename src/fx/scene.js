import * as THREE from 'three';
import { FOG, HEMI } from '../world/daylight.js';

/**
 * Frame-budget and atmosphere conditioning.
 *
 * The world is assembled by other modules and keeps growing; what it must not
 * do is grow a per-pixel cost nobody is watching. Every dynamic point light in
 * a Three.js scene is a loop iteration in *every* lit fragment shader, so
 * thirteen decorative ones is a thirteen-fold ambient-lighting cost paid on
 * every grass blade on screen. This keeps a fixed, constant number of them
 * alive — always the ones nearest the camera, so the local glow is wherever you
 * are — which also means the shader's light count never changes and Three never
 * has to recompile a program mid-play.
 *
 * It does **not** own the fog. It used to set its own colour and density here,
 * a third module disagreeing with `sky.js` and `world.js` about what the air
 * was made of; now it only guarantees a fog object exists (so `USE_FOG` is
 * defined and `air.js` runs) and takes its numbers from `daylight.js` like
 * everybody else.
 *
 * Everything here is idempotent and re-scanned periodically, so props added
 * after boot (the rifts are) are picked up without anyone having to remember.
 */
export function conditionScene(scene, {
  maxPointLights = 2,
  fogColor = FOG.color.getHex(),
  fogDensity = FOG.density,
  maxHemi = HEMI.intensity,
} = {}) {
  const lights = [];
  let scanned = -1;

  function rescan() {
    lights.length = 0;
    scene.traverse((o) => {
      if (o.isPointLight) {
        // Whoever owns this light may be modulating it multiplicatively, and a
        // per-frame multiply is a random walk that eventually blows out. Cap it
        // against the light's own range, which is generous enough to leave any
        // sane authored value alone and tight enough to catch a runaway.
        o.userData.__fxMax = Math.max(12, 1.6 * (o.distance || 30));
        lights.push(o);
      } else if (o.isHemisphereLight && !o.userData.deck && o.intensity > maxHemi) {
        // The cap is for STRAY hemisphere lights — a decorative one somebody
        // adds and then modulates. The deck (src/world/daylight.js, created in
        // world.js) is one of the four authored lights of this hour and points
        // DOWN; capping it against the sky fill would silently undo the only
        // light in the game that reaches a face pointing at the cloud sea, and
        // a silent clamp is the kind of thing that costs a wave to find.
        o.intensity = maxHemi;
      }
    });
  }

  function applyFog() {
    if (scene.fog && scene.fog.isFogExp2) {
      scene.fog.color.setHex(fogColor);
      scene.fog.density = fogDensity;
    } else {
      scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    }
  }

  applyFog();
  rescan();

  let frame = 0;
  const cam = new THREE.Vector3();

  return {
    get lights() { return lights; },
    /** Call once per frame. Cheap: a sort of a dozen items every sixth frame. */
    update(camera, frameIndex) {
      frame = frameIndex;
      if (frame - scanned > 90) { scanned = frame; rescan(); }
      if (!lights.length) return;

      for (const l of lights) {
        if (l.intensity > l.userData.__fxMax) l.intensity = l.userData.__fxMax;
      }

      if (lights.length <= maxPointLights) {
        for (const l of lights) l.visible = true;
        return;
      }
      if (frame % 6) return;

      cam.copy(camera.position);
      lights.sort((a, b) => a.getWorldPosition(_a).distanceToSquared(cam)
        - b.getWorldPosition(_b).distanceToSquared(cam));
      for (let i = 0; i < lights.length; i++) lights[i].visible = i < maxPointLights;
    },
  };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
