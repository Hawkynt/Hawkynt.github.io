'use strict';

global.window = {};
const fs = require('fs');
require('../js/engine/physics.js');

const P = window.SZ.PhysicsPuzzlePhysics;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

function run(world, seconds) {
  const n = Math.round(seconds / P.STEP);
  for (let i = 0; i < n; ++i)
    P.step(world);
}

function floorWorld(g) {
  const w = P.createWorld({ gravity: [0, g || 1200] });
  P.addBody(w, { shape: 'box', x: 640, y: 620, w: 1400, h: 40, mat: 'stone' });
  return w;
}

check('module registered', !!P && Object.isFrozen(P), 'SZ.PhysicsPuzzlePhysics missing or not frozen');
check('no DOM or storage use', !/document|localStorage|Math\.random/.test(fs.readFileSync(require.resolve('../js/engine/physics.js'), 'utf8')), 'touches DOM, storage or randomness');

/* shapes */
const sq = P.polyShape(P.boxPoints(40, 40));
check('box area', Math.abs(sq.area - 1600) < 1e-9, sq.area);
check('box inertia per mass is s^2/6', Math.abs(sq.inertiaPerMass - 1600 / 6) < 1e-6, sq.inertiaPerMass);
const tri = P.polyShape([[0, 0], [60, 0], [0, -60]]);
check('triangle centred on its centroid', Math.abs(tri.cx - 20) < 1e-9 && Math.abs(tri.cy + 20) < 1e-9, tri.cx + ',' + tri.cy);
let outward = true;
for (let i = 0; i < tri.count; ++i) {
  const vx = tri.verts[i * 2], vy = tri.verts[i * 2 + 1];
  if (tri.norms[i * 2] * vx + tri.norms[i * 2 + 1] * vy <= 0) outward = false;
}
check('normals point outward for either winding', outward, 'inward normal');

/* free fall matches the closed form */
{
  const w = P.createWorld({ gravity: [0, 1000] });
  const b = P.addBody(w, { shape: 'circle', r: 10, x: 0, y: 0, type: 'dynamic', mat: 'ball' });
  run(w, 0.5);
  check('free fall distance', Math.abs(b.y - 125) < 2.5, b.y);
}

/* a ball dropped on the floor bounces lower each time and comes to rest on top */
{
  const w = floorWorld();
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 640, y: 300, type: 'dynamic', mat: 'ball' });
  let peakAfter = Infinity, bounced = false, prevVy = 0;
  for (let i = 0; i < 240 * 4; ++i) {
    P.step(w);
    if (prevVy > 0 && b.vy < 0) bounced = true;
    if (bounced && prevVy < 0 && b.vy >= 0) peakAfter = Math.min(peakAfter, b.y);
    prevVy = b.vy;
  }
  check('ball bounces', bounced, 'no bounce');
  check('bounce lower than drop', peakAfter > 300, peakAfter);
  check('ball rests on the floor', Math.abs(b.y - (600 - 14)) < 1.5, b.y);
  check('ball fell asleep', b.sleeping, 'awake');
}

/* energy never grows on a bouncy fall (no boosts) */
{
  const w = floorWorld();
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 400, y: 200, vx: 300, type: 'dynamic', mat: 'rubber' });
  const e0 = P.energy(w);
  let maxE = -Infinity;
  for (let i = 0; i < 240 * 3; ++i) {
    P.step(w);
    maxE = Math.max(maxE, P.energy(w));
  }
  check('energy does not grow', maxE <= e0 + Math.abs(e0) * 0.01, maxE + ' > ' + e0);
  check('rubber ball loses energy over time', P.energy(w) < e0, P.energy(w) + ' vs ' + e0);
}

/* a stack of four boxes stands still */
{
  const w = floorWorld();
  const boxes = [];
  for (let i = 0; i < 4; ++i)
    boxes.push(P.addBody(w, { shape: 'box', x: 640 + (i % 2) * 3, y: 600 - 25 - i * 50.5, w: 50, h: 50, type: 'dynamic', mat: 'wood' }));
  run(w, 4);
  const top = boxes[3];
  check('stack stays upright', Math.abs(top.x - 641.5) < 8 && Math.abs(top.a) < 0.1, top.x + ' ' + top.a);
  check('stack keeps its height', Math.abs(top.y - (600 - 175)) < 6, top.y);
  check('stack falls asleep', boxes.every(b => b.sleeping), boxes.map(b => b.sleeping).join(','));
}

