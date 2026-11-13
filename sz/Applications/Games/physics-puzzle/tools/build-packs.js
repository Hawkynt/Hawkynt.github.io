'use strict';

/* Finds the Looking-Glass remixes that are provably solvable: every campaign level is mirrored with
   js/data/packs.js, its stored solution mirrored too, and replayed in the game's own physics; the
   ones that still win within par (and whose mirrored parts still fit the placement rules) are
   printed as the PROVEN table for js/data/packs.js. Run: node tools/build-packs.js */
global.window = global;
require('../js/engine/physics.js');
require('../js/engine/parts.js');
require('../js/engine/sim.js');
require('../js/data/levels-data.js');
require('../js/data/solutions.js');
require('../js/data/packs.js');
const SZ = window.SZ, Lv = SZ.PhysicsPuzzleLevels, Sim = SZ.PhysicsPuzzleSim, Parts = SZ.PhysicsPuzzleParts, SOL = SZ.PhysicsPuzzleSolutions, P = SZ.PhysicsPuzzlePacks;

function proven(src) {
  const sol = SOL[src.id];
  if (!sol) return false;
  const m = P.mirrorLevel(src, 'x', 'x'), ms = P.mirrorSolution(sol);
  const placed = [];
  for (const p of ms.parts) {
    const pl = { type: p[0], x: p[1], y: p[2], a: p[3] || 0 };
    if (!Parts.canPlace(m, Lv.WORLDS[m.world], placed, pl).ok) return false;
    placed.push(pl);
  }
  const r = Sim.playSolution(m, ms, { theme: Lv.WORLDS[m.world] });
  const r2 = Sim.playSolution(m, ms, { theme: Lv.WORLDS[m.world] });
  return r.win && r2.win && r.shots <= m.par;
}

const out = {};
for (let w = 0; w < Lv.WORLDS.length; ++w) out[w] = Lv.worldLevels(w).filter(proven).map(l => l.id);
console.log(JSON.stringify(out));
