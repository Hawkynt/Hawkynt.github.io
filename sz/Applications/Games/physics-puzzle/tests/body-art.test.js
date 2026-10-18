'use strict';

/* Drawing budgets for the field art against a recording fake canvas: every
   body, zone and prop draws in every world, sprites are cached after the
   first frame, and a busy frame stays within a small number of canvas calls
   without gradients or shadow blur. */

const fs = require('fs');
const F = require('./fakecanvas.js');
F.install();
require('../js/engine/physics.js');
require('../js/engine/parts.js');
require('../js/engine/sim.js');
require('../js/data/levels-data.js');
require('../js/core/progression.js');
const ART = ['art-kit.js', 'materials.js', 'body-sprites.js', 'actors.js', 'bodies.js'].map(f => '../js/render/art/' + f);
ART.forEach(f => require(f));

const SZ = window.SZ;
const Art = SZ.PhysicsPuzzleArt, Sim = SZ.PhysicsPuzzleSim, Lv = SZ.PhysicsPuzzleLevels, Prog = SZ.PhysicsPuzzleProgress, Parts = SZ.PhysicsPuzzleParts;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!Art && Object.isFrozen(Art), 'missing');
check('no shadowBlur in source', ART.every(f => fs.readFileSync(require.resolve(f), 'utf8').indexOf('shadowBlur') < 0), 'shadowBlur');

const theme = { gravity: 1200 };
const items = [['ground', 0, 1280], ['wall', 100, 100, 50, 20], ['wall', 300, 300, 20, 200, 0, 'stone'], ['wall', 300, 100, 120, 20, 0, 'metal'], ['ice', 200, 100, 80, 14, 10],
  ['ramp', 300, 200, 80, 40, 1], ['ramp', 400, 200, 80, 40, -1], ['peg', 400, 100], ['crate', 500, 100], ['steel', 600, 100], ['boulder', 700, 100], ['glass', 800, 100, 80],
  ['tnt', 900, 100], ['spring', 1000, 100], ['bumper', 1100, 100], ['conveyor', 200, 300, 120], ['conveyor', 200, 340, 120, 0, -200], ['paddle', 400, 300, 120, 2],
  ['swing', 600, 300, 120, 30, 0.5], ['fan', 800, 300, -90], ['water', 900, 400, 1100, 500], ['magnet', 1000, 300], ['portal', 100, 400, 0, 300, 400, 180],
  ['pendulum', 700, 400, 100, 30], ['lava', 1100, 500, 1200, 560]];
const level = { id: 'art', world: 0, launcher: [110, 566], items: items, targets: [[640, 300], [700, 200]], stars: [[300, 200], [500, 200], [600, 250]], inv: {}, par: 1 };
const placed = Parts.PART_ORDER.map((t, i) => ({ type: t, x: 100 + i * 110, y: 500, a: 0 }));

function frame(ctx, att, world, t) {
  const skin = Prog.SKINS[world % Prog.SKINS.length];
  for (const z of att.world.zones)
    Art.drawZone(ctx, z, world, t);
  for (const b of att.world.bodies)
    if (b.alive && !b.sensor && !Art.isStaticArt(b))
      Art.drawBody(ctx, b, world, t, skin);
  for (const b of att.world.bodies)
    if (b.alive && b.tag === 'lava')
      Art.drawBody(ctx, b, world, t);
  att.targets.forEach((tg, i) => Art.drawTarget(ctx, tg.x, tg.y, i === 0, t, '#ffb35a'));
  att.stars.forEach((s, i) => Art.drawStar(ctx, s.x, s.y, t, i));
  Art.drawLauncher(ctx, 110, 566, 35, 0.8, t, world, 0.3);
  for (let k = 0; k < 3; ++k)
    Art.drawBall(ctx, 200 + k * 40, 200, k, skin, 13, t);
}

let err = null;
let worst = { calls: 0, gradients: 0, images: 0 };
let worstStatic = { calls: 0, gradients: 0 };
for (const scale of [1, 1.5, 2]) {
  Art.setScale(scale);
  for (let w = 0; w < 5; ++w) {
    const att = Sim.createAttempt(Object.assign({}, level, { world: w }), placed, { theme: theme });
    Sim.fire(att, 30, 800, 2, 4);
    try {
      frame(F.fakeCtx(), att, w, 0.5);      // warm the caches
      const st = F.fakeCtx();
      for (const b of att.world.bodies)
        if (b.alive && Art.isStaticArt(b))
          Art.drawBody(st, b, w, 0);
      const c = F.fakeCtx();
      frame(c, att, w, 1.7);
      if (c.calls > worst.calls) worst = { calls: c.calls, gradients: c.gradients, images: c.images, w: w, scale: scale };
      worst.gradients = Math.max(worst.gradients, c.gradients);
      const st2 = F.fakeCtx();
      for (const b of att.world.bodies)
        if (b.alive && Art.isStaticArt(b))
          Art.drawBody(st2, b, w, 0);
      worstStatic = { calls: Math.max(worstStatic.calls, st2.calls), gradients: Math.max(worstStatic.gradients, st2.gradients) };
      for (const t of Parts.PART_ORDER) {
        const icon = Art.partIcon(t, w);
        if (!icon || !icon.c) throw new Error('no icon for ' + t);
        Art.drawPart(F.fakeCtx(), { type: t, x: 300, y: 300, a: 45 }, w, 1);
      }
    } catch (x) {
      err = x;
    }
  }
}
check('every body, zone, prop and part draws in every world and scale', !err, err && err.stack);
console.log('INFO busiest cached frame: ' + worst.calls + ' calls, ' + worst.images + ' images (world ' + worst.w + ', scale ' + worst.scale + ')');
check('a busy cached frame stays under 420 canvas calls', worst.calls < 420, worst.calls);
check('no gradients in a cached frame', worst.gradients === 0, worst.gradients);
check('static bodies are one blit each once cached', worstStatic.gradients === 0 && worstStatic.calls < 80, JSON.stringify(worstStatic));
check('the sprite cache stays bounded', Art.cacheSize < 900, Art.cacheSize);

/* rescaling drops the cache and rebuilds */
Art.setScale(1);
Art.drawStar(F.fakeCtx(), 0, 0, 0, 0);
const n1 = Art.cacheSize;
Art.setScale(2.5);
check('a new scale starts a fresh cache', Art.cacheSize === 0 && n1 > 0, n1 + ' -> ' + Art.cacheSize);

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
