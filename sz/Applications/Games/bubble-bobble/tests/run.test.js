'use strict';

/* Engine and sessions: every story room is reachable (breadth-first search with the real jump),
   the player runs, jumps up through platforms and wraps through the floor, bubbles trap enemies
   (brutes take two), chains pop together and double their points, popped enemies drop fruit,
   bubbles bounce the player, trapped enemies break out angry, hurry-up and the shade come in
   time, elemental bubbles work, five stars give a life, candy does what it says, losing every
   life ends the game, the bot clears every room and beats every guardian, stars follow par and
   bonus goals, the endless modes build new rooms, timed modes end on time, Second Chance revives
   and a session survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/levels.js', 'js/core/data-worlds.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js', 'js/systems/boss.js', 'js/systems/run.js']);
const { check, done } = H;
const E = NS.engine, R = NS.run, P = NS.progress, W = NS.worldData, C = NS.constants, L = NS.levels;
const { TILE } = C;

function steps(g, s, inp) { for (let i = 0; i < s * 120; ++i) E.step(g, 1 / 120, inp || {}); }

/* levels */
const bad = [];
for (const st of W.STAGES) {
  if (st.kind === 'boss') continue;
  const lv = W.levelOf(st);
  const seen = L.reachable(lv);
  if (!lv.enemies.length || !lv.enemies.every(e => seen[e.x + ',' + e.y])) bad.push(st.id);
}
check('every story room is reachable from the start', bad.length === 0, bad.join(' '));
check('rooms are seeded and mirrored', W.levelOf(W.STAGES[3]).map.join() === W.levelOf(W.STAGES[3]).map.join() && W.levelOf(W.STAGES[3]).map.every(r => r.slice(1, -1) === r.slice(1, -1).split('').reverse().join('')));

/* movement */
const empty = { map: L.blank().map(r => r.join('')), spawn: { x: 2, y: 18 }, enemies: [], wind: 'center' };
empty.map[16] = '#' + '.'.repeat(4) + '#'.repeat(14) + '.'.repeat(4) + '#';
let g = E.create({ seed: 1, level: empty });
g.elementT = 999;
steps(g, 0.2);
check('the player stands on the floor', g.player.ground && Math.abs(g.player.y - 19 * TILE) < 1);
steps(g, 0.5, { right: true });
check('and runs', g.player.x > 3 * TILE);
g.player.x = 10 * TILE;
steps(g, 0.02, { jump: true });
steps(g, 0.6);
check('jumps up through a platform and lands on it', g.player.ground && Math.abs(g.player.y - 16 * TILE) < 1);
g.player.x = 12 * TILE;
g.player.y = 19 * TILE - 1;
g.map[19] = '#'.repeat(10) + '....' + '#'.repeat(10);
g.player.x = 11.5 * TILE;
steps(g, 0.6);
check('falling through the floor gap comes back from the top', g.player.y < 19 * TILE && g.player.y > 0);

