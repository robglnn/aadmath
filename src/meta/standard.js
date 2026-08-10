/**
 * The Standard — progression you can see from the ground.
 *
 * A rank on a HUD chip is a number about you. A monument in the plaza with five
 * bands, four of them dark, is a fact about the world: you can walk up to it,
 * look at what is unlit, and know exactly how much of the ascent is still ahead.
 *
 * Two things were missing and both were the difference between a monument and a
 * fence post:
 *
 *   THE COLLAR. A ring of the rank's light that sits on the shaft at exactly
 *   your standing and *climbs* — every clean solve moves it a visible amount,
 *   and it climbs toward the next dark band, which then ignites when it
 *   arrives. Progression legible in the world rather than in a panel: you can
 *   stand in the plaza and watch the thing you are doing move.
 *
 *   THE INSCRIPTION. Four plaques, one per face, carrying the shard, the rank
 *   you presently hold in that rank's own colour, its chevrons, and the line
 *   the order says about it. Localised, redrawn on rank and on language. A
 *   monument with nothing written on it is a shape.
 *
 * Budget: one merged stone mesh, five band meshes sharing one geometry, a cap,
 * a collar, and four plaques sharing one geometry and one 512×256 canvas
 * texture — thirteen draws standing still, plus a shaft and a ground ring that
 * only exist during an ascension. Deliberately no light source: everything
 * bright here is emissive and the bloom pass already does the work, and a
 * second point light would cost every lit material in the scene a per-fragment
 * term forever.
 */
import * as THREE from 'three';
import { heightAt } from '../world/world.js';
import { RANK_HEX, RANKS } from './arc.js';
import { t } from '../i18n/index.js';

const X = 15.5, Z = 7.0;               // beside the plaza road, clear of the gate axis
const BAND_Y = (i) => 3.9 + i * 2.5;   // where rank i's band sits on the shaft
const SHAFT_R = (y) => 1.72 + (0.66 - 1.72) * Math.max(0, Math.min(1, (y - 2.1) / 13));

