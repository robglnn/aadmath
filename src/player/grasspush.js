import * as THREE from 'three';

/**
 * The grass has to notice him.
 *
 * A cadet crossing a meadow at eleven metres a second while every blade stands
 * perfectly upright is the single clearest tell that the character and the
 * world are two separate renders that happen to share a camera. This bends the
 * blades away from wherever he is standing, hardest at the tips, and lets them
 * spring back behind him.
 *
 * The grass belongs to the world team, so this does **not** edit their file. It
 * patches their material at runtime and does it defensively: it looks for one
 * specific line in their vertex shader, and if that line is not there — because
 * they have since rewritten it — it gives up silently and the game runs exactly
 * as it did before. There is no path through here that can break their build.
 */

const ANCHOR = 'vec3 world = aOffset + w;';

const PUSH = /* glsl */`
        vec3 world = aOffset + w;
        // --- player push -------------------------------------------------
        // uPush = (x, z, radius, strength). Blades lean away from the cadet in
        // proportion to how far up the blade you are, and squash a little as
        // they go over, which is what stops the bend reading as a slide.
        vec2 pd = world.xz - uPush.xy;
        float pl = length(pd);
        if (uPush.z > 0.001 && pl < uPush.z) {
          float pw = 1.0 - smoothstep(0.0, uPush.z, pl);
          pw *= pw;
          vec2 dir = pl > 1e-4 ? pd / pl : vec2(1.0, 0.0);
          float lean = pw * uPush.w * pow(t, 1.4);
          world.xz += dir * lean * hgt;
          world.y -= lean * hgt * 0.55;
        }
        // -----------------------------------------------------------------`;

export class GrassPush {
  constructor(grass) {
    this.ok = false;
    this.u = null;
    try {
      const mat = grass && grass.mesh && grass.mesh.material;
      if (!mat || !mat.vertexShader || !mat.uniforms) return;
      if (mat.uniforms.uPush) { this.u = mat.uniforms.uPush; this.ok = true; return; }
      if (!mat.vertexShader.includes(ANCHOR)) return;
      mat.uniforms.uPush = { value: new THREE.Vector4(0, 0, 0, 0) };
      mat.vertexShader = mat.vertexShader
        .replace('uniform vec2 uWind;', 'uniform vec2 uWind;\n      uniform vec4 uPush;')
        .replace(ANCHOR, PUSH);
      mat.needsUpdate = true;
      this.u = mat.uniforms.uPush;
      this.ok = true;
    } catch {
      this.ok = false;
    }
    this._w = 0;
  }

  /**
   * `w` 0..1: how much the cadet is currently leaning on the ground. It ramps
   * rather than snaps, so stepping off a ledge lets the meadow stand back up
   * over a few frames instead of popping.
   */
  update(dt, pos, want, radius = 1.15, strength = 0.85) {
    if (!this.ok) return;
    this._w += (want - this._w) * Math.min(1, dt * 9);
    const v = this.u.value;
    v.x = pos.x; v.y = pos.z;
    v.z = radius;
    v.w = strength * this._w;
  }
}
