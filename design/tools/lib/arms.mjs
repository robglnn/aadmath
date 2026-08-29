/**
 * The named arms, in one place, so every tool in this directory grades the same
 * proposal. `ARM=<name>` selects one; the default is the shipping engine.
 */
import * as P from './patches.mjs';

export const ARMS = {
  shipping: {},
  A: { patch: P.gateAtBar },
  "A'": { patch: P.gateAtBarSteady },
  B: { patch: P.holeAtBar },
  "B'": { patch: P.holeAtBarSteady },
  C: { patch: P.noNewDebt },
  D: { cfg: { holeSpacing: 1 } },
  E: { patch: P.payAtOnce },
  "E'": { patch: P.payAtOnceSteady },
  "B'+E'": { patch: P.all(P.holeAtBarSteady, P.payAtOnceSteady) },
  "A'+B'+E'": { patch: P.all(P.gateAtBarSteady, P.holeAtBarSteady, P.payAtOnceSteady) },
  "B'+E'+S": { patch: P.all(P.holeAtBarSteady, P.payAtOnceSteady, P.holeIsALapse) },
  S: { patch: P.holeIsALapse },
  R: { patch: P.probeAtTheClaim },
  "B'+E'+S+R": { patch: P.all(P.holeAtBarSteady, P.payAtOnceSteady, P.holeIsALapse, P.probeAtTheClaim) },
  "A'+B'+E'+S": { patch: P.all(P.gateAtBarSteady, P.holeAtBarSteady, P.payAtOnceSteady, P.holeIsALapse) },
};

export function armOf(name = process.env.ARM || 'shipping') {
  const a = ARMS[name];
  if (!a) throw new Error(`no arm "${name}" — have ${Object.keys(ARMS).join(', ')}`);
  const cfg = { ...(a.cfg || {}) };
  if (process.env.CFG) for (const pair of process.env.CFG.split(',')) { const [k, v] = pair.split('='); cfg[k.trim()] = Number(v); }
  return { ...a, cfg, name };
}