/* determinism: two identical worlds stay identical */
function scene() {
  const w = floorWorld();
  P.addBody(w, { shape: 'poly', points: [[-80, 0], [80, 0], [80, -60]], x: 700, y: 600 });
  for (let i = 0; i < 6; ++i)
    P.addBody(w, { shape: 'box', x: 900 + (i % 2) * 30, y: 570 - Math.floor(i / 2) * 42, w: 40, h: 40, type: 'dynamic' });
  P.addBody(w, { shape: 'circle', r: 14, x: 100, y: 400, vx: 900, vy: -500, type: 'dynamic', mat: 'ball', tag: 'ball' });
  return w;
}
{
  const a = scene(), b = scene();
  run(a, 5);
  run(b, 5);
  check('same inputs, same result', P.hash(a) === P.hash(b), P.hash(a) + ' vs ' + P.hash(b));
}

/* a ball rolls down a ramp and keeps going */
{
  const w = floorWorld();
  P.addBody(w, { shape: 'box', x: 300, y: 450, w: 300, h: 16, a: 0.4, mat: 'wood' });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 200, y: 360, type: 'dynamic', mat: 'ball' });
  run(w, 1.2);
  check('ball rolls down the ramp', b.x > 340 && b.w > 0, b.x + ' w=' + b.w);
}

/* a spring pad sends a ball up with its boost speed */
{
  const w = floorWorld();
  P.addBody(w, { shape: 'box', x: 640, y: 590, w: 70, h: 20, boost: 1100, tag: 'spring', mat: 'rubber' });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 640, y: 450, type: 'dynamic', mat: 'ball' });
  let minVy = 0;
  for (let i = 0; i < 240; ++i) { P.step(w); minVy = Math.min(minVy, b.vy); }
  check('spring launches upward at its boost speed', minVy < -1000 && minVy > -1250, minVy);
}

/* a bumper boosts in any direction */
{
  const w = P.createWorld({ gravity: [0, 0] });
  P.addBody(w, { shape: 'circle', r: 24, x: 300, y: 300, boost: 800, boostDir: 'any', mat: 'rubber' });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 200, y: 300, vx: 200, type: 'dynamic', mat: 'ball' });
  run(w, 0.8);
  check('bumper kicks the ball back fast', b.vx < -700, b.vx);
}

/* conveyor carries a resting box */
{
  const w = P.createWorld({ gravity: [0, 1200] });
  P.addBody(w, { shape: 'box', x: 640, y: 600, w: 600, h: 20, surface: 200, mat: 'rubber' });
  const box = P.addBody(w, { shape: 'box', x: 500, y: 570, w: 40, h: 40, type: 'dynamic' });
  run(w, 1.5);
  check('conveyor moves the box along', box.x > 680 && Math.abs(box.vx - 200) < 40, box.x + ' vx=' + box.vx);
}

/* glass breaks under a heavy hit, not under a light touch */
{
  const w = floorWorld();
  const g1 = P.addBody(w, { shape: 'box', x: 640, y: 400, w: 120, h: 14, mat: 'glass', breakImpulse: 600, tag: 'glass' });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 640, y: 100, type: 'dynamic', mat: 'ball' });
  let broke = false;
  for (let i = 0; i < 240; ++i) { P.step(w); if (P.takeEvents(w).some(e => e.type === 'break')) broke = true; }
  check('glass shatters under a falling ball', broke && !g1.alive, broke);
  check('ball passes through broken glass', b.y > 500, b.y);
  const w2 = floorWorld();
  const g2 = P.addBody(w2, { shape: 'box', x: 640, y: 400, w: 120, h: 14, mat: 'glass', breakImpulse: 600 });
  P.addBody(w2, { shape: 'circle', r: 14, x: 640, y: 380, type: 'dynamic', mat: 'ball' });
  run(w2, 1);
  check('glass holds a resting ball', g2.alive, 'broke');
}

/* TNT explodes on impact and pushes boxes away */
{
  const w = floorWorld();
  P.addBody(w, { shape: 'box', x: 640, y: 580, w: 40, h: 40, mat: 'tnt', tnt: { radius: 200, power: 1000 }, tag: 'tnt' });
  const crate = P.addBody(w, { shape: 'box', x: 720, y: 580, w: 40, h: 40, type: 'dynamic' });
  P.addBody(w, { shape: 'circle', r: 14, x: 400, y: 560, vx: 900, type: 'dynamic', mat: 'ball' });
  let boom = false;
  for (let i = 0; i < 240; ++i) { P.step(w); if (P.takeEvents(w).some(e => e.type === 'explode')) boom = true; }
  check('tnt explodes when hit', boom, 'no explosion');
  check('blast throws the crate', crate.x > 760 || crate.y < 500, crate.x + ',' + crate.y);
}