/* bubbles and trapping */
function room(enemies) {
  const lv = { map: L.blank().map(r => r.join('')), spawn: { x: 2, y: 18 }, enemies: enemies, wind: 'center' };
  const gg = E.create({ seed: 3, level: lv, lives: 5 });
  gg.elementT = 999;
  return gg;
}
g = room([{ type: 'walker', x: 5, y: 18 }]);
g.enemies[0].dir = -1;
g.player.face = 1;
E.shoot(g);
steps(g, 0.3);
check('a flying bubble traps an enemy', g.enemies.length === 0 && g.bubbles.length === 1 && g.bubbles[0].trap);
const tb = g.bubbles[0];
steps(g, 6);
check('trapped bubbles float up to the ceiling', tb.y < 3 * TILE);
g = room([{ type: 'brute', x: 5, y: 18 }]);
g.player.face = 1;
E.shoot(g); steps(g, 0.3);
check('a brute takes two bubbles', g.enemies.length === 1 && g.enemies[0].hp === 1);
g.player.shotT = 0;
E.shoot(g); steps(g, 0.3);
check('the second traps it', g.enemies.length === 0 && g.bubbles.some(b => b.trap));
g = room([]);
for (let i = 0; i < 3; ++i) g.bubbles.push({ x: 300 + i * 28, y: 200, vx: 0, vy: 0, r: 15, phase: 'float', dist: 0, range: 0, life: 99, trap: { type: 'walker', t: 9 }, elem: null, t: 1, wob: 0 });
const s0 = g.score;
const n = E.popChain(g, g.bubbles[0]);
check('touching bubbles pop as a chain', n === 3 && g.bubbles.length === 0);
check('each enemy in a chain is worth double the last', g.score - s0 === 1000 + 2000 + 4000);
check('popped enemies drop fruit', g.items.filter(i => i.kind === 'fruit').length === 3);
g = room([]);
g.bubbles.push({ x: 200, y: 500, vx: 0, vy: 0, r: 15, phase: 'float', dist: 0, range: 0, life: 99, trap: { type: 'walker', t: 0.05 }, elem: null, t: 1, wob: 0 });
steps(g, 0.1);
check('a trapped enemy breaks out angry', g.enemies.length === 1 && g.enemies[0].angry);
g = room([]);
g.bubbles.push({ x: g.player.x, y: g.player.y - 60, vx: 0, vy: 0, r: 15, phase: 'float', dist: 0, range: 0, life: 99, trap: null, elem: null, t: 1, wob: 0 });
g.bubbles[0].y = 400; g.player.y = 388; g.player.vy = 200; g.player.ground = false;
g.player.x = g.bubbles[0].x;
steps(g, 0.05, { jump: true });
check('landing on a bubble with jump held bounces', g.player.vy < 0 && g.stats.bounces === 1);
g = room([{ type: 'walker', x: 20, y: 18 }]);
g.time = C.ANGRY_AT + 0.01;
steps(g, 0.02);
check('enemies get angry after 40 s', g.angry);
g.time = C.SHADE_AT + 0.01;
steps(g, 0.02);
check('and a shade hunts the player after 55 s', !!g.shade);

/* elements and stars */
g = room([{ type: 'walker', x: 17, y: 18 }]);
g.player.face = 1;
g.player.x = 3 * TILE;
E.element(g, { elem: 'bolt', x: 3 * TILE, y: 19 * TILE - 12 });
steps(g, 1);
check('a lightning bolt strikes enemies in a line', g.enemies.length === 0);
g = room([{ type: 'walker', x: 6, y: 18 }]);
g.player.face = 1;
E.element(g, { elem: 'water', x: 3 * TILE, y: 18 * TILE });
steps(g, 2);
check('a flood washes enemies away', g.enemies.length === 0);
g = room([]);
const lives = g.lives;
for (let i = 0; i < 5; ++i) E.element(g, { elem: 'star', x: 0, y: 0 });
check('five stars give a life', g.lives === lives + 1 && g.stars === 0);

/* candy */
g = room([{ type: 'walker', x: 12, y: 18 }]);
E.applyPower(g, 'freeze');
const ex = g.enemies[0].x;
steps(g, 1);
check('Frost Pop freezes every enemy', g.enemies[0].x === ex);
g.bubbles.push({ x: 300, y: 100, vx: 0, vy: 0, r: 15, phase: 'float', dist: 0, range: 0, life: 99, trap: { type: 'walker', t: 9 }, elem: null, t: 1, wob: 0 });
g.bubbles.push({ x: 500, y: 100, vx: 0, vy: 0, r: 15, phase: 'float', dist: 0, range: 0, life: 99, trap: { type: 'walker', t: 9 }, elem: null, t: 1, wob: 0 });
E.applyPower(g, 'bomb');
check('Pop Bomb pops every trapped enemy', !g.bubbles.some(b => b.trap));
E.applyPower(g, 'shield');
g.player.inv = 0;
E.hurt(g, 'test');
check('a shield takes one hit', !g.player.dead && !g.player.shield);

/* lives */
g = room([]);
g.lives = 0;
g.player.inv = 0;
E.hurt(g, 'test');
steps(g, 2);
check('losing the last life ends the game', g.over);

