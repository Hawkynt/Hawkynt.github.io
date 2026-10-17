'use strict';

global.window = {};
require('../physics.js');
require('../levels-data.js');
require('../entities.js');

const Ph = window.SZ.PlatformerPhysics;
const L = window.SZ.PlatformerLevels;
const E = window.SZ.PlatformerEntities;
const TS = Ph.TS;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!E && Object.isFrozen(E), 'SZ.PlatformerEntities missing or not frozen');

function makeGame(level, player) {
  const events = {};
  return {
    level: level, player: player, t: 0, shots: [], enemies: [],
    emit: (type) => { events[type] = (events[type] || 0) + 1; }, events: events
  };
}

const finite = (o) => ['x', 'y', 'vx', 'vy'].every(k => Number.isFinite(o[k]));

/* every foe type in every world behaves for 30 seconds without leaving the level or going NaN */
const lv = L.build(L.CAMPAIGN[0][1]);
for (const type of Object.keys(E.ENEMY_DEFS)) {
  for (let w = 0; w < 5; ++w) {
    const level = L.build(L.CAMPAIGN[w][1]);
    const p = Ph.createPlayer(level.start.c * TS, (level.start.r + 1) * TS - Ph.P.h);
    const g = makeGame(level, p);
    /* stand the foe on the floor near the start */
    const e = E.createEnemy(type, level.start.c + 6, level.start.r, w);
    let ok = true;
    for (let i = 0; i < 30 * 120; ++i) {
      p.x = level.start.c * TS + Math.sin(i / 300) * 200 + 200;
      E.updateEnemy(e, g, Ph.STEP);
      for (const s of g.shots) E.updateShot(s, g, Ph.STEP);
      if (!finite(e)) { ok = false; break; }
    }
    check(type + ' in world ' + w + ' stays sane', ok && (e.alive ? e.x > -TS && e.x < level.cols * TS : true), 'x ' + e.x + ' y ' + e.y);
  }
}

/* chargers charge, divers dive, turrets shoot */
{
  const level = L.build(L.CAMPAIGN[0][0]);
  const floorRow = level.start.r;
  const p = Ph.createPlayer((level.start.c + 2) * TS, (floorRow + 1) * TS - Ph.P.h);
  const g = makeGame(level, p);
  const ch = E.createEnemy('charger', level.start.c + 7, floorRow, 0);
  ch.dir = -1;
  let charged = false;
  for (let i = 0; i < 600; ++i) { E.updateEnemy(ch, g, Ph.STEP); if (ch.state === 'charge') charged = true; }
  check('charger charges at the hero', charged, 'state ' + ch.state);
  const tu = E.createEnemy('turret', level.start.c + 8, floorRow, 0);
  for (let i = 0; i < 800; ++i) E.updateEnemy(tu, g, Ph.STEP);
  check('turret fires', g.shots.length > 0 && g.events.shot > 0, g.shots.length + ' shots');
  const dv = E.createEnemy('diver', level.start.c + 3, floorRow - 6, 0);
  let dived = false;
  for (let i = 0; i < 800; ++i) { E.updateEnemy(dv, g, Ph.STEP); if (dv.state === 'dive') dived = true; }
  check('diver swoops', dived, 'state ' + dv.state);
}

/* shots: fireballs bounce along the floor, enemy shots die in walls */
{
  const level = L.build(L.CAMPAIGN[0][0]);
  const g = makeGame(level, Ph.createPlayer(0, 0));
  const fb = E.spawnShot(g, { kind: 'fireball', owner: 'player', x: (level.start.c + 1) * TS, y: (level.start.r) * TS, vx: 600, vy: 100, gravity: 1500, r: 10, life: 1.5, bounce: true });
  let bounced = false, prevVy = 0;
  for (let i = 0; i < 120; ++i) { E.updateShot(fb, g, Ph.STEP); if (prevVy > 0 && fb.vy < 0) bounced = true; prevVy = fb.vy; }
  check('fireball bounces', bounced, 'vy ' + fb.vy);
  const box = E.shotBox(fb, {});
  check('shot box', box.w === 20 && box.h === 20, JSON.stringify(box));
}

/* platforms follow their path */
{
  const level = L.build(L.CAMPAIGN[0][4]);
  const pls = E.createPlatforms(level);
  check('platforms created', pls.length === level.platforms.length && pls.length > 0, pls.length);
  let moved = false;
  for (let t = 0; t < 6; t += 0.5) {
    E.updatePlatforms(pls, t);
    if (Math.abs(pls[0].x - pls[0].def.x0) + Math.abs(pls[0].y - pls[0].def.y0) > 30) moved = true;
  }
  check('platforms move', moved, 'stuck');
}

/* bosses: three phases, defeated by six stomps, never leave the arena */
for (let w = 0; w < 5; ++w) {
  const level = L.build(L.CAMPAIGN[w][5]);
  const kind = level.boss;
  const p = Ph.createPlayer((level.arena.gate + 6) * TS, (level.arena.r + 1) * TS - Ph.P.h);
  const g = makeGame(level, p);
  const b = E.createBoss(kind, level);
  b.active = true;
  let inArena = true, sane = true, attacked = false;
  for (let i = 0; i < 40 * 120; ++i) {
    p.x = (level.arena.gate + 4 + (Math.sin(i / 200) + 1) * 10) * TS;
    E.updateBoss(b, g, Ph.STEP);
    for (const s of g.shots) E.updateShot(s, g, Ph.STEP);
    if (!finite(b)) { sane = false; break; }
    if (b.x < level.arena.c0 * TS - 1 || b.x + b.w > (level.arena.c1 + 1) * TS + 1) inArena = false;
  }
  attacked = g.shots.length > 0 || (g.events.quake || 0) > 0;
  check(kind + ' runs for 40 s', sane, 'NaN');
  check(kind + ' stays in its arena', inArena, 'x ' + b.x);
  check(kind + ' attacks', attacked, JSON.stringify(g.events));
  const phases = [];
  for (let k = 0; k < 6; ++k) {
    b.inv = 0;
    E.hurtBoss(b, 1, g);
    phases.push(b.phase);
  }
  check(kind + ' phases 1-2-3', phases.join('') === '112233', phases.join(''));
  check(kind + ' is dying after six hits', b.dying > 0, 'hp ' + b.hp);
  for (let i = 0; i < 400; ++i) E.updateBoss(b, g, Ph.STEP);
  check(kind + ' defeated', !b.alive, 'still alive');
}

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
