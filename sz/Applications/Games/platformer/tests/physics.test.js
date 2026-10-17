'use strict';

global.window = {};
const fs = require('fs');
require('../physics.js');

const Ph = window.SZ.PlatformerPhysics;
const T = Ph.T, TS = Ph.TS, STEP = Ph.STEP;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const CODE = { '.': T.EMPTY, '#': T.SOLID, '=': T.ONEWAY, '^': T.SPIKE, 'T': T.SPRING, '~': T.LIQUID, 'I': T.ICE };

function levelOf(rows) {
  const cols = rows[0].length;
  const tiles = new Uint8Array(cols * rows.length);
  for (let r = 0; r < rows.length; ++r)
    for (let c = 0; c < cols; ++c)
      tiles[r * cols + c] = CODE[rows[r].charAt(c)] || 0;
  return { cols: cols, rows: rows.length, tiles: tiles };
}

const BASE = { doubleJump: false, wallJump: false, dash: 0, airControl: 0 };
const FULL = { doubleJump: true, wallJump: true, dash: 2, airControl: 2 };

function input() {
  return { left: false, right: false, down: false, jump: false, jumpPressed: false, dashPressed: false };
}

/* place a player standing on the floor top at row r, column c */
function standAt(level, c, r) {
  const p = Ph.createPlayer(c * TS + 10, r * TS - Ph.P.h);
  const world = { level: level, platforms: [] };
  for (let i = 0; i < 10; ++i)
    Ph.stepPlayer(p, input(), world, BASE, STEP);
  return p;
}

function run(p, level, stats, steps, fn, platforms) {
  const world = { level: level, platforms: platforms || [] };
  const inp = input();
  for (let i = 0; i < steps; ++i) {
    fn(inp, i);
    Ph.stepPlayer(p, inp, world, stats, STEP);
    inp.jumpPressed = false;
    inp.dashPressed = false;
  }
}

const FLAT = levelOf([
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
  '##############################'
]);

/* module */
check('module registered', !!Ph && typeof Ph.stepPlayer === 'function', 'SZ.PlatformerPhysics missing');
check('export frozen', Object.isFrozen(Ph), 'not frozen');
check('no DOM use', fs.readFileSync(require.resolve('../physics.js'), 'utf8').indexOf('document') < 0, 'physics touches the DOM');

/* standing settles on the floor */
{
  const p = standAt(FLAT, 5, 8);
  check('stands on floor', p.onGround && Math.abs(p.y + p.h - 8 * TS) < 0.01, 'y ' + (p.y + p.h) + ' ground ' + p.onGround);
}

/* full jump height about 3.5 tiles, a tap much lower */
function apex(holdSteps) {
  const p = standAt(FLAT, 5, 8);
  const y0 = p.y;
  let top = y0;
  run(p, FLAT, BASE, 200, (inp, i) => {
    inp.jump = i < holdSteps;
    inp.jumpPressed = i === 0;
    top = Math.min(top, p.y);
  });
  return y0 - top;
}
const full = apex(200), tap = apex(4);
check('full jump ~3.5 tiles', full > 3.2 * TS && full < 3.8 * TS, (full / TS).toFixed(2) + ' tiles');
check('variable jump: tap is low', tap < full * 0.5 && tap > 0.4 * TS, (tap / TS).toFixed(2) + ' tiles vs ' + (full / TS).toFixed(2));

/* running speed */
{
  const p = standAt(FLAT, 2, 8);
  run(p, FLAT, BASE, 60, (inp) => { inp.right = true; });
  check('runs at top speed', Math.abs(p.vx - Ph.P.run) < 1, 'vx ' + p.vx);
}

