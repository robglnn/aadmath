import * as THREE from 'three';
import { heightAt } from '../world/world.js';
import { createBeacon } from '../fx/beacon.js';
import { merge } from '../world/geom.js';
import { CELL } from '../build/pieces.js';
import { t, onLocaleChange } from '../i18n/index.js';
import './foundry.css';

/**
 * THE FOUNDRY — a place in the world where shards stop being a score.
 *
 * A real player finished a whole session holding eight hundred cipher shards
 * and wrote down, in these words: *"unsure what to do next… not sure what to do
 * about rifts, shards, and other things."* He had walked every earn route the
 * island has — motes, anchors, a hanging cache — and spent nothing, because
 * every sink in the game was a key he had never been told about, behind a grant
 * he had not been told existed. The economy was mechanically sound and
 * completely invisible. A currency you cannot see a use for is not a currency;
 * it is a number that goes up.
 *
 * So the sink is now **a place, fifteen metres from where you land**. A hex of
 * inlaid stone, three leaning pylons, and a cipher shard the size of a person
 * turning slowly over the middle of it with drift motes in orbit around it —
 * the *same* octahedron the player has been running through all session, made
 * enormous, so that the connection between "the diamonds I pick up" and "the
 * place that wants them" needs no sentence at all.
 *
 * Everything about it is built to be discovered rather than explained:
 *
 *   IT IS VISIBLE     A light shaft stands over it, the same kind the rifts
 *                     carry, so it is a landmark from anywhere on the plateau —
 *                     and it is the first one, in frame at the landing.
 *   IT CALLS          The crucible is slate and dead when you can afford
 *                     nothing, lit cyan when the cheapest thing is in reach and
 *                     gold when the permanent one is. You can read your own
 *                     wallet off the sky from two hundred metres away.
 *   IT OPENS ITSELF   Walking onto the deck opens it. There is no key to know.
 *                     E opens it from further out, the hail is a click target
 *                     for a mouse and a tap target for a thumb, and a pad's X
 *                     does the same — but a player who knows none of that still
 *                     gets the shop by walking into the thing that is glowing.
 *   IT QUOTES FIRST   Every row names the price, says what the thing does in one
 *                     line of the world's own language, and — for the rows not
 *                     for sale yet — exactly what opens them, which is always
 *                     mathematics. The shop is the progress board too: it is
 *                     where a player finds out that held lines are what the rest
 *                     of the stock is bought with.
 *
 * This file owns the structure, the hail and the panel. What is on the shelves,
 * what it costs and what happens when it is bought all live in `kit.js`, which
 * owns every price in the game.
 */

/**
 * Where it stands: thirteen metres ahead-right of the cadet's own boots at the
 * landing. Sited by measurement rather than by eye — a probe walks the real
 * heightfield and the real scene graph and keeps only ground that is flat
 * across the whole deck, has an unbroken line of sight from the spawn camera to
 * where the crucible will hang, and is clear of the nearest lattice anchor by
 * seventeen metres. That last constraint is not fussiness: an anchor is also a
 * huge glowing octahedron inside a ring, and a shop that looks like the other
 * floating diamond is a shop nobody reads.
 */
export const FOUNDRY_AT = [7, 15];

const DECK_R = 5.6;      // metres of stone floor
const DECK_H = 0.62;     // …standing this far proud of the meadow
const OPEN_R = 6.4;      // walk this close and the panel opens
const HAIL_R = 26;       // the hail appears from here
const REARM_R = 13;      // …and you must leave this far for the dwell to re-arm

/** Slate / cyan / gold: nothing, something, the permanent thing. */
const TONE = {
  none: new THREE.Color(0x5d6b7d),
  some: new THREE.Color(0x6fd8ff),
  best: new THREE.Color(0xffb44a),
};

