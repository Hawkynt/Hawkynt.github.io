'use strict';

/* Game rules in the live simulation on hand-built arenas: blast reach and blocking, chain
   reactions, kick, glove throw, remote detonation, pierce, two-hit crates, ice slides, belts,
   teleport pads, burning power-ups, the exit, chain and combo scoring, damage, shields,
   respawns, Phoenix, Zen, Hurry Up and boss damage with its second phase. */
const H = require('./harness');
H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const C = NS.constants;
const { COLS, ROWS, T_EMPTY, T_HARD, T_SOFT, T_CRATE, T_ICE, T_BELT_R, T_TELE } = C;
const A = NS.arena;

G.save.seen.intro = true;
for (let w = 0; w < 5; ++w) { G.save.seen.chapters[w] = true; G.save.seen.bosses[w] = true; }
NS.input.sample = () => {};

/* an open arena with a stone border, the player at (x, y), no enemies */
function arena(x, y, mode) {
  NS.run.newRun(mode || 'arcade', { seed: 1 });
  const run = G.run;
  const g = run.level.grid;
  for (let r = 0; r < ROWS; ++r) for (let c = 0; c < COLS; ++c) g[r * COLS + c] = (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) ? T_HARD : T_EMPTY;
  run.level.hidden = {};
  run.level.exit = -1;
  run.exitAt = -1;
  run.enemies.length = 0;
  run.pickups.length = 0;
  run.phase = 'play';
  run.timeLeft = 0;
  run.player.x = x; run.player.y = y; run.player.inv = 0;
  G.lvl.dirty = true;
  A.rebuild();
  return run;
}
function step(n) { for (let i = 0; i < n; ++i) NS.sim.update(C.STEP); }
function idx(c, r) { return r * COLS + c; }
function input(mx, my) { G.input.moveX = mx; G.input.moveY = my; }

/* blast reach */
let run = arena(5, 5);
run.player.fire = 3;
run.level.grid[idx(5, 2)] = T_HARD;
run.level.grid[idx(8, 5)] = T_SOFT;
G.input.bombQ = true; step(1);
check('a bomb is placed under the player', run.bombs.length === 1 && run.bombs[0].i === idx(5, 5));
run.player.x = 3; run.player.y = 3;
step(Math.ceil(C.FUSE * 60) + 1);
check('the blast reaches its range', run.fire[idx(2, 5)] > 0 && run.fire[idx(5, 8)] > 0 && run.fire[idx(5, 9)] === 0);
check('stone stops the blast', run.fire[idx(5, 3)] > 0 && run.fire[idx(5, 2)] === 0);
check('a brick burns and stops the blast', run.level.grid[idx(8, 5)] === T_EMPTY && run.fire[idx(8, 5)] > 0 && run.fire[idx(9, 5)] === 0);
step(60);
check('fire dies down', run.fire.every(f => f === 0));

/* chain reaction */
run = arena(1, 1);
NS.bombs.placeEnemy(5, 5, 2, 0.5, 'p');
NS.bombs.placeEnemy(7, 5, 2, 9, 'p');
NS.bombs.placeEnemy(9, 5, 2, 9, 'p');
step(46);
check('bombs in a blast chain-detonate', run.bombs.length === 0 && run.fire[idx(11, 5)] > 0);

/* kick */
run = arena(3, 5);
run.player.kick = true;
NS.bombs.placeEnemy(4, 5, 2, 9, 'p');
run.level.grid[idx(12, 5)] = T_SOFT;
input(1, 0); step(2); input(0, 0);
step(80);
check('a kicked bomb slides until something stops it', run.bombs[0] && run.bombs[0].x === 11 && run.bombs[0].vx === 0, run.bombs[0] && run.bombs[0].x);