/* coyote time and buffering */
const LEDGE = levelOf([
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##########....................',
  '##########....................'
]);
function ledgeJump(delaySteps) {
  const p = standAt(LEDGE, 7, 8);
  let leftAt = -1, jumped = false;
  run(p, LEDGE, BASE, 140, (inp, i) => {
    inp.right = true;
    if (leftAt < 0 && !p.onGround && i > 0)
      leftAt = i;
    if (leftAt >= 0 && i === leftAt + delaySteps) {
      inp.jump = true;
      inp.jumpPressed = true;
    }
    if (p.ev.jump)
      jumped = true;
  });
  return jumped;
}
check('coyote: late jump still works', ledgeJump(8), 'no jump 8 steps after leaving the ledge');
check('coyote: too late fails', !ledgeJump(24), 'jumped 0.2 s after leaving the ledge');
{
  const p = Ph.createPlayer(5 * TS, 8 * TS - Ph.P.h - 30);
  let jumpedOnLanding = false, landedAt = -1;
  run(p, FLAT, BASE, 120, (inp, i) => {
    inp.jump = i >= 2;
    inp.jumpPressed = i === 2;
    if (p.ev.jump)
      jumpedOnLanding = true;
    if (p.onGround && landedAt < 0)
      landedAt = i;
  });
  check('buffered jump fires on landing', jumpedOnLanding, 'jump pressed in the air was lost');
}

/* wall slide and wall jump */
const SHAFT = levelOf([
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#######'
]);
function wallTest(stats) {
  const p = Ph.createPlayer(5 * TS - Ph.P.w - 1, 2 * TS);
  let slid = false, kicked = false;
  run(p, SHAFT, stats, 60, (inp, i) => {
    inp.right = true;
    if (p.ev.wallSlide) slid = true;
    if (i === 40) { inp.jump = true; inp.jumpPressed = true; }
    if (p.ev.wallJump) kicked = true;
  });
  return { slid: slid, kicked: kicked };
}
check('wall slide caps the fall', wallTest(BASE).slid, 'no wall slide');
check('no wall jump without the upgrade', !wallTest(BASE).kicked, 'wall jumped with base stats');
check('wall jump with the upgrade', wallTest(FULL).kicked, 'no wall jump with Wall Kick');

/* double jump */
{
  const p = standAt(FLAT, 5, 8);
  let doubled = false;
  run(p, FLAT, FULL, 80, (inp, i) => {
    inp.jump = i < 10 || (i >= 30 && i < 40);
    inp.jumpPressed = i === 0 || i === 30;
    if (p.ev.doubleJump) doubled = true;
  });
  check('double jump with Cloud Step', doubled, 'no air jump');
  const q = standAt(FLAT, 5, 8);
  let d2 = false;
  run(q, FLAT, BASE, 80, (inp, i) => {
    inp.jump = i < 10 || (i >= 30 && i < 40);
    inp.jumpPressed = i === 0 || i === 30;
    if (q.ev.doubleJump) d2 = true;
  });
  check('no double jump by default', !d2, 'air jump with base stats');
}

/* dash */
{
  const p = standAt(FLAT, 3, 8);
  const x0 = p.x;
  let dashed = false;
  run(p, FLAT, FULL, 30, (inp, i) => {
    inp.right = i === 0;
    inp.dashPressed = i === 0;
    if (p.ev.dash) dashed = true;
  });
  check('dash fires', dashed, 'no dash');
  check('dash covers ground', p.x - x0 > 2.5 * TS, ((p.x - x0) / TS).toFixed(2) + ' tiles');
  const q = standAt(FLAT, 3, 8);
  let d2 = false;
  run(q, FLAT, BASE, 30, (inp, i) => { inp.dashPressed = i === 0; if (q.ev.dash) d2 = true; });
  check('no dash by default', !d2, 'dashed with base stats');
}

/* one-way ledges: jump up through, land on top, drop through */
const ONEWAY = levelOf([
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '...====...',
  '..........',
  '..........',
  '##########',
  '##########'
]);
{
  const p = standAt(ONEWAY, 4, 8);
  run(p, ONEWAY, BASE, 140, (inp, i) => { inp.jump = i < 60; inp.jumpPressed = i === 0; });
  check('jumps up through a one-way and lands on it', p.onGround && Math.abs(p.y + p.h - 5 * TS) < 0.5, 'feet ' + (p.y + p.h) + ' ground ' + p.onGround);
  run(p, ONEWAY, BASE, 100, (inp, i) => { inp.down = true; inp.jumpPressed = i === 0; inp.jump = i < 2; });
  check('drops through with down + jump', p.onGround && Math.abs(p.y + p.h - 8 * TS) < 0.5, 'feet ' + (p.y + p.h));
}

