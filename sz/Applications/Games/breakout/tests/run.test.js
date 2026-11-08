'use strict';

/* Engine and sessions: bricks of every kind behave (steel and titan take hits, glass and fire
   let the ball through, bombs chain, regrowing bricks return, walls never break, gold and
   crystals), the paddle sends the ball by where it lands, power-ups do what they say, the
   barrier saves a ball, losing every ball costs a life, the bot finishes every story stage and
   beats every guardian, stars follow par and bonus goals, guardians shoot, rage and fall, the
   endless modes build new walls, timed modes end on time, Second Chance revives, a session
   survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/run.js']);
const { check, done } = H;
const E = NS.engine, R = NS.run, P = NS.progress, W = NS.worldData, C = NS.constants;

function steps(g, s, inp) { for (let i = 0; i < s * 240; ++i) E.step(g, 1 / 240, inp || {}); }
function ballAt(g, x, y, vx, vy) { g.balls = [{ x: x, y: y, vx: vx, vy: vy, stuck: false, off: 0, held: 0 }]; }

/* bricks */
let g = E.create({ seed: 1, layout: ['s'], drops: 0 });
const br = g.bricks[0];
ballAt(g, br.x + 25, br.y + 60, 0, -400);
steps(g, 0.15);
check('steel takes two hits', br.alive && br.hp === 1 && g.balls[0].vy > 0);
g = E.create({ seed: 1, layout: ['g'], drops: 0 });
ballAt(g, g.bricks[0].x + 25, g.bricks[0].y + 60, 0, -400);
steps(g, 0.2);
check('glass shatters and the ball flies through', !g.bricks[0].alive && g.balls[0].vy < 0);
g = E.create({ seed: 1, layout: ['1b1', '111'], drops: 0 });
g.bricks[1].hp = 1;
E.hitBrick(g, g.bricks[1], 1);
check('a bomb breaks its neighbours', g.bricks.filter(b => b.alive).length === 0 && E.takeEvents(g).some(e => e.type === 'bomb'));
g = E.create({ seed: 1, layout: ['#'], drops: 0 });
E.hitBrick(g, g.bricks[0], 9);
check('walls never break', g.bricks[0].alive);
g = E.create({ seed: 1, layout: ['r1'], drops: 0 });
E.hitBrick(g, g.bricks[0], 1);
g.balls = [];
g.lives = 5;
steps(g, C.REGEN_TIME + 0.2, {});
check('regrowing bricks come back', g.bricks[0].alive);
check('regrowing bricks do not block the clear', E.remaining(g) === 1);
g = E.create({ seed: 1, layout: ['c'] });
E.hitBrick(g, g.bricks[0], 1);
check('crystals always drop a power-up', g.drops.length === 1 && C.POWER_BY_ID[g.drops[0].type].good);
g = E.create({ seed: 1, layout: ['t'], drops: 0 });
g.fireT = 5;
ballAt(g, g.bricks[0].x + 25, g.bricks[0].y + 60, 0, -400);
steps(g, 0.15);
check('titan stops even a fire ball', g.bricks[0].alive && g.balls[0].vy > 0);

/* paddle and powers */
g = E.create({ seed: 1, layout: ['1'], drops: 0 });
ballAt(g, g.paddle.x + g.paddle.w * 0.4, C.PADDLE_Y - 30, 0, 400);
steps(g, 0.1);
check('the paddle edge sends the ball sideways', g.balls[0].vy < 0 && g.balls[0].vx > 150);
E.applyPower(g, 'wide');
steps(g, 1);
check('Wide widens the paddle', g.paddle.w > g.paddle.baseW * 1.4);
E.applyPower(g, 'multi');
check('Multi splits every ball into three', g.balls.length === 3);
E.applyPower(g, 'barrier');
ballAt(g, 30, C.FIELD_H - 5, 0, 500);
g.paddle.x = 600;
steps(g, 0.1);
check('a barrier saves a ball', g.balls.length === 1 && g.barrier === 0 && g.balls[0].vy < 0);
const lives = g.lives;
ballAt(g, 30, C.FIELD_H - 5, 0, 500);
steps(g, 0.1);
check('losing the last ball costs a life and puts a new one on the paddle', g.lives === lives - 1 && g.balls.length === 1 && g.balls[0].stuck);
E.applyPower(g, 'laser');
steps(g, 0.05, { fire: true });
check('Laser fires twin shots', g.lasers.length === 2);
E.applyPower(g, 'magnet');
E.launch(g);
ballAt(g, g.paddle.x, C.PADDLE_Y - 30, 0, 400);
steps(g, 0.1);
check('Magnet catches the ball', g.balls[0].stuck);

