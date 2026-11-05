'use strict';

/* Procedural art with a recording fake canvas: every sprite paints once and is cached, blits cost
   one draw call, painting stays within budget, no shadowBlur anywhere; and a busy flight scene
   (45 rocks, raiders, power-ups, hundreds of particles) stays within the per-frame budget of
   draw calls and JavaScript time for simulation plus drawing. */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
H.installEnv({ date: new Date('2026-12-24T12:00:00') });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const K = NS.artKit;

function paints(name, fn, budget) {
  const s = fn();
  const calls = s.canvas.ctx.calls;
  const mid = K.stats().created;
  const again = fn();
  check(name + ' paints and is cached', calls > 0 && again === s && K.stats().created === mid, calls);
  if (budget) check(name + ' stays under ' + budget + ' calls', calls < budget, calls);
  return calls;
}

let heaviest = 0;
for (const t of Object.keys(NS.rockData.ROCK_TYPES))
  for (let size = 1; size <= 4; ++size) heaviest = Math.max(heaviest, paints('rock ' + t + ' ' + size, () => NS.rockArt.rock(t, size, size % 6)));
check('the heaviest rock painting stays under 900 calls', heaviest < 900, heaviest);
for (let st = 1; st <= 2; ++st) paints('cracks ' + st, () => NS.rockArt.cracks(3, 1, st), 300);
for (const sk of NS.cosmetics.SKINS) paints('skin ' + sk.id, () => NS.shipArt.shipSprite(sk.id), 300);
for (const e of Object.keys(NS.enemyData.ENEMIES)) paints('raider ' + e, () => NS.enemyArt.enemySprite(e), 400);
for (const b of NS.enemyData.BOSS_ORDER) paints('titan ' + b, () => NS.enemyArt.boss(b), 800);
for (const p of ['plate', 'segment', 'facet', 'pylon', 'eye']) paints('titan part ' + p, () => NS.enemyArt.partSprite(p, 'glacier'), 300);
for (const k of NS.powerData.POWER_ORDER) paints('capsule ' + k, () => NS.propArt.capsule(k), 200);
for (const s of Object.keys(NS.seasons.SEASONS)) paints('token ' + s, () => NS.propArt.token(s), 200);
for (const id of Object.keys(NS.propArt.ICONS)) paints('icon ' + id, () => NS.propArt.iconSprite(id, '#ffffff'), 200);
for (const c of Object.keys(NS.campaign.CAST)) paints('portrait ' + c, () => NS.story.portrait(c), 3000);
for (let ch = -1; ch < 5; ++ch) paints('planet ' + ch, () => NS.backdrop.planet(ch), 600);
for (let l = 0; l < 3; ++l) paints('star tile ' + l, () => NS.backdrop.starTile(l), 2000);
paints('station', () => NS.cineRender.station(), 400);
paints('logo', () => NS.kit.logo(), 50);

const ctx = H.fakeCtx();
const spr = NS.enemyArt.enemySprite('saucer');
K.blitRot(ctx, spr, 10, 10, 1, 1);
check('a rotated blit costs at most five calls', ctx.calls <= 5 && ctx.images === 1, ctx.calls);
const files = H.scriptList().map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
check('no shadowBlur in any game file', files.every(src => src.indexOf('shadowBlur') < 0));
check('every module stays under 800 lines', H.scriptList().every(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n').length <= 800));

/* a busy scene: the same work the browser does each frame, against the fake canvas */
NS.input.sample = () => NS.bot.think();
NS.title.startMode('arcade');
G.run.lives = 99;
for (let i = 0; i < 40; ++i) NS.rocks.spawnEdge(['crystal', 'lava', 'electric', 'gold', 'void', 'ice', 'gift'][i % 7], 1 + (i % 3), 1);
for (const e of ['saucer', 'gunship', 'hunter', 'layer', 'phantom']) NS.enemies.spawn(e);
NS.powerups.apply('rapid');
NS.powerups.apply('triple');
NS.powerups.apply('orbit');
NS.hazards.hole(300, 300, true);
const view = NS.view.ctx;
for (let i = 0; i < 120; ++i) { NS.sim.update(1 / 60); NS.frame.draw(); }
let simT = 0, drawT = 0, calls = 0, frames = 0, peakParticles = 0;
for (let i = 0; i < 300; ++i) {
  if (i % 60 === 0) for (let k = 0; k < 6; ++k) NS.rocks.spawnEdge('explosive', 3, 1);
  const t0 = process.hrtime.bigint();
  NS.sim.update(1 / 60);
  const t1 = process.hrtime.bigint();
  const c0 = view.calls;
  NS.frame.draw();
  const t2 = process.hrtime.bigint();
  calls += view.calls - c0;
  simT += Number(t1 - t0) / 1e6;
  drawT += Number(t2 - t1) / 1e6;
  ++frames;
  peakParticles = Math.max(peakParticles, NS.fx.count());
}
const per = (simT + drawT) / frames;
console.log('busy scene: sim ' + (simT / frames).toFixed(3) + ' ms + draw ' + (drawT / frames).toFixed(3) + ' ms per frame, ' + Math.round(calls / frames) + ' draw calls, ' + G.rocks.length + ' rocks, peak ' + peakParticles + ' particles');
check('a busy frame costs under 6 ms of JavaScript', per < 6, per.toFixed(3));
check('a busy frame stays under 6000 canvas calls', calls / frames < 6000, Math.round(calls / frames));
check('particles stay inside the pool budget', peakParticles <= NS.constants.MAX_PARTICLES);
/* sprites paint lazily the first time a type/size/shape shows up; after that only rarely */
NS.rockArt.warmStep(1e9);
const k0 = new Set(K.keys());
for (let i = 0; i < 60; ++i) { NS.sim.update(1 / 60); NS.frame.draw(); }
const fresh = K.keys().filter(k => !k0.has(k));
check('sprite painting is rare once the scene is warm', fresh.length <= 8, fresh.join(' '));
done();