/* story with the bot */
const profile = P.newProfile();
const fails = [];
for (const st of W.STAGES) {
  const run = R.build('story', { stage: st.id, seed: 100 + st.index }, profile);
  run.game.lives = 99;
  const mem = {};
  let t = 0;
  while (!run.done && t < 400) { R.tick(run, 1 / 60, NS.bot.input(run.game, mem), profile); R.takeEvents(run); t += 1 / 60; }
  if (!run.won) fails.push(st.id + ':' + run.reason);
}
check('the bot clears every story room and beats every guardian', fails.length === 0, fails.join(' '));

let run = R.build('story', { stage: 'candy-1', seed: 5 }, profile);
const mem = {};
while (!run.done) { R.tick(run, 1 / 60, NS.bot.input(run.game, mem), profile); R.takeEvents(run); }
const stars = R.starsFor(run);
check('a won room gives stars by par and bonus', stars[0] && stars[1] === run.t <= 40 && stars[2] === (run.game.stats.deaths === 0));
check('recording opens the next room', P.recordStage(profile, 'candy-1', stars, run.t).first && P.stageOpen(profile, 1));

/* guardian */
run = R.build('story', { stage: 'toys-6', seed: 3 }, profile);
const bs = run.game.boss;
bs.shootT = 0.001;
R.tick(run, 0.02, {}, profile);
check('a guardian throws a fan of shots', run.game.shots.filter(s => s.boss).length === 3);
NS.boss.damage(run.game, bs.max / 2 + 1);
check('it rages at half health', bs.rage);
run.game.bolts.push({ x: bs.x - 10, y: bs.y, vx: 100, t: 0 });
const hp = bs.hp;
R.tick(run, 0.02, {}, profile);
check('lightning bolts hurt it hard', hp - bs.hp >= 4);
NS.boss.damage(run.game, 999);
R.tick(run, 0.02, {}, profile);
check('it pops and the room is won', run.done && run.won);

/* modes */
run = R.build('arcade', { seed: 9 }, profile);
R.tick(run, 0.01, {}, profile);
run.game.enemies.length = 0;
for (let i = 0; i < 300 && run.room === 1; ++i) R.tick(run, 0.02, {}, profile);
check('Arcade builds the next room', run.room === 2 && run.game.enemies.length > 0);
run = R.build('blitz', { seed: 9 }, profile);
const bm = {};
while (!run.done) { R.tick(run, 0.05, NS.bot.input(run.game, bm), profile); R.takeEvents(run); }
check('Blitz ends after three minutes with a score', run.reason === 'time' && run.won && run.game.score > 0);
const d1 = R.build('daily', { date: new Date(2026, 10, 8) }, profile), d2 = R.build('daily', { date: new Date(2026, 10, 8) }, profile);
check('the Daily Challenge is the same for everyone today', d1.seed === d2.seed && JSON.stringify(d1.game.map) === JSON.stringify(d2.game.map) && d1.mutators.length === 2);
run = R.build('zen', { seed: 9 }, profile);
run.game.player.x = run.game.enemies[0].x; run.game.player.y = run.game.enemies[0].y;
R.tick(run, 0.1, {}, profile);
check('nothing hurts in Zen', !run.game.player.dead);
run = R.build('rush', { seed: 9 }, profile);
for (let k = 0; k < 5; ++k) { NS.boss.damage(run.game, 999); R.tick(run, 0.02, {}, profile); }
check('Boss Rush chains all five guardians', run.done && run.won && run.rushIndex === 4);

profile.tree.revive = 1;
run = R.build('arcade', { seed: 9 }, profile);
run.game.lives = 0;
run.game.player.inv = 0;
E.hurt(run.game, 't');
for (let i = 0; i < 100; ++i) R.tick(run, 0.02, {}, profile);
check('Second Chance brings the last life back once', !run.done && run.revives === 0);

run = R.build('story', { stage: 'castle-6', seed: 3 }, profile);
const m2 = {};
for (let i = 0; i < 120; ++i) R.tick(run, 1 / 30, NS.bot.input(run.game, m2), profile);
const copy = JSON.parse(JSON.stringify(run));
for (let i = 0; i < 60; ++i) R.tick(copy, 1 / 30, NS.bot.input(copy.game, m2), profile);
check('a session survives JSON and plays on', copy.t > run.t);
done();