/* story with the bot */
const profile = P.newProfile();
const fails = [];
for (const st of W.STAGES) {
  const run = R.build('story', { stage: st.id, seed: 100 + st.index * 13 + st.world * 7 }, profile);
  run.game.lives = 50;
  let t = 0;
  while (!run.done && t < 1200) {
    R.tick(run, 1 / 30, NS.bot.input(run.game), profile);
    R.takeEvents(run);
    t += 1 / 30;
  }
  if (!run.won) fails.push(st.id + ':' + run.reason);
}
check('the bot finishes every story stage and beats every guardian', fails.length === 0, fails.join(' '));

/* stars */
let run = R.build('story', { stage: 'neon-1', seed: 5 }, profile);
while (!run.done) { R.tick(run, 1 / 30, NS.bot.input(run.game), profile); R.takeEvents(run); }
const stars = R.starsFor(run);
check('a won stage gives the first star, par the second, the bonus the third', stars[0] && stars[1] === run.t <= 60 && stars[2] === (run.game.stats.lost === 0));
const rec = P.recordStage(profile, 'neon-1', stars, run.t);
check('recording opens the next stage', rec.first && P.stageOpen(profile, 1));

/* guardians */
run = R.build('story', { stage: 'foundry-6', seed: 3 }, profile);
const bs = run.game.boss;
check('a guardian has a shield ring', run.game.bricks.filter(b => b.shield).length === W.BOSSES[2].ring);
bs.shootT = 0.01;
R.tick(run, 0.05, {}, profile);
check('it shoots at the paddle (three bolts for the Gear Tyrant)', run.game.projectiles.length === 3);
run.game.projectiles = [{ x: run.game.paddle.x, y: C.PADDLE_Y - 2, vx: 0, vy: 200, kind: 'bolt' }];
R.tick(run, 0.05, {}, profile);
check('a shot stuns the paddle', run.game.paddle.stunT > 0 && run.game.stats.hitsTaken === 1);
NS.boss.damage(run.game, bs.max / 2 + 1);
check('at half health it rages', bs.rage);
NS.boss.damage(run.game, bs.max);
R.tick(run, 0.05, {}, profile);
check('it falls and the stage is won', run.done && run.won);

/* endless and timed modes */
run = R.build('arcade', { seed: 9 }, profile);
const firstWall = JSON.stringify(run.game.bricks.map(b => b.ch));
R.tick(run, 0.01, {}, profile);
for (const b of run.game.bricks) b.alive = false;
R.tick(run, 0.05, {}, profile);
check('Arcade builds the next wall', run.wall === 2 && run.game.bricks.some(b => b.alive) && R.takeEvents(run).some(e => e.type === 'wall'));
check('walls are symmetric and seeded', R.generateWall(4, 3).every(r => r === r.split('').reverse().join('')) && R.generateWall(4, 3).join() === R.generateWall(4, 3).join());
run = R.build('blitz', { seed: 9 }, profile);
while (!run.done) { R.tick(run, 0.1, NS.bot.input(run.game), profile); R.takeEvents(run); }
check('Blitz ends after two minutes with a score', run.reason === 'time' && run.won && run.game.score > 0 && Math.abs(run.t - 120) < 0.1);
const d1 = R.build('daily', { date: new Date(2026, 10, 8) }, profile), d2 = R.build('daily', { date: new Date(2026, 10, 8) }, profile);
check('the Daily Challenge is the same wall for everyone today', d1.seed === d2.seed && JSON.stringify(d1.game.bricks) === JSON.stringify(d2.game.bricks) && d1.mutators.length === 2);
run = R.build('rush', { seed: 9 }, profile);
for (let k = 0; k < 5; ++k) { NS.boss.damage(run.game, 999); R.tick(run, 0.02, {}, profile); }
check('Boss Rush chains all five guardians', run.done && run.won && run.rushIndex === 4);
run = R.build('arcade', { seed: 9, mutators: ['tiny', 'fast'] }, profile);
check('mutators change the paddle and the ball', run.game.paddle.baseW < C.PADDLE_W && E.speed(run.game) > C.BALL_SPEED);

/* revive */
profile.tree.revive = 1;
run = R.build('arcade', { seed: 9 }, profile);
run.game.lives = 0;
run.game.balls = [];
R.tick(run, 0.02, {}, profile);
check('Second Chance brings the last ball back once', !run.done && run.revives === 0 && R.takeEvents(run).some(e => e.type === 'revive'));
run.game.balls = [];
R.tick(run, 0.02, {}, profile);
check('then the game ends', run.done && run.reason === 'out');

/* JSON */
run = R.build('story', { stage: 'gloom-6', seed: 3 }, profile);
for (let i = 0; i < 60; ++i) R.tick(run, 1 / 30, NS.bot.input(run.game), profile);
const copy = JSON.parse(JSON.stringify(run));
for (let i = 0; i < 60; ++i) R.tick(copy, 1 / 30, NS.bot.input(copy.game), profile);
check('a session survives JSON and plays on', copy.t > run.t && copy.game.boss.hp <= run.game.boss.hp);
done();