/* springs */
const SPRING = levelOf([
  '..........', '..........', '..........', '..........', '..........', '..........', '..........', '..........',
  '..........', '..........', '..........', '..........', '....T.....', '##########', '##########'
]);
{
  const p = Ph.createPlayer(4 * TS + 10, 10 * TS);
  let sprung = false, top = 1e9;
  run(p, SPRING, BASE, 200, () => { if (p.ev.spring) sprung = true; top = Math.min(top, p.y); });
  check('spring launches', sprung && 12 * TS - top - Ph.P.h > 6 * TS, 'height ' + ((12 * TS - top - Ph.P.h) / TS).toFixed(2));
}

/* ice keeps you sliding */
const ICE = levelOf(['..............................', '..............................', '..............................', 'IIIIIIIIIIIIIIIIIIIIIIIIIIIIII', '##############################']);
function stopDistance(level) {
  const p = standAt(level, 3, 3);
  run(p, level, BASE, 60, (inp) => { inp.right = true; });
  const x0 = p.x;
  run(p, level, BASE, 240, () => {});
  return p.x - x0;
}
const ROCK = levelOf(['..............................', '..............................', '..............................', '##############################', '##############################']);
const dIce = stopDistance(ICE), dRock = stopDistance(ROCK);
check('ice slides further', dIce > dRock * 3, 'ice ' + dIce.toFixed(1) + ' rock ' + dRock.toFixed(1));

/* moving platforms carry the rider */
{
  const def = { x0: 3 * TS, y0: 6 * TS, x1: 9 * TS, y1: 6 * TS, w: 3 * TS, h: 18, speed: 120, phase: 0 };
  const pl = { x: def.x0, y: def.y0, w: def.w, h: def.h, px: def.x0, py: def.y0 };
  const p = Ph.createPlayer(def.x0 + 40, def.y0 - Ph.P.h - 4);
  const world = { level: FLAT, platforms: [pl] };
  const tmp = {};
  let t = 0;
  for (let i = 0; i < 300; ++i) {
    t += STEP;
    Ph.platformPos(def, t - STEP, tmp); pl.px = tmp.x; pl.py = tmp.y;
    Ph.platformPos(def, t, tmp); pl.x = tmp.x; pl.y = tmp.y;
    Ph.stepPlayer(p, input(), world, BASE, STEP);
  }
  check('platform carries the rider', p.onGround && p.platform === 0 && p.x - (pl.x + 40) < 2 && p.x > def.x0 + 60, 'x ' + p.x.toFixed(1) + ' pl ' + pl.x.toFixed(1));
}

/* hazards */
const SPIKES = levelOf(['..........', '..........', '....^.....', '##########']);
{
  const p = standAt(SPIKES, 1, 3);
  let hit = null;
  run(p, SPIKES, BASE, 120, (inp) => { inp.right = true; if (!hit) hit = Ph.hazardAt(p, SPIKES); });
  check('spikes hurt', hit === 'spike', 'hazard ' + hit);
  check('spike orientation', Ph.spikeOrientation(SPIKES, 4, 2) === 'up', Ph.spikeOrientation(SPIKES, 4, 2));
  const q = Ph.createPlayer(2 * TS, 10 * TS);
  check('falling out is a hazard', Ph.hazardAt(q, SPIKES) === 'fall', Ph.hazardAt(q, SPIKES));
}

/* corner correction: a jump clipping a ceiling edge slides past it */
const CORNER = levelOf(['..........', '..........', '.....#....', '..........', '..........', '..........', '##########']);
{
  const p = Ph.createPlayer(5 * TS - Ph.P.w + 6, 6 * TS - Ph.P.h);
  run(p, CORNER, BASE, 4, () => {});
  let bumped = false;
  run(p, CORNER, BASE, 60, (inp, i) => { inp.jump = true; inp.jumpPressed = i === 0; if (p.ev.head) bumped = true; });
  check('corner correction', !bumped && p.y < 3 * TS, 'bumped ' + bumped + ' y ' + p.y.toFixed(1));
}

/* determinism */
{
  const a = standAt(FLAT, 2, 8), b = standAt(FLAT, 2, 8);
  const script = (inp, i) => { inp.right = i % 50 < 30; inp.jump = i % 40 < 12; inp.jumpPressed = i % 40 === 0; };
  run(a, FLAT, FULL, 500, script);
  run(b, FLAT, FULL, 500, script);
  check('deterministic', a.x === b.x && a.y === b.y && a.vx === b.vx, a.x + ' vs ' + b.x);
}

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
