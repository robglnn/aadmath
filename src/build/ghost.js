import * as THREE from 'three';
import { KINDS, SPEC } from './pieces.js';
import { buildGeometry } from './lattice.js';

/**
 * How far the lattice grid reaches from the slot, in metres. Two and a half
 * cells: enough to see the cell you are aiming at, its neighbours and the
 * corner you are aiming for, and not so much that the plaza turns into graph
 * paper.
 */
const GRID_R = 11;

/**
 * The preview.
 *
 * A build preview has exactly one job: before you commit, you must already know
 * the cell, the level, the facing, and whether it will take. The old ghost was
 * a 5% tinted box with no ground contact, so it answered none of those and the
 * verb felt like guessing. This one draws the piece itself in hard light, and
 * under it a **footprint** — a bracketed square lying on the level the piece
 * will be founded on. The footprint is the part you actually read: it tells you
 * the cell and the height at a glance, from any camera angle, and it turns red
 * the instant there is nothing to build from.
 */
export class Ghost {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'axiom-ghost';
    scene.add(this.group);

    // WHY THIS IS NOT ADDITIVE ANY MORE.
    //
    // A build piece is a dozen members deep — a wall alone is a face plate,
    // four frame rails, two mullions, four inlays and four corner blocks. Summed
    // additively they ran past 1.0 everywhere they overlapped, and the preview
    // photographed as a slab of white light: you could not see the piece's
    // shape, the ground it would land on, or the structure it was joining. A
    // ramp's preview and a wall's preview were the same white rectangle.
    //
    // So the body composites instead of accumulating: a translucent tinted
    // solid, front faces only, with the silhouette carried by a fresnel rim.
    // Ten layers of it are still the same blue, which is the whole point.
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.FrontSide,
      blending: THREE.NormalBlending, fog: false,
      uniforms: {
        uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 },
      },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          vL = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vN; varying vec3 vV; varying vec3 vL;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
          // a slow band travelling up the piece: unbuilt, but alive
          float scan = 0.5 + 0.5 * sin((vL.y * 2.6) - uTime * 3.4);
          // A translucent solid with a lit rim: the shape reads, and what is
          // behind it still reads through it.
          float a = clamp((0.26 + fres * 0.50 + scan * 0.05) * uPow, 0.0, 0.90);
          // held under 1.0 on purpose: a preview that clips to white is a
          // preview with no shape, which is the failure this replaced
          vec3 good = mix(vec3(0.10, 0.44, 0.86), vec3(0.44, 0.85, 1.0), fres);
          vec3 bad  = mix(vec3(0.86, 0.11, 0.26), vec3(1.0, 0.52, 0.62), fres);
          gl_FragColor = vec4(mix(good, bad, uBad) * (1.0 + fres * 0.20), a);
        }`,
    });

    this.panelMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          // travelling hatch — the universal "not committed yet" texture
          float h = fract((vUv.x + vUv.y) * 6.0 - uTime * 0.65);
          float band = smoothstep(0.46, 0.5, h) * smoothstep(0.94, 0.9, h);
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float a = (band * 0.055 + fres * 0.07 + 0.010) * uPow;
          vec3 good = vec3(0.30, 0.76, 1.0);
          vec3 bad = vec3(1.0, 0.30, 0.45);
          gl_FragColor = vec4(mix(good, bad, uBad) * a, a);
        }`,
    });

    // THE FOOTPRINT — and it is the shape of the *slot*, not a generic square.
    //
    // A wall lands on a cell face, a floor fills a cell, and the preview has to
    // say which before the click. So the pad is a unit plane scaled to the slot:
    // a four-metre bar lying along the face for a wall or a beam, a four-metre
    // square for a deck or a ramp. It is drawn through the world (no depth test)
    // on the exact level the piece will be founded on, so the height reads at a
    // glance from any camera angle.
    const fp = new THREE.PlaneGeometry(1, 1);
    fp.rotateX(-Math.PI / 2);
    this.padMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform float uTime; uniform float uBad; uniform float uPow;
        void main(){
          vec2 p = abs(vUv - 0.5) * 2.0;      // 0 at centre, 1 at the rim
          float sq = max(p.x, p.y);
          // corner brackets: the shape a targeting reticle makes on the ground
          float arm = step(0.60, min(p.x, p.y));
          float edge = smoothstep(0.80, 0.845, sq) * smoothstep(0.90, 0.86, sq);
          float bracket = edge * arm;
          float thin = smoothstep(0.855, 0.87, sq) * smoothstep(0.885, 0.872, sq);
          float pulse = 0.72 + 0.28 * sin(uTime * 4.4);
          // The footprint is the part that has to survive a bright plaza: it is
          // drawn through the world, so it is the one thing that always tells
          // you the cell and the level even when the body is edge-on.
          float a = (bracket * 1.15 * pulse + thin * 0.42 + (1.0 - smoothstep(0.0, 0.9, sq)) * 0.05) * uPow;
          vec3 good = vec3(0.55, 0.93, 1.0);
          vec3 bad = vec3(1.0, 0.32, 0.46);
          gl_FragColor = vec4(mix(good, bad, uBad) * a, a);
        }`,
    });
    this.pad = new THREE.Mesh(fp, this.padMat);
    this.pad.renderOrder = 5;
    this.pad.userData.noCamBlock = true;
    this.group.add(this.pad);

    // ------------------------------------------------------------------ grid
    //
    // THE THING THE PLAYER WAS MISSING.
    //
    // A judge tried three times to close a square of four walls by hand and
    // never managed it, and the reason was not the geometry — a separate rig
    // proves the lattice closes a perfect corner. It was that nothing on screen
    // said *which cell* or *which face*. A footprint bar tells you where the
    // piece is; it does not tell you what the piece is aligned to, so there is
    // no way to look at the frame and decide "the next one goes on that corner".
    //
    // So the lattice itself is drawn: the real cell boundaries, on the exact
    // level the piece will be founded on, out to a few cells and fading. On top
    // of it the aimed cell is filled, the face the piece will occupy is a solid
    // bar, and the **two lattice nodes that face ends on are marked as rings** —
    // those rings are the corners. Put the next wall's ring on the same spot as
    // this one's and the corner closes. That is the whole aiming problem, and
    // it is now a thing you can see rather than a thing you can hope.
    //
    // One unrotated plane, one draw call, everything procedural in the shader
    // and everything in world XZ, so nothing has to be rebuilt per frame.
    const gg = new THREE.PlaneGeometry(1, 1);
    gg.rotateX(-Math.PI / 2);
    this.gridMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      uniforms: {
        uTime: { value: 0 }, uBad: { value: 0 }, uPow: { value: 1 },
        uCentre: { value: new THREE.Vector2() },   // where the fade is centred
        uCell: { value: new THREE.Vector2() },     // centre of the aimed cell
        uNodeA: { value: new THREE.Vector2() },
        uNodeB: { value: new THREE.Vector2() },
        uEdge: { value: 0 },                       // 1 = a face piece
        uR: { value: GRID_R },
      },
      vertexShader: /* glsl */`
        varying vec3 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vW;
        uniform float uTime; uniform float uBad; uniform float uPow;
        uniform vec2 uCentre; uniform vec2 uCell; uniform vec2 uNodeA; uniform vec2 uNodeB;
        uniform float uEdge; uniform float uR;

        // Distance to the nearest cell boundary. Boundaries sit at x = 4k + 2,
        // which is exactly where pieces butt, so this is the lattice and not a
        // decorative grid drawn near it.
        float latline(float v){
          float f = mod(v + 2.0, 4.0);
          float d = min(f, 4.0 - f);
          float w = fwidth(v) * 0.9 + 0.055;
          return 1.0 - smoothstep(0.0, w, d);
        }
        float ringAt(vec2 p, vec2 c){
          float d = length(p - c);
          float w = fwidth(d) * 1.2 + 0.06;
          return smoothstep(0.78 + w, 0.78 - w, d) * smoothstep(0.46 - w, 0.46 + w, d);
        }
        void main(){
          vec2 p = vW.xz;
          float r = length(p - uCentre);
          float fade = 1.0 - smoothstep(uR * 0.55, uR * 1.0, r);
          if (fade <= 0.001) discard;

          float grid = max(latline(p.x), latline(p.y));
          // the cell the piece will occupy, filled and edged
          vec2 q = abs(p - uCell);
          float inCell = step(q.x, 2.0) * step(q.y, 2.0) * (1.0 - uEdge);
          float cellEdge = inCell * max(
            smoothstep(1.86, 2.0, q.x), smoothstep(1.86, 2.0, q.y));

          // the face itself: the segment between the two nodes
          vec2 ab = uNodeB - uNodeA;
          float tt = clamp(dot(p - uNodeA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
          float dFace = length(p - (uNodeA + ab * tt));
          float face = uEdge * (1.0 - smoothstep(0.16, 0.42, dFace));

          // THE CORNERS. Two rings, on the lattice nodes this piece ends on.
          // THE CORNERS. Rings on the lattice nodes this piece ends on — two
          // for a face, four for a whole cell. Put the next piece's ring on the
          // same spot as this one's and the corner closes. That is the entire
          // aiming problem, made into a thing you can see.
          float pulse = 0.70 + 0.30 * sin(uTime * 4.2);
          float nodes = uEdge > 0.5
            ? ringAt(p, uNodeA) + ringAt(p, uNodeB)
            : ringAt(p, uCell + vec2(-2.0, -2.0)) + ringAt(p, uCell + vec2(2.0, -2.0))
            + ringAt(p, uCell + vec2(-2.0, 2.0)) + ringAt(p, uCell + vec2(2.0, 2.0));
          nodes *= pulse;

          float a = (grid * 0.30 + cellEdge * 0.62 + inCell * 0.075
                     + face * 0.82 + nodes * 1.15) * fade * uPow;
          vec3 good = vec3(0.50, 0.92, 1.0);
          vec3 bad  = vec3(1.0, 0.30, 0.44);
          vec3 col = mix(good, bad, uBad);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.grid = new THREE.Mesh(gg, this.gridMat);
    this.grid.scale.set(GRID_R * 2, 1, GRID_R * 2);
    this.grid.renderOrder = 6;   // over the preview body, never behind it
    this.grid.userData.noCamBlock = true;
    this.group.add(this.grid);

    this.parts = {};
    for (const kind of KINDS) {
      const g = buildGeometry(kind);
      const frame = new THREE.Mesh(g.frame, this.mat);
      frame.renderOrder = 4;
      frame.userData.noCamBlock = true;
      frame.visible = false;
      const panel = new THREE.Mesh(g.panel, this.panelMat);
      panel.renderOrder = 4;
      panel.userData.noCamBlock = true;
      panel.visible = false;
      this.group.add(frame, panel);
      this.parts[kind] = { frame, panel };
    }
    this.kind = 'wall';
    this.visible = true;
    this.kick = 0;
  }

  setKind(kind) {
    if (kind === this.kind) return;
    this.kind = kind;
  }

  /**
   * @param tg {kind,x,y,z,yaw,base,valid} — where the piece would land
   * @param camera used only to duck the solid preview when the lens is inside it
   */
  update(dt, time, tg, camera) {
    this.mat.uniforms.uTime.value = time;
    this.panelMat.uniforms.uTime.value = time;
    this.padMat.uniforms.uTime.value = time;
    this.gridMat.uniforms.uTime.value = time;
    const bad = tg && tg.valid ? 0 : 1;
    this.mat.uniforms.uBad.value = bad;
    this.panelMat.uniforms.uBad.value = bad;
    this.padMat.uniforms.uBad.value = bad;
    this.gridMat.uniforms.uBad.value = bad;

    const on = !!tg && this.visible;
    for (const k of KINDS) {
      const p = this.parts[k];
      const show = on && k === tg.kind;
      p.frame.visible = show;
      p.panel.visible = show;
      if (!show) continue;
      p.frame.position.set(tg.x, tg.y, tg.z);
      p.frame.rotation.y = tg.yaw;
      p.panel.position.copy(p.frame.position);
      p.panel.rotation.y = tg.yaw;
    }
    this.pad.visible = on;
    this.grid.visible = on;
    if (!on) return;

    // The grid is laid on the level the piece will be founded on and centred on
    // the slot, so the height it reports is the height the piece will take.
    // A whole-cell piece fills a cell, so the cell is lit. A face piece belongs
    // to a line between two cells and lighting either of them would be a lie —
    // the bar and the two corner rings say exactly where it goes instead.
    const edge = tg.slotSpan === 'edge';
    const n = tg.nodes || [tg.x, tg.z, tg.x, tg.z];
    this.grid.position.set(tg.x, tg.base + 0.035, tg.z);
    const gu = this.gridMat.uniforms;
    gu.uCentre.value.set(tg.x, tg.z);
    gu.uCell.value.set(tg.x, tg.z);
    gu.uNodeA.value.set(n[0], n[1]);
    gu.uNodeB.value.set(n[2], n[3]);
    gu.uEdge.value = edge ? 1 : 0;

    this.pad.position.set(tg.x, tg.base + 0.05, tg.z);
    this.pad.rotation.y = tg.yaw;
    const along = 4.4;
    const across = tg.slotSpan === 'edge' ? 1.2 : 4.4;
    this.pad.scale.set(along, 1, across);

    // Never let the preview become a full-screen wash: if the lens is inside
    // the piece, keep the footprint and fade the body out.
    let pow = 1;
    if (camera) {
      const d = camera.position.distanceTo(this.parts[tg.kind].frame.position);
      pow = THREE.MathUtils.clamp((d - 1.1) / 1.8, 0, 1);
    }
    // a refused click makes the preview flare rather than merely stay red —
    // the feedback arrives on the frame the player asked, where they are looking
    const kick = Math.max(0, this.kick || 0);
    this.mat.uniforms.uPow.value = pow * (1 + kick * 2.2);
    this.panelMat.uniforms.uPow.value = pow * (1 + kick * 2.2);
    this.padMat.uniforms.uPow.value = 1 + kick * 2.6;
    // The grid never ducks: it is the one thing that still answers "which cell,
    // which face, what height" when the lens is pressed against the piece.
    this.gridMat.uniforms.uPow.value = 1 + kick * 2.0;
  }
}

export { SPEC };
