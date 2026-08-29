#!/usr/bin/env node
/**
 * THE HANDEDNESS GATE — left is left, on every surface, in one convention.
 *
 *   node tools/critic/handed.mjs
 *   node tools/critic/handed.mjs --self-test    # plant an inversion at every site
 *   node tools/critic/handed.mjs --root <dir>   # read src/ out of another tree
 *
 * WHY THIS FILE EXISTS
 *
 * This project has shipped a left-for-right inversion TWICE, and both times
 * every gate in the repo was green.
 *
 *   1. The client reported it himself: *"A and D movement for character are
 *      backwards."* `src/player/controller.js` built the strafe basis as
 *      `(fz, 0, -fx)`, which is the LEFT vector, and used it as screen-right.
 *      Nothing in the build could see it: the mathematics was consistent, the
 *      frame rate was fine, the screenshots looked correct because a still
 *      frame has no handedness.
 *   2. A critic found `src/meta/guide.js` telling the player to turn one way
 *      while the arrow pinned to the same marker pointed the other. One sign,
 *      one surface, and the objective card and the Orders screen both read off
 *      it.
 *   3. And this gate found a third, live, unreported: `src/world/afford.js`
 *      writes the compass needle as `rotate: -ang`, which mirrors the needle
 *      about the screen's vertical axis. It is the only bearing instrument on
 *      screen when the objective card is down.
 *
 * An inversion is invisible to every instrument this repo had, because every
 * instrument checks that a number is *present* and *finite*. A mirrored world
 * is present and finite. It is also unplayable, and it is the single most
 * humiliating class of defect a game can ship, because the player finds it in
 * four seconds and cannot un-see it.
 *
 * WHAT THIS GATE DOES THAT A UNIT TEST DOES NOT
 *
 * It does not test a copy of the rule. It CUTS THE REAL EXPRESSION OUT OF THE
 * SHIPPED SOURCE FILE and executes it. If somebody edits
 * `src/player/controller.js`, this gate runs the edited line. There is no
 * second copy of the convention to drift.
 *
 * And it does not hold a hand-written list of places to look, because a
 * hand-written list is how `check:choices` covered 24 of 62 skills for months.
 * It holds a CENSUS: five textual rules that find every chirality-bearing
 * construction in `src/`, and every hit must be either a registered site with a
 * live probe, or in `NOT_CHIRAL` with a written reason. A new left/right
 * decision that nobody registered turns this gate red the day it is written.
 * That is the half that makes a third occurrence impossible.
 *
 * THE CONVENTION, DERIVED ONCE
 *
 * Three.js is Y-up and right-handed. A camera looks down its own local −Z, its
 * local +X is screen-right, its local +Y is up. From X = Y × Z and Z = −f:
 *
 *     right = f × up = (−f.z, 0, f.x)              for horizontal f
 *
 * This project writes forward off a yaw as f = (sin θ, 0, cos θ), so
 * right = (−cos θ, 0, sin θ) and increasing θ turns LEFT.
 *
 *     v is to the RIGHT of f   ⟺   dot(v, right) > 0   ⟺   f.x·v.z − f.z·v.x > 0
 *
 * That last expression is the whole gate. It is what `src/player/controller.js`
 * writes in a comment, what `src/audio/index.js` computes with `crossVectors`,
 * and what `src/meta/guide.js:282` computes correctly and then LABELS BACKWARDS.
 *
 * Screen space: +x right, +y DOWN. CSS `rotate: Ndeg` is clockwise. A glyph
 * whose apex is at minimum y points up at 0deg, so rotating it by θ points it
 * along (sin θ, −cos θ). The gate reads each arrow glyph's own geometry rather
 * than assuming it points up — a flipped glyph is the same defect wearing a
 * different hat.
 */
import { readFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findings } from '../_findings.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const SELF_TEST = argv.includes('--self-test');
const VERBOSE = argv.includes('--verbose');
const rootArg = (() => { const i = argv.indexOf('--root'); return i >= 0 ? argv[i + 1] : null; })();
const ROOT = path.resolve(rootArg || path.join(HERE, '..', '..'));
const SRC = path.join(ROOT, 'src');

// ---------------------------------------------------------------------------
// THE CANONICAL MODEL. Two derivations, cross-checked against each other, so a
// typo in the gate's own model cannot quietly redefine "right".
// ---------------------------------------------------------------------------
const fwdOf = (yaw) => ({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });
/** right = f × up, written out longhand. */
const rightOf = (yaw) => {
  const f = fwdOf(yaw), up = { x: 0, y: 1, z: 0 };
  return { x: f.y * up.z - f.z * up.y, y: f.z * up.x - f.x * up.z, z: f.x * up.y - f.y * up.x };
};
/** The same vector, written from the closed form the project's comments use. */
const rightClosed = (yaw) => ({ x: -Math.cos(yaw), y: 0, z: Math.sin(yaw) });
const dot = (a, b) => a.x * b.x + (a.y || 0) * (b.y || 0) + a.z * b.z;
/** Positive when v lies to the RIGHT of forward f. The one expression. */
const rightness = (f, v) => f.x * v.z - f.z * v.x;
const YAWS = [0, 0.61, 1.57, 2.9, -0.8, -2.4, 3.9, 5.5];

// ---------------------------------------------------------------------------
// Source surgery. Every cut FAILS LOUDLY if its anchor is gone: a gate that
// silently stops matching is the disease, not the cure.
// ---------------------------------------------------------------------------
class CutError extends Error {}
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Balanced slice starting at the opener at or after `from`. */
function balanced(src, from, open, close) {
  const start = src.indexOf(open, from);
  if (start < 0) throw new CutError(`no "${open}" after index ${from}`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) return { start, end: i + 1, text: src.slice(start, i + 1) }; }
  }
  throw new CutError(`unbalanced "${open}" from index ${start}`);
}

/** From the start of the line matching `fromRe` to the end of the line matching `toRe`. */
function cutLines(src, fromRe, toRe, label) {
  const a = src.match(fromRe);
  if (!a) throw new CutError(`${label}: nothing matches ${fromRe}`);
  const startLine = src.lastIndexOf('\n', a.index) + 1;
  const b = src.slice(a.index).match(toRe);
  if (!b) throw new CutError(`${label}: nothing matches ${toRe} after ${fromRe}`);
  const endIdx = a.index + b.index + b[0].length;
  const endLine = src.indexOf('\n', endIdx);
  return { text: src.slice(startLine, endLine < 0 ? src.length : endLine), line: lineOf(src, startLine) };
}

/** From the start of the line matching `fromRe`, through the balanced close of
    the next block that `openRe` names. Used where the statement that matters
    sits inside an `if`, so cutting at the statement would leave a stray brace. */
function cutBlock(src, fromRe, openRe, label) {
  const a = src.match(fromRe);
  if (!a) throw new CutError(`${label}: nothing matches ${fromRe}`);
  const startLine = src.lastIndexOf('\n', a.index) + 1;
  const o = src.slice(a.index).match(openRe);
  if (!o) throw new CutError(`${label}: nothing matches ${openRe} after ${fromRe}`);
  const blk = balanced(src, a.index + o.index, '{', '}');
  return { text: src.slice(startLine, blk.end), line: lineOf(src, startLine) };
}

