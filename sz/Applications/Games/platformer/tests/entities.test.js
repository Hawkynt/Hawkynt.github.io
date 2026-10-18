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

/* a beaten boss takes its hazards along, and nothing new comes after */
for (let w = 0; w < 5; ++w) {
  const level = L.build(L.CAMPAIGN[w][5]);
  const p = Ph.createPlayer((level.arena.gate + 6) * TS, (level.arena.r + 1) * TS - Ph.P.h);
  const g = makeGame(level, p);
  const b = E.createBoss(level.boss, level);
  b.active = true;
  b.hp = b.maxHp / 4;
  b.phase = 3;
  let i = 0;
  for (; i < 30 * 120 && !g.shots.some(s => s.alive); ++i) {
    E.updateBoss(b, g, Ph.STEP);
    for (const s of g.shots) E.updateShot(s, g, Ph.STEP);
  }
  const had = g.shots.filter(s => s.alive).length;
  b.inv = 0;
  E.hurtBoss(b, b.hp, g);
  const left = g.shots.filter(s => s.alive).length;
  const before = g.shots.length;
  for (let k = 0; k < 400 && b.alive; ++k) {
    E.updateBoss(b, g, Ph.STEP);
    for (const s of g.shots) E.updateShot(s, g, Ph.STEP);
  }
  check(level.boss + ' hazards vanish when its health runs out', had > 0 && left === 0, had + ' before, ' + left + ' after');
  check(level.boss + ' attacks no more while dying', g.shots.length === before && !b.alive, (g.shots.length - before) + ' new shots');
}

/* boss projectiles start at the boss: the slime's waves at its feet, on a ledge too */
{
  const level = L.build(L.CAMPAIGN[0][5]);
  const a = level.arena;
  /* the low ledge left of the arena floor */
  let lc = -1, lr = -1;
  for (let r = a.r - 1; r > a.r - 4 && lc < 0; --r)
    for (let c = a.c0 + 2; c < a.c0 + 8; ++c)
      if (Ph.tileAt(level, c, r) === Ph.T.ONEWAY) { lc = c; lr = r; break; }
  check('arena has a low ledge', lc >= 0, 'none');
  for (const onLedge of [false, true]) {
    const p = Ph.createPlayer((a.gate + 6) * TS, (a.r + 1) * TS - Ph.P.h);
    const g = makeGame(level, p);
    const b = E.createBoss('slime', level);
    b.active = true;
    b.phase = 2;
    b.state = 'hop';
    b.vx = 0;
    b.vy = 100;
    b.onGround = false;
    b.x = onLedge ? lc * TS : (a.c0 + 12) * TS;
    b.y = (onLedge ? lr * TS : (a.r + 1) * TS) - b.h - 20;
    for (let i = 0; i < 120 && !g.shots.length; ++i) E.updateBoss(b, g, Ph.STEP);
    const feet = b.y + b.h;
    const waves = g.shots.filter(s => s.kind === 'wave');
    check('slime waves start at its feet ' + (onLedge ? 'on a ledge' : 'on the floor'), waves.length === 2 && waves.every(s => s.ground === feet && s.x > b.x && s.x < b.x + b.w), JSON.stringify(waves.map(s => [s.x, s.ground])) + ' feet ' + feet);
    check('slime waves come with a burst at the boss', (g.events.muzzle || 0) === 2, JSON.stringify(g.events));
    for (let i = 0; i < 4; ++i) for (const s of g.shots) E.updateShot(s, g, Ph.STEP);
    check('slime waves run along ' + (onLedge ? 'the ledge' : 'the floor'), waves.every(s => s.alive && s.ground === feet), 'wave died at once');
  }
}

/* with the gate shut, a slime hopping against the arena edge lands on real floor, not on the gate */
{
  const level = L.build(L.CAMPAIGN[0][5]);
  const a = level.arena;
  for (let r = a.r - 4; r <= a.r; ++r) Ph.setTile(level, a.gate, r, Ph.T.GATE);
  const p = Ph.createPlayer((a.gate + 1) * TS, (a.r + 1) * TS - Ph.P.h);
  const g = makeGame(level, p);
  const b = E.createBoss('slime', level);
  b.active = true;
  b.phase = 2;
  b.state = 'hop';
  b.onGround = false;
  b.x = b.ax0 + 2;
  b.y = (a.r - 4) * TS - b.h - 0.3;
  b.vx = -320;
  b.vy = 60;
  for (let i = 0; i < 240 && b.state === 'hop'; ++i) E.updateBoss(b, g, Ph.STEP);
  let under = false;
  for (let c = Math.floor(b.x / TS); c <= Math.floor((b.x + b.w - 0.01) / TS); ++c) {
    const code = Ph.tileAt(level, c, Math.floor((b.y + b.h + 1) / TS));
    if (c !== a.gate && (Ph.isSolid(code) || code === Ph.T.ONEWAY)) under = true;
  }
  check('slime never lands on the closed gate', b.state === 'idle' && under && b.x >= b.ax0, 'landed at ' + b.x + ',' + (b.y + b.h));
}

/* power-ups: they climb out of a bumped block and rest on top of it */
{
  const it = E.createBlockItem('fire', 10, 11);
  const top = 11 * TS;
  check('item starts inside its block', it.y === top + TS / 2, 'y ' + it.y);
  const stand = Ph.createPlayer(10 * TS + (TS - Ph.P.w) / 2, top - Ph.P.h);
  check('item cannot be taken inside the block', !E.itemTouches(it, stand), 'grabbed at once');
  for (let i = 0; i < 120; ++i) E.updateBlockItem(it, Ph.STEP);
  check('item rests on top of the block', it.y === top - TS / 2, 'y ' + it.y);
  check('item is taken by a hero standing on the block', E.itemTouches(it, stand), 'out of reach');
  const below = Ph.createPlayer(10 * TS + (TS - Ph.P.w) / 2, (11 + 1) * TS);
  check('item is not taken through the block', !E.itemTouches(it, below), 'grabbed through the block');
  it.taken = true;
  check('a taken item is gone', !E.itemTouches(it, stand), 'taken twice');
}

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