/* glove throw */
run = arena(5, 5);
run.player.glove = true;
G.input.bombQ = true; step(1);
G.input.bombQ = true; run.player.dir = 3; step(1);
step(40);
check('the glove throws the bomb three tiles', run.bombs.length === 1 && run.bombs[0].x === 8 && !run.bombs[0].fly);

/* remote */
run = arena(5, 5);
run.player.remote = true;
G.input.bombQ = true; step(1);
run.player.x = 2;
step(300);
check('remote bombs wait', run.bombs.length === 1);
G.input.detonateQ = true; step(3);
check('X detonates remote bombs', run.bombs.length === 0 && run.fire[idx(5, 5)] > 0);

/* pierce and crates */
run = arena(3, 5);
run.player.pierce = true; run.player.fire = 5;
run.level.grid[idx(5, 5)] = T_SOFT; run.level.grid[idx(6, 5)] = T_SOFT;
run.level.grid[idx(3, 7)] = T_CRATE; run.level.grid[idx(3, 8)] = T_SOFT;
G.input.bombQ = true; step(1);
run.player.x = 1; run.player.y = 1;
step(Math.ceil(C.FUSE * 60) + 2);
check('pierce blasts through every brick in line', run.level.grid[idx(5, 5)] === T_EMPTY && run.level.grid[idx(6, 5)] === T_EMPTY && run.fire[idx(8, 5)] > 0);
check('a crate cracks on the first blast and stops even pierce', run.level.grid[idx(3, 7)] === T_SOFT && run.level.grid[idx(3, 8)] === T_SOFT);

/* ice */
run = arena(3, 5);
for (let c = 4; c <= 9; ++c) run.level.grid[idx(c, 5)] = T_ICE;
run.level.grid[idx(12, 5)] = T_HARD;
input(1, 0); step(16); input(0, 0);
step(150);
check('on ice the player slides on after letting go', run.player.x >= 10, run.player.x);

/* belts carry bombs */
run = arena(1, 1);
for (let c = 4; c <= 8; ++c) run.level.grid[idx(c, 5)] = T_BELT_R;
NS.bombs.placeEnemy(4, 5, 1, 30, 'p');
step(200);
check('a belt carries a resting bomb to its end', run.bombs[0] && run.bombs[0].x === 9, run.bombs[0] && run.bombs[0].x);

/* teleport */
run = arena(3, 5);
run.level.grid[idx(4, 5)] = T_TELE; run.level.grid[idx(15, 9)] = T_TELE;
G.lvl.dirty = true; A.rebuild();
input(1, 0); step(25); input(0, 0);
check('a teleport pad sends the player to its twin', Math.abs(run.player.x - 15) <= 1 && run.player.y === 9, run.player.x + ',' + run.player.y);

/* burning power-ups */
run = arena(1, 1);
const pk = NS.items.spawn('bomb', idx(6, 5), 0);
pk.t = 2;
NS.items.spawn('gem', idx(7, 5), 0).t = 2;
NS.bombs.placeEnemy(5, 5, 3, 0.02, 'p');
step(5);
check('fire burns exposed power-ups but not gems', !run.pickups.some(p => p.type === 'bomb') && run.pickups.some(p => p.type === 'gem'));

/* pickups */
run = arena(5, 5);
for (const t of ['bomb', 'fire', 'speed', 'kick', 'shield', 'maxfire']) NS.items.spawn(t, idx(5, 5), 0);
step(2);
check('walking over power-ups applies them', run.player.bombs === G.perks.bombs + 1 && run.player.fire === C.MAX_FIRE && run.player.kick && run.player.shield === 1 && run.player.speed === G.perks.speed + 1);

