'use strict';

/* Team play: an edge guarded by a CPU partner stops being a wall and loses a ball that gets
   past; a mate bounces a ball back at an angle set by where it lands; mates move no faster than
   their top speed; a team field centres its bricks and the team modes trim them to twelve
   columns; the mate steering predicts where a ball crosses its face; Duo and Arena sessions are
   built with their partners, the partners keep balls in play and walls get cleared together, the
   session ends as a score run when the team runs out of balls, and it survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/run.js']);
const { check, done } = H;
const C = NS.constants, E = NS.engine, R = NS.run, B = NS.bot, P = NS.progress;
const profile = P.newProfile();
/* one titan brick out of the way: an empty field would count as cleared */
const CORNER = ['t.............'];

function free(g, x, y, vx, vy) {
  g.balls.length = 0;
  g.balls.push({ x: x, y: y, vx: vx, vy: vy, stuck: false, off: 0, held: 0 });
  return g.balls[0];
}
function run(g, sec, inp) { const evs = []; for (let t = 0; t < sec; t += C.STEP) { E.step(g, C.STEP, inp || {}); evs.push.apply(evs, E.takeEvents(g)); } return evs; }

/* the top edge */
let g = E.create({ seed: 1, layout: CORNER, sides: ['top'] });
check('a guarded edge is open and has a mate', g.open.top && !g.open.left && g.mates.length === 1 && g.mates[0].side === 'top');
free(g, 100, 300, 0, -400);
g.mates[0].pos = 500;
let evs = run(g, 1.2, { mates: [500] });
check('a ball that gets past the top mate is lost', evs.some(e => e.type === 'lost') && evs.some(e => e.type === 'life'));
g = E.create({ seed: 1, layout: CORNER, sides: ['top'] });
free(g, 350, 300, 0, -400);
evs = run(g, 0.8, { mates: [350] });
check('the top mate bounces it back down', evs.some(e => e.type === 'mate' && e.side === 'top') && g.balls[0].vy > 0 && g.mates[0].hits === 1);
g = E.create({ seed: 1, layout: CORNER, sides: ['top'] });
free(g, 390, 300, 0, -400);
run(g, 0.8, { mates: [350] });
check('a ball landing right of centre leaves to the right', g.balls[0].vx > 0);
g = E.create({ seed: 1, layout: CORNER });
free(g, 350, 300, 0, -400);
evs = run(g, 1.2);
check('without a mate the top is still a wall', !evs.some(e => e.type === 'lost') && evs.some(e => e.type === 'wall'));

/* the sides */
g = E.create({ seed: 1, layout: CORNER, sides: ['top', 'left', 'right'] });
free(g, 300, 300, -400, 30);
g.mates[1].pos = 360; g.mates[2].pos = 360;
evs = run(g, 0.9, { mates: [350, 360, 360] });
check('the left mate sends a ball back to the right', evs.some(e => e.type === 'mate' && e.side === 'left') && g.balls[0].vx > 0);
free(g, 400, 300, 400, 30);
evs = run(g, 0.9, { mates: [350, 360, 360] });
check('the right mate sends it back to the left', evs.some(e => e.type === 'mate' && e.side === 'right') && g.balls[0].vx < 0);
free(g, 300, 100, -400, 10);
evs = run(g, 0.9, { mates: [350, 600, 300] });
check('a ball past a side mate is lost', evs.some(e => e.type === 'lost'));

/* speed */
g = E.create({ seed: 1, layout: CORNER, sides: ['top'] });
const p0 = g.mates[0].pos;
E.step(g, 0.1, { mates: [p0 + 500] });
check('mates move no faster than their top speed', Math.abs(g.mates[0].pos - p0 - C.MATE_SPEED * 0.1) < 1e-6);
E.step(g, 1, { mates: [-500] });
check('and stay on their edge', g.mates[0].pos === g.mates[0].w / 2);

/* layout */
const wall = R.generateWall(5, 3);
g = E.create({ seed: 1, layout: wall, sides: ['top'], center: true });
const ys = g.bricks.map(b => b.y);
const mid = (Math.min.apply(null, ys) + Math.max.apply(null, ys) + C.BRICK_H) / 2;
check('a team field centres its bricks', Math.abs(mid - g.h * 0.47) <= C.BRICK_H && Math.min.apply(null, ys) > C.MATE_TOP + 60);
g = E.create({ seed: 1, layout: wall, sides: ['top', 'left', 'right'], center: true, cols: 12 });
check('the arena trims the wall to twelve columns with room behind the side mates', g.bricks.every(b => b.x >= 50 && b.x + b.w <= g.w - 50));

/* steering */
g = E.create({ seed: 1, layout: CORNER, sides: ['top', 'left', 'right'] });
free(g, 350, 400, 120, -400);
const tx = B.mateTarget(g, g.mates[0]);
const expect = 350 + 120 * (400 - C.MATE_TOP - C.BALL_R) / 400;
check('the top mate goes where the ball will cross its face', Math.abs(tx - expect) < g.mates[0].w / 2);
free(g, 350, 300, -400, 80);
const ty = B.mateTarget(g, g.mates[1]);
check('the left mate too', Math.abs(ty - (300 + 80 * (350 - C.MATE_SIDE - C.BALL_R) / 400)) < g.mates[1].w / 2);

/* sessions */
function team(mode, seed, secs) {
  const r = R.build(mode, { seed: seed }, profile);
  for (let t = 0; t < secs && !r.done; t += 1 / 60) {
    R.tick(r, 1 / 60, B.input(r.game), profile);
    R.takeEvents(r);
  }
  return r;
}
const duo = R.build('duo', { seed: 3 }, profile);
check('Duo is built with a partner on top and centred bricks', duo.game.mates.length === 1 && duo.game.open.top && duo.game.center && duo.kind === 'duo');
const arena = R.build('arena', { seed: 3 }, profile);
check('Arena is built with partners on three edges', arena.game.mates.map(m => m.side).join() === 'top,left,right' && arena.game.cols === 12);
check('the objective is a team one', /together/.test(R.objective(duo).text));
let walls = 0, hits = 0, all3 = 0;
for (let k = 0; k < 3; ++k) {
  const a = team('duo', 70 + k, 150);
  walls = Math.max(walls, a.wall);
  hits += a.game.mates[0].hits;
  const b = team('arena', 90 + k, 150);
  walls = Math.max(walls, b.wall);
  if (b.game.mates.every(m => m.hits > 0)) ++all3;
}
check('the partner keeps returning balls in Duo', hits >= 30, hits);
check('in Arena every partner plays its part', all3 >= 2, all3);
check('teams clear walls together', walls >= 2, walls);
const end = R.build('duo', { seed: 9 }, profile);
end.game.lives = 0;
for (let t = 0; t < 120 && !end.done; t += 1 / 60) { R.tick(end, 1 / 60, { px: 0, launch: true }, profile); R.takeEvents(end); }
check('the run ends as a score run when the team is out of balls', end.done && end.won && end.reason === 'out');
const s1 = team('arena', 5, 4);
const copy = JSON.parse(JSON.stringify(s1));
for (let t = 0; t < 5; t += 1 / 60) { R.tick(s1, 1 / 60, B.input(s1.game), profile); R.takeEvents(s1); R.tick(copy, 1 / 60, B.input(copy.game), profile); R.takeEvents(copy); }
check('a team session survives JSON and plays on the same', s1.game.score === copy.game.score && s1.game.mates[2].pos === copy.game.mates[2].pos);
done();
