'use strict';

/* Co-op: Pop joins on the right of the room; he blows his own bubbles and his traps and pops are
   counted for him; enemies, enemy shots and guardians hurt either newt; when Pop is hit he floats
   back after a few seconds without costing a life, while Fizz still spends lives; power-ups go to
   whoever grabs them; the bot steers Pop and the pair clears every story room and beats every
   guardian; Pop does real work in a room; co-op carries over to the next room, stays safe in Zen
   and survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/levels.js', 'js/core/data-worlds.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js', 'js/systems/boss.js', 'js/systems/run.js']);
const { check, done } = H;
const E = NS.engine, R = NS.run, P = NS.progress, W = NS.worldData, C = NS.constants, L = NS.levels;
const { TILE, FIELD_W } = C;
const profile = P.newProfile();

const empty = { map: L.blank().map(r => r.join('')), spawn: { x: 2, y: 18 }, enemies: [], wind: 'center' };
function steps(g, s, inp) { const evs = []; for (let i = 0; i < s * 120; ++i) { E.step(g, 1 / 120, inp || {}); evs.push.apply(evs, E.takeEvents(g)); } return evs; }

let g = E.create({ seed: 1, level: empty, coop: true });
check('Pop joins on the mirrored spawn, facing left', g.buddy && g.buddy.id === 1 && Math.abs(g.buddy.x - (FIELD_W - g.player.x)) < 1e-9 && g.buddy.face === -1);
check('without co-op there is no Pop', !E.create({ seed: 1, level: empty }).buddy && E.newts(E.create({ seed: 1, level: empty })).length === 1);
g.enemies.push(E.newEnemy(g, 'walker', g.buddy.x - 70, g.buddy.y));
g.enemies[0].dir = 1;
g.buddy.inv = 0;
let evs = steps(g, 0.05, { buddy: { shoot: true } });
check('Pop blows his own bubbles', g.bubbles.length >= 1 && g.bubbles[0].owner === 1 && evs.some(e => e.type === 'blow' && e.who === 1));
evs = evs.concat(steps(g, 0.6, {}));
check('his trap is counted for him', g.buddy.trapped === 1 && g.player.trapped === 0 && evs.some(e => e.type === 'trap' && e.who === 1));
const b = g.bubbles.find(x => x.trap);
g.buddy.x = b.x; g.buddy.y = b.y + 20; g.buddy.vy = 0; g.buddy.jumpHeld = false;
evs = steps(g, 0.05, {});
check('and so is his pop, with the points for the team', g.buddy.popped === 1 && evs.some(e => e.type === 'pop' && e.who === 1) && g.score >= 1000);

/* getting hit */
g = E.create({ seed: 2, level: empty, coop: true, lives: 2 });
/* a frozen enemy far away keeps the room from counting as cleared */
g.enemies.push(E.newEnemy(g, 'walker', FIELD_W / 2, TILE * 2));
g.freezeT = 99;
g.buddy.inv = 0;
E.hurt(g, 'enemy', g.buddy);
check('an enemy can hit Pop', g.buddy.dead > 0 && g.stats.deaths === 0);
steps(g, C.BUDDY_BACK + 0.2, {});
check('he floats back after a few seconds without costing a life', !g.buddy.dead && g.lives === 2 && g.buddy.inv > 0);
g.player.inv = 0;
E.hurt(g, 'enemy');
steps(g, 1.6, {});
check('Fizz still spends lives', g.lives === 1 && g.stats.deaths === 1);
g = E.create({ seed: 3, level: empty, coop: true });
g.buddy.inv = 0;
g.shots.push({ x: g.buddy.x - 30, y: g.buddy.y - 12, vx: 230, t: 0 });
steps(g, 0.3, {});
check('enemy shots hit Pop too', g.buddy.dead > 0);
g = E.create({ seed: 4, level: empty, coop: true });
g.buddy.inv = 0;
g.enemies.push(E.newEnemy(g, 'ghost', g.buddy.x, g.buddy.y - 60));
check('enemies chase the nearer newt', E.nearest(g, g.buddy.x, g.buddy.y - 60) === g.buddy);
steps(g, 2, {});
check('and hurt him when they reach him', g.buddy.dead > 0 || g.buddy.inv > 0 && g.buddy.inv < C.INVULN);
g = E.create({ seed: 5, level: empty, coop: true });
g.items.push({ x: g.buddy.x, y: g.buddy.y - 10, vx: 0, vy: 0, kind: 'rapid', value: 0, t: 1, ground: true });
steps(g, 0.1, {});
check('a power-up goes to whoever grabs it', g.buddy.rapid && !g.player.rapid);
g = E.create({ seed: 6, level: W.levelOf({ kind: 'boss' }), coop: true });
NS.boss.attach(g, 0, 1, 1);
g.buddy.inv = 0;
g.buddy.x = g.boss.x; g.buddy.y = g.boss.y + 12;
NS.boss.step(g, 1 / 120);
check('touching a guardian hurts Pop as well', g.buddy.dead > 0);

/* the pair clears the story */
const fails = [];
let popWork = 0;
for (const st of W.STAGES) {
  const run = R.build('story', { stage: st.id, seed: 300 + st.index, coop: true }, profile);
  run.game.lives = 99;
  const mem = {};
  let t = 0;
  while (!run.done && t < 400) { R.tick(run, 1 / 60, NS.bot.input(run.game, mem), profile); R.takeEvents(run); t += 1 / 60; }
  if (!run.won) fails.push(st.id + ':' + run.reason);
  if (run.game.buddy.trapped + run.game.buddy.popped > 0) ++popWork;
}
check('Fizz and Pop clear every story room and beat every guardian', fails.length === 0, fails.join(' '));
check('Pop traps or pops in most rooms', popWork >= 20, popWork);

/* rooms, Zen, saving */
const arc = R.build('arcade', { seed: 8, coop: true }, profile);
arc.game.buddy.trapped = 4;
R.nextRoom(arc);
check('co-op carries over to the next room with Pop back on his spawn', arc.game.buddy && arc.game.buddy.trapped === 4 && Math.abs(arc.game.buddy.x - (FIELD_W - arc.game.spawn.x)) < 1e-9);
const zen = R.build('zen', { seed: 9, coop: true }, profile);
R.nextRoom(zen);
check('both newts stay safe in Zen', zen.game.player.inv > 1e8 && zen.game.buddy.inv > 1e8);
const s1 = R.build('arcade', { seed: 10, coop: true }, profile);
const m1 = {};
for (let i = 0; i < 300; ++i) { R.tick(s1, 1 / 60, NS.bot.input(s1.game, m1), profile); R.takeEvents(s1); }
const copy = JSON.parse(JSON.stringify(s1));
const m2 = JSON.parse(JSON.stringify(m1));
for (let i = 0; i < 300; ++i) { R.tick(s1, 1 / 60, NS.bot.input(s1.game, m1), profile); R.takeEvents(s1); R.tick(copy, 1 / 60, NS.bot.input(copy.game, m2), profile); R.takeEvents(copy); }
check('a co-op session survives JSON and plays on the same', s1.game.buddy.x === copy.game.buddy.x && s1.game.score === copy.game.score && s1.coop && copy.game.buddy);
done();