/* exit and scoring */
run = arena(3, 5);
run.exitAt = idx(10, 5); run.exitShown = true; run.level.exit = run.exitAt;
NS.enemies.spawn('puff', 7, 5, { instant: true });
NS.enemies.spawn('puff', 7, 6, { instant: true });
run.enemies.forEach(e => { e.spawnT = 0; });
step(2);
check('the exit stays shut while enemies live', !run.exitOpen);
const score0 = run.score;
NS.bombs.placeEnemy(7, 4, 3, 0.02, 'p');
run.enemies[0].x = 7; run.enemies[0].y = 5; run.enemies[0].tx = 7; run.enemies[0].ty = 5;
run.enemies[1].x = 7; run.enemies[1].y = 6; run.enemies[1].tx = 7; run.enemies[1].ty = 6;
G.run.freezeT = 5;
step(6);
check('one blast defeating two enemies is a 2x chain', run.enemies.length === 0 && run.score - score0 >= 100 + 200, run.score - score0);
check('the combo multiplier rose', run.combo === 2);
step(3);
check('the exit opens when the last enemy falls', run.exitOpen);
run.player.x = 10; run.player.y = 5;
step(3);
check('stepping into the open exit clears the stage', run.phase === 'clear');
step(130);
check('the results card follows', G.screen === 'results' && G.ui.results.cleared);

/* damage, shield, respawn */
run = arena(5, 5, 'arcade');
const lives = run.lives;
run.player.shield = 1;
NS.player.hurt('test');
check('a shield absorbs a hit', run.lives === lives && run.player.shield === 0 && !run.player.dead);
run.player.inv = 0;
NS.player.hurt('test');
check('a hit costs a life', run.lives === lives - 1 && run.player.dead);
step(200);
check('the player respawns at the spawn', !run.player.dead && run.player.inv > 0 && run.player.x === run.level.spawn % COLS, JSON.stringify([run.player.dead, run.player.inv, run.player.x, run.level.spawn, G.screen, run.phase]));
run.lives = 1; run.player.inv = 0;
NS.player.hurt('test');
step(200);
check('the last life lost ends the run', G.screen === 'results' && !G.ui.results.cleared && run.over);

/* Phoenix */
G.save.tree.g_phoenix = 1; NS.save.refreshPerks();
run = arena(5, 5, 'arcade');
NS.player.hurt('test');
check('Phoenix saves the first fatal hit of a run', !run.player.dead && run.phoenixUsed);
run.player.inv = 0;
NS.player.hurt('test');
check('only once per run', run.player.dead);
delete G.save.tree.g_phoenix; NS.save.refreshPerks();

/* Zen never kills */
run = arena(5, 5, 'zen');
NS.player.hurt('fire');
check('Zen turns a hit into a bump', !run.player.dead && run.lives === 0);

/* Hurry Up */
run = arena(5, 5, 'arcade');
NS.enemies.spawn('puff', 15, 9, { instant: true });
run.timeLeft = 0.05;
step(4 * 60);
check('Hurry Up sends wisps', run.enemies.some(e => e.hurry));
run.enemies = run.enemies.filter(e => e.hurry);
step(2);
check('hurry wisps never keep the exit shut', run.exitOpen);

/* boss damage */
NS.run.newRun('story', { world: 0, level: 6 });
run = G.run;
run.phase = 'play';
step(120);
const b = run.boss;
b.state = 'chase'; b.under = false; b.alpha = 1; b.inv = 0; b.t = 0; b.dur = 99;
const hp = b.hp;
NS.bombs.setFire(idx(Math.round(b.x), Math.round(b.y)), 16, 1, 0);
step(1);
check('player fire hurts the boss', b.hp === hp - 1 && b.inv > 0);
b.inv = 0;
NS.bombs.setFire(idx(Math.round(b.x), Math.round(b.y)), 16, 1, 2);
step(1);
check('its own fire does not', b.hp === hp - 1);
b.hp = Math.ceil(b.maxHp / 2) + 1; b.inv = 0;
NS.bosses.hit(b);
check('half health enrages it', b.phase === 2);
b.hp = 1; b.inv = 0;
NS.bosses.hit(b);
step(200);
check('a defeated boss opens the exit', b.state === 'dead' && run.exitOpen && run.exitShown);

done();