/** Top-level commas only: `turn(fwd.x, fwd.z, m.x - p.x, m.z - p.z)` is four. */
function splitArgs(parenText) {
  const inner = parenText.slice(1, -1);
  const out = [];
  let depth = 0, cur = '';
  for (const ch of inner) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/**
 * Names a FORWARD vector is allowed to have at a call into src/world/bearing.js.
 * Not decoration: `turn(a, b, c, d)` with the pairs swapped is an inversion,
 * and the only cheap way to see it in review is to be able to read "forward"
 * off the first pair.
 */
const FORWARD_NAMES = /^(fwd|forward|f|h|hd|cam|camF|look|heading|face|aim)$/;

/** A whole named function declaration, braces balanced. */
function cutFunction(src, name) {
  const m = src.match(new RegExp(`function\\s+${name}\\s*\\(`));
  if (!m) throw new CutError(`no function ${name}()`);
  const body = balanced(src, m.index, '{', '}');
  return { text: src.slice(m.index, body.end), line: lineOf(src, m.index) };
}

// ---------------------------------------------------------------------------
// The stubs the cut source runs against. Small on purpose: anything this shim
// gets wrong shows up as a gate that cannot reproduce a KNOWN-GOOD answer, and
// every probe below asserts a correct case as well as an inverted one.
// ---------------------------------------------------------------------------
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  crossVectors(a, b) {
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEG = 180 / Math.PI;
/** A CSS `rotate: Ndeg` string turned into the screen direction the glyph points. */
function pointsAt(cssRotate, glyphUp = { x: 0, y: -1 }) {
  const m = String(cssRotate).match(/(-?\d+(?:\.\d+)?(?:e-?\d+)?)deg/);
  if (!m) throw new CutError(`not a deg rotation: ${cssRotate}`);
  const t = Number(m[1]) / DEG;
  // clockwise on a y-down screen
  return { x: glyphUp.x * Math.cos(t) - glyphUp.y * Math.sin(t), y: glyphUp.x * Math.sin(t) + glyphUp.y * Math.cos(t) };
}
const screenAgree = (a, b) => {
  const la = Math.hypot(a.x, a.y) || 1, lb = Math.hypot(b.x, b.y) || 1;
  return (a.x * b.x + a.y * b.y) / (la * lb);
};

// ---------------------------------------------------------------------------
// THE SITES. Every place in src/ that turns geometry into a left-or-right the
// player can feel. `cut` pulls the real text; `probe` runs it and returns
// findings; `invert` is the plant the self-test applies to prove the probe bites.
// ---------------------------------------------------------------------------
export const SITES = [
  // ------------------------------------------------------- the one definition
  {
    id: 'definition/left',
    file: 'src/world/bearing.js',
    surface: 'the single place in this tree that decides which way is left',
    why: 'A sign error is not a hard bug, it is an UNOWNABLE one: every author re-derives a x b at '
       + 'the call site, half get it right, and no reviewer reads a minus sign and calls it wrong. '
       + 'So the expression may exist exactly once. This site proves that once against three.js\'s '
       + 'OWN camera.project() — the matrix that puts the pixels on the glass — rather than against '
       + 'another derivation, because two derivations by the same hand agree with each other for the '
       + 'same reason they are both wrong.',
    mode: 'module',
    async probe(_t, _all, mod) {
      const out = [];
      const three = await import('three');
      const { PerspectiveCamera, Vector3 } = three;
      const cam = new PerspectiveCamera(70, 16 / 9, 0.1, 4000);
      const f = new Vector3();
      let sweeps = 0;
      for (const yaw of YAWS) {
        for (const pitch of [0, 0.35, -0.4]) {
          cam.position.set(11, 7, -23);
          cam.lookAt(new Vector3(
            cam.position.x + Math.sin(yaw) * 10,
            cam.position.y + Math.tan(pitch) * 10,
            cam.position.z + Math.cos(yaw) * 10));
          cam.updateMatrixWorld(true);
          cam.getWorldDirection(f);
          for (const off of [-1.3, -0.7, -0.24, 0.24, 0.7, 1.3]) {
            for (const dist of [9, 60, 300]) {
              const tgt = new Vector3(
                cam.position.x + Math.sin(yaw + off) * dist, cam.position.y,
                cam.position.z + Math.cos(yaw + off) * dist);
              const ndc = tgt.clone().project(cam);
              const behind = Math.abs(off) > Math.PI / 2;
              const v = { x: tgt.x - cam.position.x, z: tgt.z - cam.position.z };
              const s = mod.side(f.x, f.z, v.x, v.z);
              sweeps++;
              // In front of the lens, the projection IS the answer: NDC +x is
              // screen-right, by definition of the matrix.
              if (!behind && Math.sign(ndc.x) !== s) {
                out.push(`yaw ${yaw.toFixed(2)} pitch ${pitch} off ${off}: side() says ${s > 0 ? 'right' : 'left'} `
                  + `and camera.project() puts it at NDC x=${ndc.x.toFixed(3)} (${ndc.x > 0 ? 'right' : 'left'} of the screen)`);
              }
              // …and the signed turn has to agree with the side it belongs to,
              // and be the CSS rotation that points an up-glyph at the thing.
              const deg = mod.turnDeg(f.x, f.z, v.x, v.z);
              if (Math.sign(deg) !== s && s !== 0) out.push(`turnDeg ${deg.toFixed(1)} disagrees with side() ${s}`);
              const pts = pointsAt(`${deg}deg`);
              // rightness = f.x*v.z - f.z*v.x = sin(-off); a POSITIVE off turns LEFT.
              const want = { x: -Math.sin(off), y: -Math.cos(off) };
              if (screenAgree(pts, want) < 0.999) {
                out.push(`a target ${(off * DEG).toFixed(0)}° off the nose gets rotate:${deg.toFixed(1)}deg, `
                  + `which points (${pts.x.toFixed(2)}, ${pts.y.toFixed(2)}) and not (${want.x.toFixed(2)}, ${want.y.toFixed(2)})`);
              }
            }
          }
        }
      }
      // The word bands: every id it can return must be one it declares, and the
      // left half must mirror the right half exactly.
      for (const off of [0, 0.2, 0.7, 1.2, 1.8, 2.6, 3.1]) {
        for (const yaw of YAWS) {
          const fw = fwdOf(yaw);
          const R = fwdOf(yaw - off), L = fwdOf(yaw + off);   // +off turns LEFT
          const wr = mod.bearingWord(fw.x, fw.z, R.x, R.z);
          const wl = mod.bearingWord(fw.x, fw.z, L.x, L.z);
          if (!mod.BEARINGS.includes(wr)) out.push(`bearingWord returned "${wr}", which BEARINGS does not declare`);
          const mirror = wr.replace(/Right/, '@').replace(/Left/, 'Right').replace(/@/, 'Left')
            .replace(/^right$/, '@').replace(/^left$/, 'right').replace(/^@$/, 'left');
          if (wl !== mirror) out.push(`a target ${(off * DEG).toFixed(0)}° right is "${wr}" but the same angle left is "${wl}", not "${mirror}"`);
        }
      }
      if (!sweeps) out.push('the projection sweep ran zero cases, so it proved nothing');
      return out;
    },
    /** The plant: swap the two halves of the cross product inside the one definition. */
    plantSource: (src) => src
      .replace('const c = fx * vz - fz * vx;', 'const c = fz * vx - fx * vz;')
      .replace('return Math.atan2(ax * bz - az * bx, ax * bx + az * bz);', 'return Math.atan2(az * bx - ax * bz, ax * bx + az * bz);'),
  },
  // ---------------------------------------------------------------- movement
  {
    id: 'move/strafe-basis',
    file: 'src/player/controller.js',
    surface: 'the player moves sideways',
    why: 'THE ONE THE CLIENT REPORTED: "A and D movement for character are backwards." '
       + 'The basis was written (fz, 0, -fx), which is the LEFT vector, and used as screen-right.',
    cut: (s) => cutLines(s, /const fx = Math\.sin\(this\.yaw\)/, /_wish\.set\([\s\S]*?\);/, 'controller wish'),
    invert: (t) => t.replace(/-fz \* inp\.move\.x \+ fx \* inp\.move\.y/, 'fz * inp.move.x + fx * inp.move.y')
                    .replace(/fx \* inp\.move\.x \+ fz \* inp\.move\.y/, '-fx * inp.move.x + fz * inp.move.y'),
    probe(text) {
      const run = new Function('inp', `${text}\nreturn wish;`);
      const out = [];
      for (const yaw of YAWS) {
        const r = rightOf(yaw), f = fwdOf(yaw);
        const d = run.call({ yaw, _wish: new V3() }, { move: { x: 1, y: 0 }, moveMag: 1 });
        if (dot(d, r) < 0.99) out.push(`yaw ${yaw.toFixed(2)}: pressing D moves ${dot(d, r) < 0 ? 'LEFT' : 'off-axis'} (dot with screen-right ${dot(d, r).toFixed(3)})`);
        const l = run.call({ yaw, _wish: new V3() }, { move: { x: -1, y: 0 }, moveMag: 1 });
        if (dot(l, r) > -0.99) out.push(`yaw ${yaw.toFixed(2)}: pressing A does not move left (dot with screen-right ${dot(l, r).toFixed(3)})`);
        const w = run.call({ yaw, _wish: new V3() }, { move: { x: 0, y: 1 }, moveMag: 1 });
        if (dot(w, f) < 0.99) out.push(`yaw ${yaw.toFixed(2)}: pressing W does not move forward (dot with forward ${dot(w, f).toFixed(3)})`);
      }
      return out;
    },
  },
  {
    id: 'move/key-lateral',
    file: 'src/core/input.js',
    surface: 'the keyboard lateral axis',
    why: 'The other half of the client\'s report. D must be +1 on the axis the strafe basis reads; '
       + 'swapping the two key names here inverts movement without touching a vector.',
    cut: (s) => cutLines(s, /const kx = \(k\.has\('KeyD'\)/, /const kx = [^\n]*;/, 'input kx'),
    invert: (t) => t.replace("k.has('KeyD')", '@@D@@').replace("k.has('KeyA')", "k.has('KeyD')").replace('@@D@@', "k.has('KeyA')"),
    probe(text) {
      const run = new Function('k', `${text}\nreturn kx;`);
      const out = [];
      if (run(new Set(['KeyD'])) !== 1) out.push(`D gives ${run(new Set(['KeyD']))} on the lateral axis, not +1 (right)`);
      if (run(new Set(['KeyA'])) !== -1) out.push(`A gives ${run(new Set(['KeyA']))} on the lateral axis, not -1 (left)`);
      if (run(new Set()) !== 0) out.push('no key held is not zero on the lateral axis');
      return out;
    },
  },
  {
    id: 'move/pad-lateral',
    file: 'src/core/input.js',
    surface: 'the gamepad left stick',
    why: 'A pad axis is a raw number with no name on it. Negating axes[0] here mirrors a controller '
       + 'while the keyboard stays correct, which is the hardest inversion to notice because half the '
       + 'inputs still work.',
    cut: (s) => {
      const dz = cutLines(s, /const STICK_DZ = /, /const STICK_DZ = [^\n]*;/, 'stick deadzone');
      const fn = cutFunction(s, 'stick');
      const use = cutLines(s, /const \[mx, my, mm\] = stick\(/, /this\.move\.x = mx;[^\n]*/, 'pad move');
      return { text: `${dz.text}\n${fn.text}\n${use.text}`, line: use.line };
    },
    invert: (t) => t.replace('stick(ax[0] || 0,', 'stick(-(ax[0] || 0),'),
    probe(text) {
      const run = new Function('ax', `const self = { move: {}, look: {} };\n${text.replace(/this\./g, 'self.')}\nreturn self.move.x;`);
      const out = [];
      if (!(run([0.9, 0]) > 0.2)) out.push(`stick pushed right gives move.x = ${run([0.9, 0])}, not a positive (right) lateral`);
      if (!(run([-0.9, 0]) < -0.2)) out.push(`stick pushed left gives move.x = ${run([-0.9, 0])}, not a negative (left) lateral`);
      return out;
    },
  },
  {
    id: 'move/touch-lateral',
    file: 'src/player/touch.js',
    surface: 'the on-screen thumbstick',
    why: 'Touch has to be playable (BRIEF invariant 6) and it is the input nobody re-tests after a '
       + 'refactor. Screen dx is positive to the right; move.x must carry that sign through unchanged.',
    cut: (s) => cutLines(s, /input\.move\.x = dx \* inv;/, /input\.move\.x = [^\n]*;/, 'touch move'),
    invert: (t) => t.replace('input.move.x = dx * inv;', 'input.move.x = -dx * inv;'),
    probe(text) {
      const run = new Function('dx', 'dy', 'inv', 'input', `${text}\nreturn input;`);
      const out = [];
      const r = run(1, 0, 1, { move: {} });
      if (!(r.move.x > 0.9)) out.push(`thumb dragged right gives move.x = ${r.move.x}, not +1`);
      const l = run(-1, 0, 1, { move: {} });
      if (!(l.move.x < -0.9)) out.push(`thumb dragged left gives move.x = ${l.move.x}, not -1`);
      const u = run(0, -1, 1, { move: {} });
      if (!(u.move.y > 0.9)) out.push(`thumb dragged up the screen gives move.y = ${u.move.y}, not forward`);
      return out;
    },
  },
  // ------------------------------------------------------------------ camera
  {
    id: 'look/mouse-yaw',
    file: 'src/core/input.js + src/player/controller.js',
    surface: 'the camera turns with the mouse',
    why: 'Yaw sign is the one place where three files have to agree: the mouse writes look.x, the '
       + 'controller subtracts it, and forward is written off the result as (sin, 0, cos). Flip any '
       + 'one and pushing the mouse right turns the world the wrong way.',
    files: ['src/core/input.js', 'src/player/controller.js'],
    cut: (s, all) => {
      const look = cutLines(all['src/core/input.js'], /const k = [\d.]+ \* this\.sensitivity;/, /this\.look\.x \+= e\.movementX[^\n]*;/, 'mouse look');
      const yaw = cutLines(all['src/player/controller.js'], /this\.yaw -= inp\.look\.x;|this\.yaw \+= inp\.look\.x;/, /this\.yaw [^\n]*inp\.look\.x;/, 'yaw apply');
      return { text: `${look.text}\n${yaw.text}`, line: yaw.line };
    },
    invert: (t) => t.replace('this.yaw -= inp.look.x;', 'this.yaw += inp.look.x;'),
    probe(text) {
      const run = new Function('e', 'self', `const inp = self;\n${text}\nreturn self.yaw;`);
      const out = [];
      for (const yaw0 of YAWS) {
        const self = { yaw: yaw0, look: { x: 0, y: 0 }, sensitivity: 1, invertY: false, source: '' };
        const after = run.call(self, { movementX: 120, movementY: 0 }, self);
        const moved = fwdOf(after);
        if (!(dot(moved, rightOf(yaw0)) > 0.001)) {
          out.push(`yaw ${yaw0.toFixed(2)}: mouse pushed right turns the camera ${dot(moved, rightOf(yaw0)) < 0 ? 'LEFT' : 'nowhere'}`);
        }
      }
      return out;
    },
  },
  {
    id: 'look/key-turn',
    file: 'src/core/input.js + src/player/controller.js',
    surface: 'the arrow keys turn the camera',
    why: 'The only way to look around on a machine that denied pointer lock — a school Chromebook '
       + 'with a locked-down policy. If this is mirrored, that player is the only one who suffers, '
       + 'and nobody who tests with a mouse will ever see it.',
    files: ['src/core/input.js', 'src/player/controller.js'],
    cut: (s, all) => {
      const kt = cutLines(all['src/core/input.js'], /const KEY_TURN = /, /const KEY_TURN = [^\n]*;/, 'key turn rate');
      const tx = cutBlock(all['src/core/input.js'], /const tx = \(k\.has\('ArrowRight'\)/, /if \(tx \|\| ty\) \{/, 'key turn');
      tx.text = `${kt.text}\n${tx.text}`;
      const yaw = cutLines(all['src/player/controller.js'], /this\.yaw -= inp\.look\.x;|this\.yaw \+= inp\.look\.x;/, /this\.yaw [^\n]*inp\.look\.x;/, 'yaw apply');
      return { text: `${tx.text}\n${yaw.text}`, line: tx.line };
    },
    invert: (t) => t.replace("k.has('ArrowRight')", '@@R@@').replace("k.has('ArrowLeft')", "k.has('ArrowRight')").replace('@@R@@', "k.has('ArrowLeft')"),
    probe(text) {
      // The cut carries `const ty = …(PageDown/PageUp)` and the `if (tx || ty)` guard with it.
      const run = new Function('k', 'self', 'dt', `const inp = self;\n${text}\nreturn self.yaw;`);
      const out = [];
      for (const yaw0 of YAWS) {
        for (const [key, want, word] of [['ArrowRight', 1, 'right'], ['ArrowLeft', -1, 'left']]) {
          const self = { yaw: yaw0, look: { x: 0, y: 0 }, sensitivity: 1, invertY: false, idleLook: 0, source: 'kbm' };
          const after = run.call(self, new Set([key]), self, 1 / 60);
          const turned = dot(fwdOf(after), rightOf(yaw0)) * want;
          if (!(turned > 0.001)) out.push(`yaw ${yaw0.toFixed(2)}: ${key} does not turn the camera ${word} (${turned.toFixed(4)})`);
        }
      }
      return out;
    },
  },
  {
    id: 'camera/shoulder-basis',
    file: 'src/player/camera.js',
    surface: 'the over-the-shoulder lens offset',
    why: 'The lens slides along a screen-right vector written a second time, in closed form, in a '
       + 'second file. Two independent spellings of the same basis is exactly how the strafe bug '
       + 'happened — and the file\'s own comment says "+1 right", so it can be held to it.',
    cut: (s) => cutLines(s, /const sr = this\._r\.set\(/, /const rig = this\._rig\.copy\(pivot\)\.addScaledVector\(sr,[^\n]*\);/, 'camera shoulder'),
    invert: (t) => t.replace('this._r.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw))', 'this._r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))'),
    probe(text) {
      const head = text.slice(0, text.indexOf('\n', text.indexOf('const sr')));
      const runSr = new Function(`${head}\nreturn sr;`);
      const out = [];
      for (const yaw of YAWS) {
        const sr = runSr.call({ yaw, _r: new V3() });
        const want = rightOf(yaw);
        if (dot(sr, want) < 0.999) out.push(`yaw ${yaw.toFixed(2)}: the camera's screen-right is ${dot(sr, want) < 0 ? 'the LEFT vector' : 'not screen-right'} (dot ${dot(sr, want).toFixed(3)})`);
      }
      // …and the offset the file documents as "+1 right" actually goes right.
      const rigLine = text.slice(text.indexOf('const rig ='));
      const runRig = new Function('pivot', 'sr', 'shScale', `${rigLine}\nreturn rig;`);
      const rig = runRig.call({ _rig: new V3(), shoulder: 1 }, new V3(0, 0, 0), rightOf(0), 1);
      if (dot(rig, rightOf(0)) <= 0) out.push('a positive shoulder does not put the lens on the cadet\'s right, which is what src/player/camera.js:80 says it means');
      return out;
    },
  },
  // --------------------------------------------------------------------- HUD
  {
    id: 'hud/direction-word',
    file: 'src/meta/guide.js',
    surface: 'the objective card names a side, and the Orders screen repeats it',
    why: 'THE SECOND SHIPPED INVERSION. `relative()` computed the right-ness of the target correctly '
       + 'and then labelled the positive case "left", on every frame, in every locale. Two '
       + 'learner-visible surfaces read it: the objective card (src/meta/guide.js) and the run '
       + 'charter (src/session/charter.js:230, "the rift is 51 m away, off to your left"). It now '
       + 'delegates to src/world/bearing.js, so what is checked here is the CALL — argument order, '
       + 'and whether every word it can return actually exists in all three bundles.',
    files: ['src/meta/guide.js', 'src/session/charter.js'],
    cut: (s2) => cutFunction(s2, 'relative'),
    invert: (t) => t.replace(/bearingWord\(([^)]*)\)/, (m, args) => {
      const a = args.split(',').map((x) => x.trim());
      return a.length === 4 ? `bearingWord(${a[2]}, ${a[3]}, ${a[0]}, ${a[1]})` : m;
    }),
    async probe(text, all, _mod) {
      const out = [];
      const bearing = await import(path.join(ROOT, 'src/world/bearing.js') + `?h=${Date.now()}`);
      const run = new Function('view', 'camera', 'fwd', 'pos', 'bearingWord',
        `${text}\nreturn relative(pos);`);
      for (const yaw of YAWS) {
        const f = fwdOf(yaw), r = rightOf(yaw);
        const camera = { position: new V3(3, 9, -4), getWorldDirection: (v) => v.set(f.x, -0.2, f.z) };
        const at = (side, ahead) => new V3(
          camera.position.x + r.x * side + f.x * ahead, camera.position.y, camera.position.z + r.z * side + f.z * ahead);
        const say = (p) => run(new V3(), camera, new V3(), p, bearing.bearingWord);
        for (const [p, want] of [
          [at(40, 6), 'right'], [at(-40, 6), 'left'],
          [at(0, 40), 'ahead'], [at(0, -40), 'behind'],
          [at(30, 30), 'aheadRight'], [at(-30, 30), 'aheadLeft'],
          [at(30, -30), 'backRight'], [at(-30, -30), 'backLeft'],
        ]) {
          const got = say(p);
          if (got !== want) out.push(`yaw ${yaw.toFixed(2)}: a target ${want} of the cadet is called "${got}"`);
        }
      }
      // A word the bundles cannot print is a card with no direction on it.
      const key = /t\('([\w.]+)\.' \+ where/.exec(all['src/session/charter.js'] || '');
      const fams = ['guide.rel', ...(key ? [key[1]] : [])];
      for (const loc of ['en', 'es', 'pl']) {
        const mod = await import(path.join(ROOT, `src/i18n/${loc}.js`) + `?h=${Date.now()}`);
        const dict = mod.default || Object.values(mod)[0];
        for (const fam of fams) {
          const node = fam.split('.').reduce((a, k) => (a ? a[k] : undefined), dict);
          if (!node) { out.push(`${loc}: the bundle has no "${fam}" at all`); continue; }
          const missing = bearing.BEARINGS.filter((b) => !node[b]);
          if (missing.length) out.push(`${loc}: "${fam}" is missing ${missing.join(', ')} — bearingWord() can return `
            + `all ${bearing.BEARINGS.length} of these and the surface would print a raw key`);
        }
      }
      return out;
    },
  },
  {
    id: 'hud/pin-arrow',
    file: 'src/meta/guide.js + src/meta/guide.css',
    surface: 'the off-screen objective marker',
    why: 'The arrow and the word beside it are computed from different quantities in different '
       + 'coordinate systems — a screen delta here, a world cross product there — so one can be '
       + 'right while the other is wrong, and that is exactly the state a critic photographed.',
    files: ['src/meta/guide.js', 'src/meta/guide.css'],
    cut: (s, all) => cutLines(all['src/meta/guide.js'], /pinArrow\.style\.rotate = /, /pinArrow\.style\.rotate = [^\n]*;/, 'pin arrow'),
    invert: (t) => t.replace('* DEG + 90', '* DEG - 90'),
    probe(text, all) {
      const out = [];
      // Which way does the glyph itself point? A CSS triangle points AWAY from
      // the one border that carries a colour.
      const css = all['src/meta/guide.css'] || '';
      const rule = css.slice(css.indexOf('.gd-arrow'));
      const solid = ['top', 'right', 'bottom', 'left'].filter((sideName) =>
        new RegExp(`border-${sideName}:[^;]*solid(?![^;]*transparent)`).test(rule.slice(0, rule.indexOf('}'))));
      if (solid.length !== 1) { out.push(`.gd-arrow does not have exactly one coloured border (${solid.join(',') || 'none'}); the gate cannot tell which way the glyph points`); return out; }
      const glyphUp = { top: { x: 0, y: 1 }, bottom: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } }[solid[0]];
      const run = new Function('dx', 'dy', 'DEG', 'pinArrow', `${text}\nreturn pinArrow.style.rotate;`);
      for (const [dx, dy, word] of [[1, 0, 'right'], [-1, 0, 'left'], [0, -1, 'above'], [0, 1, 'below'], [0.7, -0.7, 'up and right']]) {
        const el = { style: {} };
        run(dx, dy, DEG, el);
        const points = pointsAt(el.style.rotate, glyphUp);
        const agree = screenAgree(points, { x: dx, y: dy });
        if (agree < 0.98) out.push(`a marker ${word} of centre gets an arrow at ${el.style.rotate} pointing (${points.x.toFixed(2)}, ${points.y.toFixed(2)}) — agreement ${agree.toFixed(3)}`);
      }
      return out;
    },
  },
  {
    id: 'hud/compass-needle',
    file: 'src/world/afford.js',
    surface: 'the compass that says "that way, 140 m"',
    why: 'A third spelling of the same bearing, in a third file, feeding a CSS rotation. It is the '
       + 'only instrument on screen when the objective card is not up, and a needle pointing the '
       + 'wrong way is worse than no needle: the player trusts it.',
    files: ['src/world/afford.js', 'src/world/bearing.js'],
    cut: (s2) => cutLines(s2, /const ang = turn\(|const ang = Math\.atan2\(/, /needle\.style\.rotate = [^\n]*;/, 'compass needle'),
    invert: (t) => (/\$\{-ang \* DEG\}deg/.test(t)
      ? t.replace('${-ang * DEG}deg', '${ang * DEG}deg')
      : t.replace('${ang * DEG}deg', '${-ang * DEG}deg')),
    async probe(text, all) {
      const out = [];
      // The needle glyph's own geometry: the vertex furthest from the centroid,
      // in a y-down viewBox.
      const svg = (all['src/world/afford.js'] || '').match(/afd-needle[^>]*><svg[^>]*><path d="([^"]+)"/);
      if (!svg) { out.push('the compass needle glyph is not where this gate can read it; it cannot say which way the arrow points'); return out; }
      const pts = [...svg[1].matchAll(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const apex = pts.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) > Math.hypot(best.x - cx, best.y - cy) ? p : best), pts[0]);
      const glyphUp = { x: apex.x - cx, y: apex.y - cy };
      const bearingMod = await import(path.join(ROOT, 'src/world/bearing.js') + `?h=${Date.now()}`);
      const run = new Function('hd', 'fwd', 'dir', 'needle', 'DEG', 'turn',
        `${text}\nreturn needle.style.rotate;`);
      for (const yaw of YAWS) {
        for (const bearing of [0, 0.9, -0.9, 2.2, -2.2, 3.0]) {
          const f = fwdOf(yaw);
          const target = fwdOf(yaw + bearing);
          const el = { style: {} };
          run({ yaw: yaw + bearing }, new V3(f.x, 0, f.z), new V3(target.x, 0, target.z), el, DEG, bearingMod.turn);
          if (el.style.rotate == null) continue;
          const points = pointsAt(el.style.rotate, glyphUp);
          // Where the target actually is, in HUD screen terms: ahead is up.
          const want = { x: rightness(f, target), y: -dot(f, target) };
          const agree = screenAgree(points, want);
          if (agree < 0.98) {
            out.push(`yaw ${yaw.toFixed(2)}, target ${(bearing * DEG).toFixed(0)}° ${bearing > 0 ? 'right' : 'left'}: `
              + `needle at ${el.style.rotate} points (${points.x.toFixed(2)}, ${points.y.toFixed(2)}), the target is at (${want.x.toFixed(2)}, ${want.y.toFixed(2)}) — agreement ${agree.toFixed(3)}`);
          }
        }
      }
      return out;
    },
  },
  {
    id: 'hud/compass-strip',
    file: 'src/world/afford.js',
    surface: 'the compass ribbon: graduations, earned marks and the gold tick',
    why: 'A signed turn mapped to an x on a strip. It carries MORE direction information than the '
       + 'needle — every landmark the cadet has claimed is a tick on it — so an inverted strip sends '
       + 'a player the wrong way past every one of them at once, and it is a translate rather than a '
       + 'rotate, so nothing that watches rotations would see it.',
    cut: (s2) => cutLines(s2, /const inside = Math\.abs\(a\) <= ARC_FOV;/, /const x = Math\.round\(half[^\n]*;/, 'compass strip'),
    invert: (t) => t.replace('a / ARC_FOV', '-a / ARC_FOV'),
    probe(text) {
      const out = [];
      const run = new Function('a', 'half', 'ARC_FOV', `${text}\nreturn { x, inside };`);
      const half = 160, fov = 62;
      for (const [deg, word] of [[30, 'right'], [-30, 'left'], [8, 'right'], [-8, 'left'], [200, 'far right'], [-200, 'far left']]) {
        const r = run(deg, half, fov);
        const rightOfCentre = r.x > half;
        if ((deg > 0) !== rightOfCentre) out.push(`a turn of ${deg}° to the ${word} puts the tick at x=${r.x} on a strip whose centre is ${half}`);
      }
      const c = run(0, half, fov);
      if (c.x !== half) out.push(`a target dead ahead does not sit on the centre of the strip (x=${c.x}, centre ${half})`);
      if (!run(30, half, fov).inside || run(200, half, fov).inside) out.push('the strip does not pin a target outside its window');
      return out;
    },
  },
  // ------------------------------------------------------------------- audio
  {
    id: 'audio/rift-pan',
    file: 'src/audio/index.js + src/audio/dsp.js',
    surface: 'a rift you cannot see is heard on the side it is on',
    why: 'The stereo field is the one direction cue a player never checks consciously and always '
       + 'trusts. It is also the only chirality here computed with a real cross product, so it is '
       + 'the control: if this one is inverted too, the convention itself moved.',
    files: ['src/audio/index.js', 'src/audio/dsp.js'],
    cut: (s, all) => {
      const a = cutLines(all['src/audio/index.js'], /this\._right\.crossVectors\(/, /this\._right\.crossVectors\([^\n]*;/, 'audio right');
      const b = cutLines(all['src/audio/index.js'], /o\.pan = this\._right\.dot\(/, /o\.pan = [^\n]*;/, 'audio pan');
      return { text: `${a.text}\n${b.text}`, line: a.line };
    },
    invert: (t) => t.replace('crossVectors(this._fwd, this._up)', 'crossVectors(this._up, this._fwd)'),
    probe(text, all) {
      const out = [];
      const run = new Function('self', 'o', 'len', 'clamp', `${text.replace(/this\./g, 'self.')}\nreturn o.pan;`);
      for (const yaw of YAWS) {
        const f = fwdOf(yaw), r = rightOf(yaw);
        const mk = (side) => ({ _fwd: new V3(f.x, 0, f.z), _up: new V3(0, 1, 0), _right: new V3(), _to: new V3(r.x * side, 0, r.z * side) });
        const pr = run(mk(1), {}, 30, clamp);
        const pl = run(mk(-1), {}, 30, clamp);
        if (!(pr > 0.5)) out.push(`yaw ${yaw.toFixed(2)}: a rift on the cadet's right pans ${pr.toFixed(2)} — a StereoPanner sends negative to the LEFT ear`);
        if (!(pl < -0.5)) out.push(`yaw ${yaw.toFixed(2)}: a rift on the cadet's left pans ${pl.toFixed(2)}`);
      }
      // …and the pan value reaches a StereoPanner with its sign intact.
      const dsp = all['src/audio/dsp.js'] || '';
      if (!/createStereoPanner\(\)[\s\S]{0,120}?p\.pan\.value = clamp\(v, -1, 1\)/.test(dsp)) {
        out.push('src/audio/dsp.js no longer hands `v` straight to StereoPanner.pan; the sign this gate proves may be negated on the way out');
      }
      return out;
    },
  },
];

// ---------------------------------------------------------------------------
// THE CENSUS. Five textual rules that find chirality-bearing code. Every hit is
// a registered site or a written exception — the NOT_IN_BUILD discipline
// (tools/check-all.mjs) applied to left and right.
// ---------------------------------------------------------------------------
export const CENSUS = [
  {
    id: 'second-definition',
    what: 'a SECOND definition of which way is left — the planar cross product, spelled out at a call site',
    re: /([\w$.]+)\.x\s*\*\s*([\w$.]+)\.z\s*-\s*([\w$.]+)\.z\s*\*\s*([\w$.]+)\.x|([\w$.]+)\.z\s*\*\s*([\w$.]+)\.x\s*-\s*([\w$.]+)\.x\s*\*\s*([\w$.]+)\.z|\b(fx|ax)\s*\*\s*(vz|bz)\s*-\s*(fz|az)\s*\*\s*(vx|bx)\b/,
    /* This one is not "register it or excuse it". src/world/bearing.js exists so
       that the expression is written ONCE; a second spelling is the defect
       whether or not its sign happens to be right today, because the next hand
       to touch it re-derives it from memory. Only the definition file may hold
       it. */
    only: 'src/world/bearing.js',
  },
  {
    id: 'screen-rotation',
    what: 'a world bearing turned into a CSS rotation',
    re: /style\.rotate\s*=|style\.transform\s*=\s*[`'"][^`'"]*rotate/,
    guard: (line, src, idx) => /atan2|turnDeg|turn\(/.test(src.slice(Math.max(0, idx - 400), idx + line.length)),
  },
  {
    id: 'yaw-basis',
    what: 'a horizontal basis vector built out of a yaw',
    re: /\.set\(\s*-?\s*Math\.(sin|cos)\([^)]*\)\s*,\s*0\s*,\s*-?\s*Math\.(sin|cos)\([^)]*\)\s*\)|const\s+\w+\s*=\s*Math\.sin\([^)]*\)\s*,\s*\w+\s*=\s*Math\.cos\([^)]*\)/,
  },
  {
    id: 'signed-turn-to-screen',
    what: 'a signed turn mapped to a position on the glass',
    re: /style\.transform\s*=\s*[`'"][^`'"]*translate|style\.left\s*=/,
    guard: (line, src, idx) => /turn\(|turnDeg\(|atan2/.test(src.slice(Math.max(0, idx - 500), idx + line.length)),
  },
  {
    id: 'call-order',
    what: 'a call into the one definition of left',
    /* side(), turn() and bearingWord() are ANTISYMMETRIC: swapping the two
       pairs of arguments is exactly an inversion, and it looks like nothing in
       a diff. So the forward vector must come first, by name. */
    re: /(?<![\w$.])(turn|turnDeg|side|bearingWord)\s*\(/,
    calls: true,
  },
  {
    id: 'lateral-axis',
    what: 'the lateral movement axis, where a key or a stick becomes a direction',
    re: /move\.x\s*=|const kx = \(k\.has\(/,
  },
  {
    id: 'direction-word',
    what: 'a left-or-right word chosen in code',
    re: /'left'[^\n]*'right'|'right'[^\n]*'left'|'aheadLeft'|'backRight'/,
  },
];

/**
 * Chirality-shaped code that is NOT a left-or-right the player can feel, and
 * the reason for each. Same rule as NOT_IN_BUILD in tools/check-all.mjs: an
 * unexplained omission is the defect the list exists to prevent.
 */
export const NOT_CHIRAL = [
  ['src/world/ranges.js', 'crossVectors(e1, e2) is a surface normal off two triangle edges — lighting, not a side. Mirroring it darkens a hill; it does not send a player the wrong way.'],
  ['src/world/props.js', 'axis.set(cos(leanA), 0, sin(leanA)) is the lean axis of a plant and leanA is a random draw. There is no correct side for it to be on.'],
  ['src/player/locomotion.js', 'dashDir.set(sin(yaw), 0, cos(yaw)) and moveDir off the velocity are FORWARD, not a side. A mirrored forward would show at move/strafe-basis and camera/shoulder-basis, which are proved.'],
  ['src/world/afford.js:418', 'dir.set(sin(hd.yaw), 0, cos(hd.yaw)) is the target bearing the hud/compass-needle site cuts and executes; it is proved there rather than twice.'],
  ['src/ui/rift.js', "classList.add('right') marks a CORRECT answer. 'right' as in not-wrong; the class lands on whichever option the learner picked, not on a side of the screen."],
  ['src/main.js', "panel.demo('right') is the same not-wrong sense, in the critic hook."],
  ['src/meta/index.js', "the comms tag 'right' is the companion's line after a correct answer."],
  ['src/meta/voice.js', "'right' in the voice-line census is the correct-answer channel."],
  ['src/audio/stings.js', 'the comment names the "right"/"wrong" sting pair — the correct-answer sense again.'],
  ['src/learn/plot.js', 'ArrowLeft/ArrowRight step a point on a coordinate plane by ±1 in x. Same convention, but a graph axis rather than a body in a world; covered by check:figures.'],
  ['src/audio/control.js', 'ArrowLeft/ArrowRight step a volume slider down and up. Not a direction in the world.'],
  ['src/build/builder.js', 'style.transform = scaleX() is a progress bar filling; no bearing reaches it.'],
  ['src/world/afford.js:343', 'style.transform = translate() parks a label on a projected point. A translate carries no handedness of its own, and the projection it reads is the camera matrix the definition site is proved against.'],
  ['src/world/deeps.js', 'kx/kz are random jitter on a scatter, not an input axis.'],
];

// ---------------------------------------------------------------------------
const files = new Map();
async function load(rel) {
  if (!files.has(rel)) files.set(rel, await readFile(path.join(ROOT, rel), 'utf8'));
  return files.get(rel);
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css)$/.test(e)) out.push(p);
  }
  return out;
}

const fails = [];
const notes = [];
const ok = (l, d = '') => console.log(`  ok   ${l}${d ? ' — ' + d : ''}`);
const bad = (l, d = '') => { fails.push(`${l}${d ? ' — ' + d : ''}`); console.log(` FAIL ${l}${d ? ' — ' + d : ''}`); };

/** Run one site against the tree. `mode: 'module'` sites import instead of cutting. */
async function runSite(site, loader, moduleOverride = null) {
  if (site.mode === 'module') {
    const mod = moduleOverride || await import(path.join(ROOT, site.file) + `?h=${Date.now()}${Math.random()}`);
    return { findings: await site.probe(null, null, mod), line: 1, text: null };
  }
  const wanted = site.files || [site.file];
  const all = {};
  for (const f of wanted.flatMap((x) => x.split(' + ')).map((x) => x.trim())) all[f] = await loader(f);
  const primary = all[(site.files || [site.file])[0].split(' + ')[0].trim()];
  const cutRes = site.cut(primary, all);
  return { findings: await site.probe(cutRes.text, all), line: cutRes.line, text: cutRes.text, all };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function census() {
  const registered = new Set();
  for (const s2 of SITES) for (const f of (s2.files || [s2.file]).flatMap((x) => x.split(' + '))) registered.add(f.trim());
  const excused = NOT_CHIRAL.map(([f]) => f);
  const problems = [];
  let hits = 0;
  for (const abs of walk(SRC)) {
    const rel = path.relative(ROOT, abs);
    if (rel.startsWith('src/i18n/')) continue;   // strings, not geometry
    const src = await readFile(abs, 'utf8');
    const lines = src.split('\n');
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const at = idx; idx += line.length + 1;
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;   // a comment is not code
      for (const rule of CENSUS) {
        if (!rule.re.test(line)) continue;
        if (rule.guard && !rule.guard(line, src, at)) continue;
        hits++;
        const here = `${rel}:${i + 1}`;
        if (rule.calls) {
          // Pull each call's argument list and require the FORWARD pair first.
          for (const m of line.matchAll(new RegExp(rule.re.source, 'g'))) {
            let args;
            try { args = splitArgs(balanced(line, m.index, '(', ')').text); } catch { continue; }
            if (args.length < 4) continue;
            const pair = (a, b) => {
              const ma = /^([\w$.]+?)\.?x$/.exec(a.trim()), mb = /^([\w$.]+?)\.?z$/.exec(b.trim());
              return ma && mb && ma[1] === mb[1] ? ma[1] : null;
            };
            const base = pair(args[0], args[1]);
            if (!base) {
              problems.push({ here, rule: rule.id, what: `${m[1]}() is called with a first pair that is not a named (x, z) vector`,
                line: line.trim().slice(0, 110),
                fix: 'These functions are antisymmetric: the forward vector must come first, spelled so a reader can see it.' });
            } else if (!FORWARD_NAMES.test(base)) {
              problems.push({ here, rule: rule.id, what: `${m[1]}() is called with "${base}" as the FORWARD vector`,
                line: line.trim().slice(0, 110),
                fix: `Swapping the two pairs is exactly an inversion and looks like nothing in a diff. `
                   + `Name the forward vector one of ${FORWARD_NAMES}, or add it there in tools/critic/handed.mjs.` });
            }
          }
          continue;
        }
        if (rule.only) {
          if (rel !== rule.only) {
            problems.push({ here, rule: rule.id, what: rule.what, line: line.trim().slice(0, 110),
              fix: `Only ${rule.only} may spell this out. Call side() / turn() / turnDeg() / bearingWord() instead.` });
          }
          continue;
        }
        if (!(registered.has(rel) || excused.includes(rel) || excused.includes(here))) {
          problems.push({ here, rule: rule.id, what: rule.what, line: line.trim().slice(0, 110),
            fix: 'Add a site with a probe to SITES, or a line to NOT_CHIRAL with a reason.' });
        }
      }
    }
  }
  return { problems, hits };
}

if (!SELF_TEST) {
  console.log('ASCENT — the handedness gate\n');
  console.log('convention: three.js is Y-up right-handed; forward = (sin yaw, 0, cos yaw);');
  console.log('            screen-right = forward x up = (-cos yaw, 0, sin yaw);');
  console.log('            v is RIGHT of f  <=>  f.x*v.z - f.z*v.x > 0.  (src/world/bearing.js)\n');

  let modelBad = 0;
  for (const yaw of YAWS) {
    const a = rightOf(yaw), b = rightClosed(yaw), f = fwdOf(yaw);
    if (Math.abs(a.x - b.x) > 1e-12 || Math.abs(a.z - b.z) > 1e-12) modelBad++;
    if (Math.abs(dot(a, f)) > 1e-12) modelBad++;
    if (Math.abs(rightness(f, a) - 1) > 1e-12) modelBad++;
  }
  if (modelBad) bad('the gate\'s own model of "right" agrees with itself', `${modelBad} disagreement(s)`);
  else ok('the gate\'s own model of "right", derived two ways, agrees with itself over 8 headings');

  console.log('\nA. every left-or-right the player can feel, run out of the real file');
  for (const site of SITES) {
    let res;
    try { res = await runSite(site, load); }
    catch (e) {
      bad(`${site.id}`, `${e instanceof CutError ? 'THE SITE MOVED and this gate can no longer see it' : 'crashed'}: ${e.message}. `
        + 'A gate that silently stops matching is the defect. Re-anchor it in tools/critic/handed.mjs.');
      continue;
    }
    if (res.findings.length) {
      bad(`${site.id}  (${site.file}${res.line > 1 ? ':' + res.line : ''})`, site.surface);
      for (const f of res.findings.slice(0, 4)) console.log(`         ${f}`);
      if (res.findings.length > 4) console.log(`         …and ${res.findings.length - 4} more`);
      console.log(`         WHY IT MATTERS: ${site.why}`);
    } else ok(`${site.id.padEnd(22)} ${site.file}${res.line > 1 ? ':' + res.line : ''}`, site.surface);
  }

  console.log('\nB. the census — one definition of left, and every other chiral line registered or excused');
  const { problems, hits } = await census();
  if (problems.length) {
    bad('the census', `${problems.length} of ${hits} chirality-bearing line(s) are unaccounted for`);
    for (const u of problems) {
      console.log(`         ${u.here}  [${u.rule}] ${u.what}`);
      console.log(`           ${u.line}`);
      console.log(`           ${u.fix}`);
    }
  } else ok('the census', `${hits} chirality-bearing line(s) across ${CENSUS.length} rules, all accounted for`);
  for (const [f, why] of NOT_CHIRAL) if (!String(why).trim()) bad(`NOT_CHIRAL names ${f} with no reason`);

  console.log('');
  if (fails.length) {
    console.log(`\x1b[31mHANDEDNESS: ${fails.length} failure(s)\x1b[0m`);
    console.log('A mirrored control is found by a player in four seconds and cannot be un-seen.\n');
  } else {
    console.log(`\x1b[32mHANDEDNESS: ${SITES.length} sites clean, census clean\x1b[0m\n`);
  }
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Left is left on every
     surface a player touches, so a mirrored control is on the shipped route by
     construction — this project shipped one twice. */
  findings('check:handed', { scope: 'route' }).route(fails.map(String)).done();
}

// ---------------------------------------------------------------------------
// --self-test: MIRROR EVERY SITE AND REQUIRE THE VERDICT TO CHANGE.
//
// A gate that has never rejected anything is not a gate. Each site is run twice
// against the SAME shipped source: once as written, and once with its own rule
// mirrored — the exact defect that shipped, or its nearest neighbour. The
// contract is not "the plant must fail"; it is THE TWO MUST DISAGREE. That is
// the stronger statement, it holds in both directions, and it is the only one
// that still means something on a tree where a site is already inverted: if
// mirroring a rule does not change the verdict, the probe cannot tell left from
// right and the site is decoration.
//
// The second half matters as much: a probe that fires on both mirror images is
// a probe that will fire on honest content, and a gate that fires on honest
// content gets switched off.
// ---------------------------------------------------------------------------
console.log('handedness self-test — mirror the rule, prove the verdict moves\n');

let bads = 0;
const flag = (m) => { console.error(` FAIL ${m}`); bads++; };
const pass = (m) => console.log(`  ok   ${m}`);

{
  const mirrored = (yaw) => ({ x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) });   // the LEFT vector
  if (YAWS.some((y) => rightness(fwdOf(y), mirrored(y)) > 0)) flag('the model says the LEFT vector is to the right');
  else pass('the model refuses the left vector as "right" at all 8 headings');
}

const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
const os = await import('node:os');

for (const site of SITES) {
  // --- as shipped ---------------------------------------------------------
  let clean;
  try { clean = (await runSite(site, load)).findings; }
  catch (e) { flag(`${site.id}: the probe cannot run against the shipped file — ${e.message}`); continue; }

  // --- mirrored -----------------------------------------------------------
  let mirrored;
  if (site.mode === 'module') {
    // Write a mirrored copy of the definition beside the real one and import it.
    const src = await load(site.file);
    const planted = site.plantSource(src);
    if (planted === src) { flag(`${site.id}: the mirror changed nothing in ${site.file}, so it proves nothing`); continue; }
    const dir = await mkdtemp(path.join(os.tmpdir(), 'handed-'));
    const f = path.join(dir, 'bearing.mirrored.mjs');
    await writeFile(f, planted, 'utf8');
    try { mirrored = await site.probe(null, null, await import(f)); }
    catch (e) { mirrored = [`the mirrored module threw: ${e.message}`]; }
    await rm(dir, { recursive: true, force: true });
  } else {
    const wanted = (site.files || [site.file]).flatMap((x) => x.split(' + ')).map((x) => x.trim());
    const all = {};
    for (const f of wanted) all[f] = await load(f);
    let cutRes;
    try { cutRes = site.cut(all[wanted[0]], all); }
    catch (e) { flag(`${site.id}: the cut no longer matches the shipped file — ${e.message}`); continue; }
    const planted = site.invert(cutRes.text);
    if (planted === cutRes.text) { flag(`${site.id}: the mirror changed nothing, so it proves nothing`); continue; }
    try { mirrored = await site.probe(planted, all); } catch (e) { mirrored = [`the mirrored source threw: ${e.message}`]; }
  }

  /* THE CONTRACT: the mirror image must be REFUSED FOR REASONS THE SHIPPED
     SOURCE IS NOT REFUSED FOR. Not "the plant is red" — that is satisfied by a
     probe that is red on everything. Not "red flips to green" either, because a
     site can carry a second, mirror-blind finding (a missing bundle key, say)
     that is true of both images and would mask the flip. What has to be true is
     that mirroring produces findings the honest source does not produce. */
  const before = new Set(clean);
  const newOnes = mirrored.filter((f) => !before.has(f));
  const cleanRed = clean.length > 0;
  if (!newOnes.length) {
    flag(`${site.id}: mirroring the rule produced no finding the shipped source does not also produce `
      + `(as shipped ${clean.length}, mirrored ${mirrored.length}) — this probe cannot tell left from right`);
  } else if (cleanRed) {
    pass(`${site.id}: the mirror is caught (${newOnes.length} finding(s) it alone produces)`);
    console.log(`       NOTE: the shipped file is ALSO red at this site, for a reason a mirror cannot explain:`);
    console.log(`       ${clean[0]}`);
    notes.push(site.id);
  } else {
    pass(`${site.id}: mirrored -> ${newOnes.length} finding(s); as shipped -> silent`);
  }
}

// The census must refuse a second definition of left, and stay quiet on prose.
{
  const line = "  const side = a.x * b.z - a.z * b.x > 0 ? 'left' : 'right';";
  const hitRules = CENSUS.filter((r) => r.re.test(line)).map((r) => r.id);
  if (!hitRules.includes('second-definition')) flag(`the census does not see a second definition of left (matched: ${hitRules.join(',') || 'nothing'})`);
  else pass(`the census sees a second definition of left on ${hitRules.length} rule(s) (${hitRules.join(', ')})`);
  const honest = '    const d = Math.hypot(q.x - p.x, q.z - p.z);';
  if (CENSUS.some((r) => r.re.test(honest))) flag('the census fires on an ordinary planar distance, which is how a gate gets switched off');
  else pass('the census stays quiet on an ordinary planar distance');
  const dotp = '    const lateral = s.vel.x * sr.x + s.vel.z * sr.z;';
  if (CENSUS.some((r) => r.re.test(dotp))) flag('the census reads an ordinary dot product as a cross product');
  else pass('the census tells a dot product from a cross product');
  if (!/^\s*(\*|\/\/|\/\*)/.test("   * the sign says 'left' or 'right'")) flag('the census would read a comment as code');
  else pass('the census does not read a comment as code');
  // …and the call-order rule, on a planted swapped call.
  const swapped = '  const a = turn(dir.x, dir.z, fwd.x, fwd.z);';
  const rule = CENSUS.find((r) => r.id === 'call-order');
  const argsOf = (l) => { const m = new RegExp(rule.re.source).exec(l); return splitArgs(balanced(l, m.index, '(', ')').text); };
  const baseOf = (a, b) => { const ma = /^([\w$.]+?)\.?x$/.exec(a.trim()), mb = /^([\w$.]+?)\.?z$/.exec(b.trim()); return ma && mb && ma[1] === mb[1] ? ma[1] : null; };
  const sw = argsOf(swapped);
  if (FORWARD_NAMES.test(baseOf(sw[0], sw[1]))) flag('the call-order rule accepts turn(dir, fwd) — a swapped call is exactly an inversion');
  else pass('the call-order rule refuses turn(dir.x, dir.z, fwd.x, fwd.z) — the pairs the wrong way round');
  const honestCall = '  const a = turn(fwd.x, fwd.z, dir.x, dir.z);';
  const hc = argsOf(honestCall);
  if (!FORWARD_NAMES.test(baseOf(hc[0], hc[1]))) flag('the call-order rule refuses an honest turn(fwd, dir) call');
  else pass('the call-order rule stays quiet on turn(fwd.x, fwd.z, dir.x, dir.z)');

  const { problems } = await census();
  const seconds = problems.filter((p2) => p2.rule === 'second-definition');
  if (seconds.length) console.log(`       NOTE: ${seconds.length} second definition(s) of left stand in src/ right now: ${seconds.map((x) => x.here).join(', ')}`);
}
for (const [f, why] of NOT_CHIRAL) if (!String(why).trim()) flag(`NOT_CHIRAL names ${f} with no reason`);
pass(`${NOT_CHIRAL.length} excused construction(s), every one with a written reason`);

console.log('');
if (bads) { console.error(`self-test: ${bads} failure(s)\n`); process.exit(1); }
if (notes.length) console.log(`self-test: ok — every site refuses its own mirror image.  ${notes.length} site(s) are RED on the tree as it stands: ${notes.join(', ')}\n`);
else console.log('self-test: ok — every site refuses its own mirror image, and none of them fires on the tree as it stands\n');
process.exit(0);
