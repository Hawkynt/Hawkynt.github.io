'use strict';

/* Art and frame budgets with the counting fake canvas: every sprite paints without errors in
   every skin and season, sprites are cached (a second frame paints nothing new), a busy arena
   (many bombs, a full screen of fire, enemies, particles, darkness) stays within a draw-call
   budget, no frame ever uses shadowBlur, and the particle pool never grows. */
const H = require('./harness');
const env = H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const C = NS.constants;
const K = NS.artKit;

env.frames(5);
let threw = null;
try {
  for (let w = 0; w < 5; ++w) NS.tileArt.warm(w);
  NS.itemArt.warm();
  for (const s of NS.meta.SKINS) for (let d = 0; d < 4; ++d) for (let f = 0; f < 4; ++f) NS.actorArt.bomber(s.id, d, f);
  for (const e of NS.content.ENEMIES) for (let f = 0; f < 4; ++f) NS.actorArt.enemy(e.id, f, f & 1);
  for (const b of NS.content.BOSS_ORDER) { NS.bossArt.sprite(b, 0); NS.bossArt.sprite(b, 1); }
  for (const se of NS.meta.SEASONS) { for (let v = 0; v < 4; ++v) NS.tileArt.decor(se.id, v); NS.itemArt.token(se.id); }
  for (let i = 0; i < 7; ++i) NS.backdrop.warm(i);
  for (const name in NS.icons.PAINT) NS.icons.get(name, '#ff8800', 48);
} catch (e) { threw = e; console.log(e.stack); }
check('every sprite paints', !threw, threw && threw.message);
check('the sprite cache stays within its budget', K.cache.size < 2600, K.cache.size);

/* a busy arena */
G.save.seen.intro = true;
for (let w = 0; w < 5; ++w) { G.save.seen.chapters[w] = true; G.save.seen.bosses[w] = true; }
NS.run.newRun('story', { world: 4, level: 2 });
env.frames(120);
const run = G.run;
run.player.bombs = 9; run.player.fire = 8;
for (let r = 1; r < C.ROWS - 1; r += 2)
  for (let c = 1; c < C.COLS - 1; c += 4) {
    const i = r * C.COLS + c;
    if (NS.levelgen.isFloor(run.level.grid[i]) && !NS.arena.bombAtCell(c, r)) NS.bombs.placeEnemy(c, r, 4, 0.05 + c * 0.01);
  }
for (let k = 0; k < 10; ++k) NS.enemies.spawn('wisp', 3 + k, 5, { instant: true });
NS.arena.rebuild();
env.frames(8);
const ctx = env.gameCanvas.ctx;
const built = K.stats.built;
const calls0 = ctx.calls, img0 = ctx.images, grad0 = ctx.gradients;
env.frames(1);
const calls = ctx.calls - calls0, imgs = ctx.images - img0, grads = ctx.gradients - grad0;
console.log('busy dark frame: ' + calls + ' canvas calls, ' + imgs + ' drawImage, ' + grads + ' gradients, ' + G.fx.live + ' live particles, fire cells ' + run.fire.filter(f => f > 0).length);
check('a busy frame stays under 6000 canvas calls', calls < 6000, calls);
check('a busy frame stays under 1500 drawImage calls', imgs < 1500, imgs);
check('a busy frame builds few gradients (UI only)', grads < 60, grads);
env.frames(30);
check('steady frames paint no new sprites', K.stats.built - built < 12, K.stats.built - built);
check('the particle pool never grows', G.fx.parts.length === NS.fx.POOL);

/* timing of the simulation and frame in node (no real raster cost, JS only) */
const now = () => Number(process.hrtime.bigint()) / 1e6;
let t0 = now();
for (let i = 0; i < 600; ++i) NS.sim.update(C.STEP);
const simMs = (now() - t0) / 600;
t0 = now();
for (let i = 0; i < 120; ++i) NS.frame.draw();
const drawMs = (now() - t0) / 120;
console.log('node timing: sim ' + simMs.toFixed(3) + ' ms/step, frame build ' + drawMs.toFixed(3) + ' ms');
check('a simulation step costs under 2 ms', simMs < 2, simMs);

/* every screen */
for (const s of ['title', 'map', 'tree', 'wardrobe', 'goals', 'stats', 'help']) {
  if (s === 'title' || s === 'map') NS.screens.setScreen(s); else NS.screens.open(s, 'title');
  const c0 = ctx.calls;
  env.frames(1);
  check('screen ' + s + ' draws under 4000 calls', ctx.calls - c0 < 4000, ctx.calls - c0);
}
check('nothing ever used shadowBlur', ctx.shadowBlurUsed === 0);
done();