/* fan pushes, magnet pulls, water floats, portal teleports */
{
  const w = P.createWorld({ gravity: [0, 0] });
  P.addZone(w, { kind: 'fan', x: 100, y: 300, len: 400, width: 100, a: 0, strength: 1500 });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 150, y: 300, type: 'dynamic', mat: 'ball' });
  run(w, 0.5);
  check('fan blows along its axis', b.vx > 300 && Math.abs(b.vy) < 1, b.vx);
}
{
  const w = P.createWorld({ gravity: [0, 0] });
  P.addZone(w, { kind: 'magnet', x: 400, y: 300, radius: 200, strength: 2000 });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 300, y: 300, type: 'dynamic', mat: 'ball', tag: 'ball' });
  run(w, 0.2);
  check('magnet pulls the ball', b.vx > 50, b.vx);
}
{
  const w = P.createWorld({ gravity: [0, 1200] });
  P.addZone(w, { kind: 'water', x0: 0, y0: 400, x1: 1280, y1: 640, density: 1.6, drag: 2 });
  const b = P.addBody(w, { shape: 'circle', r: 14, x: 640, y: 300, type: 'dynamic', mat: 'ball' });
  let splash = false;
  for (let i = 0; i < 240 * 4; ++i) { P.step(w); if (P.takeEvents(w).some(e => e.type === 'splash')) splash = true; }
  check('water splashes and floats the ball near the surface', splash && b.y < 440 && b.y > 380, b.y);
}
{
  const w = P.createWorld({ gravity: [0, 0] });
  P.addZone(w, { kind: 'portal', ax: 300, ay: 300, aa: 0, bx: 900, by: 100, ba: Math.PI / 2, r: 24 });
  const b = P.addBody(w, { shape: 'circle', r: 12, x: 200, y: 300, vx: 500, type: 'dynamic', mat: 'ball' });
  run(w, 0.5);
  check('portal sends the ball out of the other mouth along its angle', Math.abs(b.x - 900) < 2 && b.vy > 490 && b.y > 100, b.x + ',' + b.y + ' v=' + b.vx + ',' + b.vy);
}

/* kinematic paddle spins and swats a ball */
{
  const w = P.createWorld({ gravity: [0, 0] });
  const pad = P.addBody(w, { shape: 'box', x: 400, y: 300, w: 160, h: 16, type: 'kinematic', motor: { spin: 4 } });
  const b = P.addBody(w, { shape: 'circle', r: 12, x: 460, y: 330, type: 'dynamic', mat: 'ball' });
  run(w, 1);
  check('paddle rotates', Math.abs(pad.a - 4) < 0.05, pad.a);
  check('paddle swats the ball', Math.hypot(b.vx, b.vy) > 100, Math.hypot(b.vx, b.vy));
}

/* pendulum keeps its rope length */
{
  const w = P.createWorld({ gravity: [0, 1200] });
  const bob = P.addBody(w, { shape: 'circle', r: 18, x: 600, y: 200, type: 'dynamic', mat: 'metal' });
  P.addJoint(w, { ax: 400, ay: 200, body: bob, len: 200 });
  let maxLen = 0;
  for (let i = 0; i < 240 * 2; ++i) { P.step(w); maxLen = Math.max(maxLen, Math.hypot(bob.x - 400, bob.y - 200)); }
  check('rope holds the bob', maxLen < 212, maxLen);
}

/* raycast for the aim guide */
{
  const w = floorWorld();
  const hit = P.raycast(w, 640, 100, 0, 1, 2000, 10);
  check('raycast finds the floor top minus radius', hit && Math.abs(hit.y - 590) < 1e-6 && hit.ny < -0.99, hit && hit.y);
}

/* fast ball does not tunnel through a thin plank */
{
  const w = P.createWorld({ gravity: [0, 0] });
  P.addBody(w, { shape: 'box', x: 640, y: 300, w: 14, h: 300 });
  const b = P.addBody(w, { shape: 'circle', r: 13, x: 400, y: 300, vx: 2500, type: 'dynamic', mat: 'ball' });
  run(w, 0.5);
  check('fast ball bounces off a thin plank', b.x < 640, b.x);
}

/* performance: a busy scene steps fast enough for solver searches */
{
  const w = floorWorld();
  for (let i = 0; i < 20; ++i)
    P.addBody(w, { shape: 'box', x: 300 + (i % 10) * 70, y: 560 - Math.floor(i / 10) * 45, w: 40, h: 40, type: 'dynamic' });
  for (let i = 0; i < 10; ++i)
    P.addBody(w, { shape: 'box', x: 100 + i * 110, y: 200 + (i % 3) * 60, w: 90, h: 14, a: 0.3 * (i % 2 ? 1 : -1) });
  for (let i = 0; i < 3; ++i)
    P.addBody(w, { shape: 'circle', r: 13, x: 200 + i * 300, y: 50, vx: 300, type: 'dynamic', mat: 'ball' });
  const t0 = process.hrtime.bigint();
  run(w, 3);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check('busy scene: 3 s simulated in < 400 ms', ms < 400, ms.toFixed(1) + ' ms');
  console.log('INFO busy scene step ' + (ms / (3 / P.STEP)).toFixed(4) + ' ms');
}

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