export function createFoundry(opts = {}) {
  const {
    scene, root, player, input, hud, audio, fx, kit, builder, isBusy = () => false,
  } = opts;

  const [x, z] = FOUNDRY_AT;
  const y = heightAt(x, z) ?? 8;
  const site = new THREE.Vector3(x, y, z);

  // -------------------------------------------------------------- the stone
  // Deck, step and three leaning pylons are one rigid, never-moving,
  // single-material body, so they are baked to one geometry and cost one draw
  // call in the main pass and one in the shadow pass.
  //
  // It stands **proud of the meadow**, not flush with it. Flush was the first
  // build and the photograph killed it: the grass here is knee-high and it ate
  // the entire floor, so the shop read as two poles and a diamond hanging over
  // nothing. Sixty centimetres of stone with a step up to it is the difference
  // between a place and a prop — and the deck is registered with the same solid
  // registry the build lattice uses, so it is real ground you stand on rather
  // than a decal you walk through.
  const parts = [];
  const step = new THREE.CylinderGeometry(DECK_R + 0.9, DECK_R + 1.25, 0.34, 6);
  step.translate(0, DECK_H - 0.5, 0);
  parts.push(step);
  const deck = new THREE.CylinderGeometry(DECK_R, DECK_R + 0.35, DECK_H + 0.6, 6);
  deck.translate(0, DECK_H - (DECK_H + 0.6) / 2, 0);
  parts.push(deck);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.52;
    const h = 5.4;
    const p = new THREE.CylinderGeometry(0.58, 1.15, h, 5);
    // leaning inward, the way three hands hold one thing
    p.rotateZ(0.14);
    p.rotateY(-a);
    p.translate(Math.cos(a) * 4.5, DECK_H + h * 0.5 - 0.2, Math.sin(a) * 4.5);
    parts.push(p);
    const cap = new THREE.CylinderGeometry(0.86, 0.58, 0.55, 5);
    cap.rotateZ(0.14);
    cap.rotateY(-a);
    cap.translate(Math.cos(a) * 4.5 - 0.44, DECK_H + h - 0.2, Math.sin(a) * 4.5);
    parts.push(cap);
  }

  const stone = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({
    color: 0xbfb6a6, roughness: 0.92, metalness: 0.02, flatShading: true,
  }));
  for (const p of parts) p.dispose();
  stone.position.copy(site);
  stone.castShadow = true;
  stone.receiveShadow = true;

  // The copper collars, the one warm material on the structure — the same alloy
  // the rank standard in the plaza is banded with, so the foundry reads as
  // built by the same hands.
  const collarGeo = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.52;
    const ring = new THREE.TorusGeometry(0.82, 0.15, 6, 14);
    ring.rotateX(Math.PI / 2);
    ring.rotateZ(0.14);
    ring.rotateY(-a);
    ring.translate(Math.cos(a) * 4.5 - 0.3, DECK_H + 4.4, Math.sin(a) * 4.5);
    collarGeo.push(ring);
  }
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xd08a44, emissive: 0x5a2b06, emissiveIntensity: 1,
    roughness: 0.4, metalness: 0.6, flatShading: true,
  });
  const collars = new THREE.Mesh(merge(collarGeo), collarMat);
  for (const g of collarGeo) g.dispose();
  collars.position.copy(site);
  collars.castShadow = true;

  // ------------------------------------------------------------- the crucible
  // A cipher shard the size of a person. It is deliberately the exact solid the
  // drift motes are — an octahedron — because the player has spent the whole
  // session running through small ones, and this is the sentence "those go in
  // here", said without a sentence.
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.34, 0),
    new THREE.MeshStandardMaterial({
      color: 0xe8f4ff, emissive: 0x5d6b7d, emissiveIntensity: 1.6,
      roughness: 0.16, metalness: 0.2, flatShading: true,
    }),
  );
  shard.position.set(x, y + DECK_H + 4.4, z);
  shard.castShadow = false;

  // Two rings of cold light around it, out of phase, so the crucible is a
  // mechanism rather than an ornament.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x9fe6ff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const halo = new THREE.Group();
  halo.position.copy(shard.position);
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.0 + i * 0.42, 0.032, 6, 44), haloMat);
    r.rotation.set(1.1 + i * 0.5, i * 0.9, 0.4 - i * 0.7);
    r.userData.noCamBlock = true;
    halo.add(r);
  }

  // Three motes in orbit, at mote scale and mote colour: the currency itself,
  // circling the thing that takes it.
  const orbitMat = new THREE.MeshStandardMaterial({
    color: 0xe8f8ff, emissive: 0x64d8ff, emissiveIntensity: 3.2,
    roughness: 0.2, metalness: 0.1,
  });
  const orbit = new THREE.Group();
  orbit.position.copy(shard.position);
  const orbiters = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), orbitMat);
    m.userData.noCamBlock = true;
    orbit.add(m);
    orbiters.push({ mesh: m, a: (i / 3) * Math.PI * 2, r: 2.5, yy: (i - 1) * 0.5 });
  }

  // ------------------------------------------------------------ the floor ring
  // A burn ring inlaid in the deck, in the crucible's own colour: from four
  // hundred metres the shaft says where the counter is, and from ten the ring
  // says whether it has anything for you.
  const ringGeo = new THREE.RingGeometry(DECK_R - 1.5, DECK_R - 0.9, 60);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x6fd8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(x, y + DECK_H + 0.06, z);
  ring.renderOrder = 3;
  ring.userData.noCamBlock = true;

  // ------------------------------------------------------------- the landmark
  // The same volumetric shaft the rifts stand under, at half power and in the
  // foundry's own colour. This is the entire reason a player who wandered off
  // to the far ridge can find their way back to the shop.
  const shaft = createBeacon(7);
  shaft.position.set(x, y + DECK_H + 0.3, z);
  shaft.renderOrder = 4;
  shaft.material.uniforms.uCol.value.copy(TONE.none);
  shaft.material.uniforms.uPow.value = 0.42;

  const lamp = new THREE.PointLight(0x8fd8ff, 6, 34, 2);
  lamp.position.set(x, y + DECK_H + 4.2, z);

  const group = new THREE.Group();
  group.name = 'foundry';
  group.add(stone, collars, shard, halo, orbit, ring, shaft, lamp);
  scene?.add(group);

  // The deck is real ground. Registered the way src/world/caches.js registers
  // its perches — `fixed`, so it is never counted as something the cadet built
  // and can never be cleared out from under him — which is what lets a player
  // stand on the stone, build off it, and vault from it.
  if (builder?.solids) {
    const top = y + DECK_H;
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        // A cross, not a square. The deck is a hexagon 11.2 m across and the
        // lattice cell is 4 m, so the four diagonal cells would hang two metres
        // out past the stone as invisible floor.
        if (gx && gz) continue;
        builder.solids.add({
          kind: 'floor', x: x + gx * CELL, y: top, z: z + gz * CELL, yaw: 0,
          base: top, onGround: true, dead: false, fixed: true, grow: 1, fade: 0,
          sel: 0, want: 0, tone: 0, id: -9000 - (gx + 1) * 8 - (gz + 1),
        });
      }
    }
  }

  // ---------------------------------------------------------------- the hail
  // What the world says when you are near enough to act. Named, priced, and a
  // control in its own right: a thumb and a mouse can both press it, because a
  // prompt that only a keyboard can answer is the bug this whole file is about.
  const hail = document.createElement('button');
  hail.type = 'button';
  hail.className = 'hail';
  hail.innerHTML = '<u></u><span><b></b><em></em></span>';
  hail.addEventListener('click', () => open());
  (root || document.body).appendChild(hail);

  // --------------------------------------------------------------- the panel
  const panel = document.createElement('div');
  panel.className = 'fdy';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `
    <div class="fdy-card plate">
      <div class="fdy-head">
        <span class="fdy-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2 L21 12 L12 22 L3 12 Z"/></svg>
        </span>
        <span class="fdy-titles">
          <u class="fdy-kick"></u>
          <b class="fdy-name"></b>
        </span>
        <span class="fdy-purse">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L20 12 L12 22 L4 12 Z"/></svg>
          <i class="fdy-n">0</i><em class="fdy-unit"></em>
        </span>
      </div>
      <p class="fdy-lede"></p>
      <ul class="fdy-stock"></ul>
      <div class="fdy-foot">
        <span class="fdy-note"></span>
        <button type="button" class="fdy-close"></button>
      </div>
    </div>`;
  (root || document.body).appendChild(panel);

  const $ = (s) => panel.querySelector(s);
  const stockEl = $('.fdy-stock');
  $('.fdy-close').addEventListener('click', () => close());
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  let open_ = false;
  let armed = true;          // has the player left and come back since it opened
  let visited = false;
  let toneNow = 'none';
  let flareT = 0;
  let padPrev = false;
  const rows = new Map();

  function distance() {
    return Math.hypot(player.pos.x - x, player.pos.z - z);
  }

  // ------------------------------------------------------------------ opening
  function open() {
    // Anything else that has taken the frame — a tear, a rank rite, the
    // session's close card — owns it. A counter that opens underneath a modal
    // is worse than a counter nobody finds.
    if (open_ || isBusy() || input?.uiOpen) return false;
    open_ = true;
    visited = true;
    armed = false;
    paint();
    panel.classList.add('show');
    if (input) input.uiOpen = true;
    document.exitPointerLock?.();
    fx?.setDialogue?.(true, site);
    // Focus lands on the first thing that can be bought, so a keyboard or a pad
    // can shop without a pointer at all.
    setTimeout(() => (panel.querySelector('.fdy-buy:not([disabled])') || $('.fdy-close'))?.focus(), 40);
    return true;
  }

  function close() {
    if (!open_) return false;
    open_ = false;
    panel.classList.remove('show');
    if (input) input.uiOpen = false;
    fx?.setDialogue?.(false);
    return true;
  }

  // -------------------------------------------------------------- the shelves
  /** One row per thing shards buy, built once and repainted in place. */
  function row(item) {
    let r = rows.get(item.id);
    if (!r) {
      const li = document.createElement('li');
      li.className = 'fdy-row';
      li.innerHTML = `
        <i class="fdy-ic" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></i>
        <span class="fdy-body"><b></b><em></em></span>
        <span class="fdy-price"><i></i><span class="fdy-unit2"></span></span>
        <span class="fdy-act"></span>`;
      li.querySelector('.fdy-ic svg').innerHTML = ICONS[item.id] || ICONS.flare;
      stockEl.appendChild(li);
      r = {
        li,
        name: li.querySelector('.fdy-body b'),
        what: li.querySelector('.fdy-body em'),
        price: li.querySelector('.fdy-price i'),
        unit: li.querySelector('.fdy-unit2'),
        act: li.querySelector('.fdy-act'),
      };
      rows.set(item.id, r);
    }
    return r;
  }

  function paint() {
    const purse = kit.purse();
    $('.fdy-kick').textContent = t('foundry.kick');
    $('.fdy-name').textContent = t('foundry.name');
    $('.fdy-lede').textContent = t('foundry.lede');
    $('.fdy-n').textContent = String(purse);
    $('.fdy-unit').textContent = t('foundry.unit', { n: purse });
    $('.fdy-close').textContent = t('foundry.leave');
    $('.fdy-note').textContent = t('foundry.note');
    panel.setAttribute('aria-label', t('foundry.name'));

    for (const item of kit.stock()) {
      const r = row(item);
      r.name.textContent = t(item.nameKey);
      r.what.textContent = t('foundry.' + item.id + '.what');
      r.price.textContent = String(item.price);
      r.unit.textContent = t('foundry.unit', { n: item.price });
      r.li.dataset.state = item.state;
      r.li.classList.toggle('afford', item.state === 'buy');

      r.act.textContent = '';
      r.act.className = 'fdy-act';
      if (item.state === 'buy' || item.state === 'poor') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fdy-buy';
        b.disabled = item.state !== 'buy';
        b.textContent = item.state === 'buy'
          ? t('foundry.take')
          : t('foundry.short', { n: item.price - purse });
        b.addEventListener('click', () => buy(item.id));
        r.act.appendChild(b);
      } else {
        const s = document.createElement('span');
        s.className = 'fdy-state ' + item.state;
        s.textContent = item.state === 'held'
          ? t('foundry.inHand', { key: item.key })
          : t(item.lock?.key || 'foundry.sealedLines', { n: item.lock?.n || 1 });
        r.act.appendChild(s);
      }
      // What a player already carries, said on the row that sells it.
      if (item.carried > 0) {
        const c = document.createElement('span');
        c.className = 'fdy-carry';
        c.textContent = t('foundry.carried', { n: item.carried, key: item.key });
        r.act.appendChild(c);
      }
    }
  }

  function buy(id) {
    const res = kit.buy(id);
    if (!res) return;
    flareT = 1;
    paint();
    // Focus must not be left on a button that has just been repainted out from
    // under the hand that pressed it.
    setTimeout(() => (panel.querySelector('.fdy-buy:not([disabled])') || $('.fdy-close'))?.focus(), 30);
  }

  // ------------------------------------------------------------------- frame
  function update(dt, time) {
    const d = distance();
    const near = d < HAIL_R;

    // ---- the crucible reads the wallet, from any distance ----
    const tone = kit.tone();
    if (tone !== toneNow) {
      toneNow = tone;
      if (tone !== 'none') flareT = Math.max(flareT, 0.8);
    }
    const col = TONE[toneNow];
    const pulse = 0.5 + 0.5 * Math.sin(time * (toneNow === 'none' ? 0.7 : 1.9));
    const heat = (toneNow === 'none' ? 0.5 : 1.25 + 0.35 * pulse) + flareT * 2.4;
    shard.material.emissive.copy(col);
    shard.material.emissiveIntensity = heat;
    ringMat.color.copy(col);
    ringMat.opacity = (toneNow === 'none' ? 0.22 : 0.5 + 0.22 * pulse) + flareT * 0.4;
    haloMat.color.copy(col);
    haloMat.opacity = (toneNow === 'none' ? 0.16 : 0.44) + flareT * 0.35;
    lamp.color.copy(col);
    lamp.intensity = (toneNow === 'none' ? 2.2 : 7 + 2.5 * pulse) + flareT * 9;
    shaft.material.uniforms.uCol.value.copy(col);
    shaft.material.uniforms.uPow.value = (toneNow === 'none' ? 0.24 : 0.5) + flareT * 0.45;
    shaft.material.uniforms.uTime.value = time;
    flareT = Math.max(0, flareT - dt * 1.4);

    shard.rotation.y = time * 0.32;
    shard.rotation.x = Math.sin(time * 0.4) * 0.14;
    shard.position.y = y + DECK_H + 4.4 + Math.sin(time * 0.8) * 0.16;
    halo.position.y = shard.position.y;
    halo.rotation.y = -time * 0.22;
    halo.children[0].rotation.z = 0.4 + time * 0.3;
    halo.children[1].rotation.z = -0.3 - time * 0.24;
    orbit.position.y = shard.position.y;
    for (const o of orbiters) {
      const a = o.a + time * 0.62;
      o.mesh.position.set(Math.cos(a) * o.r, o.yy + Math.sin(time * 1.3 + o.a) * 0.22, Math.sin(a) * o.r);
      o.mesh.rotation.y = time * 1.4 + o.a;
    }

    // ---- the hail ----
    const wantHail = near && !open_ && !isBusy() && !input?.uiOpen;
    if (wantHail) {
      const n = kit.affordable();
      hail.querySelector('u').textContent = HAIL_KEY;
      hail.querySelector('b').textContent = t('foundry.name');
      hail.querySelector('em').textContent = n > 0
        ? t('foundry.hailStock', { n })
        : t('foundry.hailNone');
      hail.classList.toggle('warm', n > 0);
    }
    hail.classList.toggle('show', wantHail);

    // ---- walking in is the interaction ----
    if (d > REARM_R) armed = true;
    const onDeck = d < OPEN_R && player.pos.y - y > -2.4 && player.pos.y - y < 4.2;
    if (onDeck && armed) open();

    // A pad has no E. Read the same button the world's interact verb reads,
    // edge-triggered here because the kit ticks after `input.endFrame()` has
    // already cleared the frame's own edge.
    const padDown = !!(input?.gamepad && input.source === 'pad' && input.gamepad.buttons[2]?.pressed);
    if (padDown && !padPrev && near) open();
    padPrev = padDown;
  }

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape' && open_) { close(); e.preventDefault(); return; }
    if (e.code !== 'KeyE' || input?.uiOpen || isBusy()) return;
    if (distance() < HAIL_R) { open(); e.preventDefault(); }
  });

  onLocaleChange(() => { if (open_) paint(); });

  return {
    update,
    open,
    close,
    /** The panel is modal: the kit's own verbs must not fire underneath it. */
    isOpen: () => open_,
    /** Has the player ever opened it — the nudge stops the moment they have. */
    seen: () => visited,
    distance,
    pos: site,
    /** Repaint from outside: the wallet moves while the panel is open. */
    refresh() { if (open_) paint(); },
    reset() { visited = false; armed = true; close(); },
  };
}

// i18n-allow: the key cap printed on the hail — a keyboard legend, not a word
const HAIL_KEY = 'E';

/** One glyph per shelf. Drawn, not lettered, so nothing here needs translating. */
const ICONS = {
  flare: '<path d="M12 21 V9"/><path d="M7 12 L12 5 L17 12"/><path d="M5 20h14"/>',
  beacon: '<path d="M12 22 V6"/><path d="M8 9 L12 3 L16 9"/><path d="M4 22 L8 16"/><path d="M20 22 L16 16"/>',
  plate: '<path d="M3 15 L12 10 L21 15 L12 20 Z"/><path d="M12 8 V2"/><path d="M9 5 L12 2 L15 5"/>',
  station: '<path d="M12 2 L19 8 V21 H5 V8 Z"/><path d="M9 21 V13 h6 v8"/>',
};
