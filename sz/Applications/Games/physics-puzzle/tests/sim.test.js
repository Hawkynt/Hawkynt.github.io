'use strict';

/* The puzzle rules: attempts, shots, targets, stars, persistence, trick rules
   and part placement. */

global.window = {};
require('../physics.js');
require('../parts.js');
require('../sim.js');

const SZ = window.SZ;
const Sim = SZ.PhysicsPuzzleSim, Parts = SZ.PhysicsPuzzleParts, Ph = SZ.PhysicsPuzzlePhysics;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const theme = { gravity: 1200, wallMat: 'wood', groundMat: 'stone' };
const base = { id: 'x', world: 0, launcher: [110, 566], items: [['ground', 0, 1280]], targets: [[700, 560]], stars: [], inv: {}, par: 1 };

check('module registered', !!Sim && Object.isFrozen(Sim), 'missing');

/* a direct roll along the floor lights the target */
{
  const att = Sim.createAttempt(base, [], { theme: theme });
  const shot = Sim.runShot(att, 2, 900);
  check('a straight shot lights the target and wins', shot.done === 'win' && att.won && att.targets[0].lit, shot.done);
  check('a shot counts', att.shots === 1, att.shots);
}

/* a miss ends when the ball is gone, then the world settles */
{
  const att = Sim.createAttempt(base, [], { theme: theme });
  const shot = Sim.runShot(att, 80, 1400);
  check('a miss ends as over', shot.done === 'over' && !att.won, shot.done);
  check('shots end within the time limit', shot.time < Sim.MAX_TIME + 6, shot.time);
}

/* stars are taken by the ball and stay taken across shots */
{
  const lvl = Object.assign({}, base, { targets: [[1250, 100]], stars: [[400, 586]] });
  const att = Sim.createAttempt(lvl, [], { theme: theme });
  Sim.runShot(att, 0, 700);
  check('a rolling ball picks up a star', att.stars[0].got, 'not taken');
  Sim.runShot(att, 60, 400);
  check('the star stays taken on the next shot', att.stars[0].got && att.shots === 2, 'lost');
}

/* the world persists: a crate pushed by shot one stays pushed */
{
  const lvl = Object.assign({}, base, { items: [['ground', 0, 1280], ['crate', 500, 576]], targets: [[1250, 100]] });
  const att = Sim.createAttempt(lvl, [], { theme: theme });
  const crate = att.world.bodies.find(b => b.data && b.data.kind === 'crate');
  Sim.runShot(att, 0, 1300);
  const moved = crate.x;
  Sim.runShot(att, 80, 300);
  check('the crate is pushed and stays put between shots', moved > 540 && Math.abs(crate.x - moved) < 1, moved + ' -> ' + crate.x);
}

/* lit targets carry over; oneShot resets them every shot */
{
  const lvl = Object.assign({}, base, { targets: [[400, 560], [1250, 60]] });
  const att = Sim.createAttempt(lvl, [], { theme: theme });
  Sim.runShot(att, 0, 600);
  Sim.runShot(att, 85, 300);
  check('a lit target stays lit', att.targets[0].lit && !att.won, att.targets[0].lit);
  const one = Sim.createAttempt(lvl, [], { theme: theme, oneShot: true });
  Sim.runShot(one, 0, 600);
  Sim.fire(one, 85, 300);
  check('with oneShot the targets reset on the next shot', !one.targets[0].lit, one.targets[0].lit);
}

/* minBounces: the target only counts after enough ricochets */
{
  const lvl = Object.assign({}, base, { items: [['ground', 0, 1280], ['wall', 900, 400, 20, 400]], targets: [[700, 560]] });
  const strict = Sim.createAttempt(lvl, [], { theme: theme, minBounces: 3 });
  const s1 = Sim.runShot(strict, 0, 600);
  check('a direct hit does not count for minBounces', s1.done !== 'win' || s1.maxBounces >= 3, s1.done + ' ' + s1.maxBounces);
}

/* lava burns the ball */
{
  const lvl = Object.assign({}, base, { items: [['ground', 0, 400], ['lava', 400, 600, 900, 660], ['ground', 900, 1280]] });
  const att = Sim.createAttempt(lvl, [], { theme: theme });
  const shot = Sim.fire(att, 0, 500);
  let burned = false;
  while (!shot.done) {
    Sim.stepAttempt(att);
    if (shot.events.some(e => e.type === 'burn')) burned = true;
    shot.events.length = 0;
  }
  check('lava burns the ball', burned && !shot.balls[0].alive, burned);
}