export function createStandard(scene) {
  const base = heightAt(X, Z) ?? 6;
  const group = new THREE.Group();
  group.position.set(X, base, Z);

  // --- the stone ---------------------------------------------------------
  const parts = [];
  const foot = new THREE.CylinderGeometry(3.0, 3.9, 1.25, 8);
  foot.translate(0, 0.62, 0);
  parts.push(foot);
  const step = new THREE.CylinderGeometry(2.25, 2.85, 0.95, 8);
  step.translate(0, 1.72, 0);
  parts.push(step);
  const shaft = new THREE.CylinderGeometry(0.66, 1.72, 13.0, 4, 1);
  shaft.rotateY(Math.PI / 4);
  shaft.translate(0, 8.6, 0);
  parts.push(shaft);
  // Two buttresses at the base give the silhouette shoulders, so it reads as a
  // monument at 60 m rather than as a fence post.
  for (const sx of [-1, 1]) {
    const b = new THREE.BoxGeometry(0.7, 5.0, 1.5);
    b.rotateZ(sx * 0.16);
    b.translate(sx * 1.9, 3.4, 0);
    parts.push(b);
  }
  const stone = new THREE.Mesh(
    mergeSimple(parts),
    new THREE.MeshStandardMaterial({ color: 0xb9ae9e, roughness: 0.9, flatShading: true }),
  );
  stone.castShadow = true;
  stone.receiveShadow = true;
  group.add(stone);

  // --- the crown: takes the rank's colour, so the silhouette is the rank ---
  const capGeo = new THREE.OctahedronGeometry(1.25, 0);
  capGeo.scale(0.78, 1.75, 0.78);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
    color: 0x9aa6bd, emissive: new THREE.Color(RANK_HEX.copper), emissiveIntensity: 1.6,
    roughness: 0.4, metalness: 0.3, flatShading: true,
  }));
  cap.position.y = 16.0;
  cap.castShadow = true;
  group.add(cap);

  // --- five bands, one per rank -----------------------------------------
  const bandGeo = new THREE.TorusGeometry(1, 0.13, 8, 24);
  bandGeo.rotateX(Math.PI / 2);
  const bands = RANKS.map((rank, i) => {
    const y = BAND_Y(i);
    const r = 1.62 - i * 0.15;
    const m = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({
      color: 0x2b3550, emissive: new THREE.Color(RANK_HEX[rank]), emissiveIntensity: 0,
      roughness: 0.35, metalness: 0.2,
    }));
    m.position.y = y;
    m.userData.r = r;
    m.scale.setScalar(r * 0.84);
    group.add(m);
    return m;
  });

  // --- the collar: your standing, on the stone --------------------------
  const collarGeo = new THREE.TorusGeometry(1, 0.055, 8, 30);
  collarGeo.rotateX(Math.PI / 2);
  const collarMat = new THREE.MeshBasicMaterial({
    color: RANK_HEX.copper, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.y = BAND_Y(0);
  group.add(collar);

  // --- the inscription ---------------------------------------------------
  const plate = document.createElement('canvas');
  plate.width = 512; plate.height = 256;
  const ctx = plate.getContext('2d');
  const plateTex = new THREE.CanvasTexture(plate);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;
  const plateMat = new THREE.MeshBasicMaterial({
    map: plateTex, transparent: true, depthWrite: false, fog: true, toneMapped: true,
  });
  const plateGeo = new THREE.PlaneGeometry(1.94, 0.97);
  const PLATE_Y = 4.7;
  const plates = [0, 1, 2, 3].map((k) => {
    const m = new THREE.Mesh(plateGeo, plateMat);
    const a = k * Math.PI / 2;
    const d = SHAFT_R(PLATE_Y) * Math.SQRT1_2 + 0.06;
    m.position.set(Math.sin(a) * d, PLATE_Y, Math.cos(a) * d);
    m.rotation.y = a;
    // the shaft tapers, so the face it sits on is not quite vertical
    m.rotation.x = -0.045;
    group.add(m);
    return m;
  });

  // --- the shaft of light that fires on ascension ------------------------
  const beamGeo = new THREE.CylinderGeometry(0.55, 1.5, 120, 10, 1, true);
  beamGeo.translate(0, 60, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uCol: { value: new THREE.Color(RANK_HEX.copper) }, uPow: { value: 0 } },
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
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      uniform vec3 uCol; uniform float uPow;
      void main(){
        float up = 1.0 - vUv.y;
        float thick = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(up, 5.0) * 0.5 * pow(thick, 0.9);
        gl_FragColor = vec4(uCol * (1.1 + up * 0.8), a * uPow);
      }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 1.2;
  beam.visible = false;
  group.add(beam);

  // --- the ground ring that runs outward --------------------------------
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: RANK_HEX.copper, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.4;
  ring.visible = false;
  group.add(ring);

  scene.add(group);

  let rank = -1;
  let pulse = 0;      // 0..1 ascension envelope, counts down
  let wave = 0;       // ring radius animation
  let frac = 0;       // standing across the current rung
  let shownY = BAND_Y(0);
  let flash = 0;      // collar kick when standing is gained
  let seals = 0;      // tears closed on this shard — the fast clock, cut in stone

  /** Redraw the plaque. Cheap, and only ever on rank or language changing. */
  function inscribe() {
    const i = Math.max(0, rank);
    const name = RANKS[i];
    const ink = '#' + RANK_HEX[name].toString(16).padStart(6, '0');
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(9,15,27,0.86)';
    roundRect(ctx, 6, 6, 500, 244, 10);
    ctx.fill();
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
    roundRect(ctx, 6, 6, 500, 244, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(190,208,232,0.8)';
    ctx.font = '600 25px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(spaced(t('story.standard.shard')), 256, 48);

    ctx.fillStyle = ink;
    ctx.font = '700 62px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(spaced(t('rank.' + name).toUpperCase()), 256, 122);

    // one chevron per rank held — the sigil, cut into the stone
    ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const w = 26, gap = 40, n = i + 1, x0 = 256 - ((n - 1) * gap) / 2;
    for (let k = 0; k < n; k++) {
      const cx = x0 + k * gap;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, 168); ctx.lineTo(cx, 152); ctx.lineTo(cx + w / 2, 168);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(206,222,242,0.72)';
    ctx.font = '400 22px ui-sans-serif, system-ui, sans-serif';
    fitLine(ctx, t('story.standard.motto'), 256, 204, 462);

    // The tally. A monument that only changes four times in a curriculum is a
    // fence post between promotions; this line moves every time a tear closes,
    // so walking up to the Standard after ten minutes shows ten minutes of work.
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.92;
    ctx.font = '600 21px ui-sans-serif, system-ui, sans-serif';
    fitLine(ctx, t('story.standard.tally', { n: seals }), 256, 236, 462, 21, '600');
    ctx.globalAlpha = 1;
    plateTex.needsUpdate = true;
  }

  return {
    group,
    plates,
    get position() { return group.position; },

    /** Light every band up to `i`, colour the crown, recut the plaque. */
    setRank(i, { celebrate = false } = {}) {
      if (i === rank) return;
      rank = i;
      const col = RANK_HEX[RANKS[i]] ?? RANK_HEX.copper;
      // Unlit bands are recessed dark grooves, lit ones stand proud: from the
      // ground you can count how much of the ascent is still ahead of you.
      bands.forEach((b, k) => {
        const on = k <= i;
        b.material.emissiveIntensity = on ? (k === i ? 3.6 : 1.9) : 0;
        b.material.color.setHex(on ? 0x8f9ab6 : 0x232c42);
        b.scale.setScalar(b.userData.r * (on ? 1.0 : 0.84));
      });
      cap.material.emissive.setHex(col);
      collarMat.color.setHex(col);
      beamMat.uniforms.uCol.value.setHex(col);
      ringMat.color.setHex(col);
      inscribe();
      if (celebrate) { pulse = 1; wave = 0; flash = 1; beam.visible = true; ring.visible = true; }
    },

    /**
     * Where you stand between this band and the next, 0..1. Called on every
     * point of standing gained — the collar is the fastest-moving thing in the
     * world and it is deliberately the thing you can see from the plaza.
     */
    setProgress(f, { kick = false } = {}) {
      frac = Math.max(0, Math.min(1, f || 0));
      if (kick) flash = 1;
    },

    /**
     * Tears closed on this shard. Recuts the tally on the plaque and kicks the
     * collar — the monument answers to the fast clock too, so the plaza is
     * never a place where nothing you did today shows.
     */
    setSeals(n) {
      const v = Math.max(0, n | 0);
      if (v === seals) return;
      seals = v;
      flash = 1;
      if (rank >= 0) inscribe();
    },

    relabel() { if (rank >= 0) inscribe(); },

    update(dt, time) {
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt / 4.2);
        beamMat.uniforms.uPow.value = Math.pow(pulse, 0.7);
        wave += dt;
        const r = Math.min(1, wave / 2.6);
        ring.scale.setScalar(1 + r * 46);
        ringMat.opacity = (1 - r) * 0.85 * Math.min(1, r * 6);
        if (pulse === 0) { beam.visible = false; ring.visible = false; }
      }
      bands.forEach((b, k) => {
        if (k === rank) b.material.emissiveIntensity = 3.2 + Math.sin(time * 2.1) * 0.8 + pulse * 6;
      });

      // the collar eases to its target height rather than snapping, so a point
      // of standing reads as the light *climbing*
      const target = BAND_Y(Math.max(0, rank)) + frac * 2.5;
      shownY += (target - shownY) * Math.min(1, dt * 3.4);
      collar.position.y = shownY;
      const r = SHAFT_R(shownY) * 1.06;
      const breathe = 1 + Math.sin(time * 2.6) * 0.012;
      collar.scale.set(r * breathe, 1, r * breathe);
      flash = Math.max(0, flash - dt * 1.6);
      collarMat.opacity = 0.72 + flash * 0.28 + Math.sin(time * 2.6) * 0.06;
      cap.material.emissiveIntensity = 1.4 + Math.sin(time * 1.3) * 0.35 + pulse * 5;
    },
  };
}

function spaced(s) { return [...String(s)].join(' '); }

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Shrink until the line fits — ES and PL are longer than EN and must not clip. */
function fitLine(c, text, x, y, max, from = 22, weight = '400') {
  let size = from;
  c.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  while (c.measureText(text).width > max && size > 12) {
    size -= 1;
    c.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  }
  c.fillText(text, x, y);
}

/** Minimal position/normal/uv merge — avoids depending on world/geom.js. */
function mergeSimple(geos) {
  let vtx = 0, idx = 0;
  for (const g of geos) {
    vtx += g.attributes.position.count;
    idx += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vtx * 3);
  const nor = new Float32Array(vtx * 3);
  const uv = new Float32Array(vtx * 2);
  const ind = new (vtx > 65535 ? Uint32Array : Uint16Array)(idx);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) ind[io++] = g.index.array[i] + vo;
    } else {
      for (let i = 0; i < p.count; i++) ind[io++] = i + vo;
    }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(ind, 1));
  out.computeBoundingSphere();
  return out;
}