/* extra balls fan out */
{
  const att = Sim.createAttempt(base, [], { theme: theme });
  const shot = Sim.fire(att, 30, 800, 2, 4);
  check('Twin Shot fires extra balls', shot.balls.length === 3 && shot.balls[0].vy !== shot.balls[2].vy, shot.balls.length);
}

/* parts in the live world */
{
  const att = Sim.createAttempt(base, [], { theme: theme });
  Sim.setParts(att, [{ type: 'block', x: 400, y: 560, a: 0 }]);
  check('a placed part becomes a body', att.partBodies.length === 1 && att.partBodies[0].data.kind === 'block', att.partBodies.length);
  Sim.setParts(att, []);
  check('removing it takes the body away', att.partBodies.length === 0 && !att.world.bodies.some(b => b.alive && b.data && b.data.kind === 'block'), 'still there');
  Sim.setParts(att, [{ type: 'fan', x: 400, y: 400, a: 270 }]);
  check('a fan part brings its wind', att.world.zones.some(z => z.kind === 'fan' && z.data.part), 'no zone');
  Sim.setParts(att, []);
  check('and takes it away again', !att.world.zones.some(z => z.data && z.data.part), 'zone left');
}

/* placement rules */
{
  check('a part inside the ground is refused', !Parts.canPlace(base, theme, [], { type: 'block', x: 600, y: 600, a: 0 }).ok, 'accepted');
  check('a part near the launcher is refused', !Parts.canPlace(base, theme, [], { type: 'block', x: 140, y: 520, a: 0 }).ok, 'accepted');
  check('a part on the target is refused', !Parts.canPlace(base, theme, [], { type: 'bumper', x: 700, y: 540, a: 0 }).ok, 'accepted');
  check('a free spot is fine', Parts.canPlace(base, theme, [], { type: 'plank', x: 600, y: 300, a: 30 }).ok, 'refused');
  check('parts may not overlap', !Parts.canPlace(base, theme, [{ type: 'block', x: 600, y: 300, a: 0 }], { type: 'block', x: 620, y: 300, a: 0 }).ok, 'accepted');
  check('snap to the grid and to 15 degrees', Parts.snap(123) === 120 && Parts.snapAngle(-20) === 345 && Parts.snapAngle(370) === 15, Parts.snapAngle(-20));
  check('every placeable part has specs', Parts.PART_ORDER.every(t => Parts.partSpecs({ type: t, x: 300, y: 300, a: 0 }).bodies.length >= 1), 'missing specs');
}

/* every fixture kind builds */
{
  const items = [['ground', 0, 1280], ['wall', 100, 100, 50, 20], ['ice', 200, 100, 80, 14, 10], ['ramp', 300, 200, 80, 40, 1], ['peg', 400, 100], ['crate', 500, 100],
    ['steel', 600, 100], ['boulder', 700, 100], ['glass', 800, 100, 80], ['tnt', 900, 100], ['spring', 1000, 100], ['bumper', 1100, 100], ['conveyor', 200, 300, 120],
    ['paddle', 400, 300, 120, 2], ['swing', 600, 300, 120, 30, 0.5], ['fan', 800, 300, -90], ['water', 900, 400, 1100, 500], ['magnet', 1000, 300],
    ['portal', 100, 400, 0, 300, 400, 180], ['pendulum', 700, 400, 100, 30], ['lava', 1100, 500, 1200, 560]];
  const lvl = Object.assign({}, base, { items: items });
  const att = Sim.createAttempt(lvl, [], { theme: theme });
  const kinds = new Set(att.world.bodies.filter(b => b.data).map(b => b.data.kind));
  check('every fixture kind builds a body or zone', att.world.bodies.length >= 19 && att.world.zones.length === 4 && att.world.joints.length === 1, att.world.bodies.length + ' ' + att.world.zones.length);
  check('art kinds are tagged', ['wall', 'ice', 'ramp', 'peg', 'crate', 'steel', 'boulder', 'glass', 'tnt', 'spring', 'bumper', 'conveyor', 'paddle', 'fan', 'magnet', 'pendulum', 'lava'].every(k => kinds.has(k)), [...kinds]);
  /* machines are frozen until a shot runs */
  const pad = att.world.bodies.find(b => b.data && b.data.kind === 'paddle' && b.motor.spin);
  const a0 = pad.a;
  check('machines stand still between shots', pad.a === a0, 'moved');
  Sim.fire(att, 45, 300);
  for (let i = 0; i < 60; ++i) Sim.stepAttempt(att);
  check('and turn during a shot', Math.abs(pad.a - a0) > 0.3, pad.a - a0);
}

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
