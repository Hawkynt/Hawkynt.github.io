'use strict';

/* Procedural art with a recording fake canvas: every treat stage, skin and decoration set,
   producer icon, unit and scene, golden carrier, portrait and particle paints once, is cached
   and stays within a painting budget; a busy bakery frame stays within a draw-call budget and
   blits cached art; nothing uses shadowBlur. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const K = NS.artKit;
const G = NS.state;
const { STAGES, SKINS, CAST } = NS.treatData;
const { BUILDINGS } = NS.buildingData;

function paints(name, fn, budget) {
  const before = K.stats().created;
  const s = fn();
  const calls = s.ctx.calls;
  const mid = K.stats().created;
  const again = fn();
  const ok = calls > 0 && again === s && mid > before && K.stats().created === mid;
  if (!ok || calls >= budget) check(name + ' paints, is cached and stays under ' + budget, false, calls);
  return calls;
}

let worst = 0, count = 0;
for (let s = 0; s < STAGES.length; ++s)
  for (const mask of [0, 1, 2, 4, 8, 16, 32, 63]) {
    worst = Math.max(worst, paints('treat ' + s + ' mask ' + mask, () => NS.treatArt.sprite(s, 'classic', mask), 4000));
    ++count;
  }
check('all ' + count + ' treat stage/decoration sprites paint and cache under 4000 calls', worst < 4000, worst);
const treats = new Set();
for (let s = 0; s < STAGES.length; ++s) treats.add(NS.treatArt.sprite(s, 'classic', 0));
check('every era has its own sprite', treats.size === STAGES.length);
let skinWorst = 0;
for (const sk of SKINS.slice(1)) skinWorst = Math.max(skinWorst, paints('skin ' + sk.id, () => NS.treatArt.sprite(3, sk.id, 0), 4000));
check(SKINS.length + ' skins paint under 4000 calls', skinWorst < 4000, skinWorst);
check('candle flames and twinkles have anchors on every era', STAGES.every((s, i) => NS.treatArt.flames(i).length > 0 && NS.treatArt.twinkles(i).length > 0));

let b1 = 0, b2 = 0, b3 = 0;
for (const b of BUILDINGS) {
  b1 = Math.max(b1, paints('icon ' + b.id, () => NS.buildingArt.icon(b.id), 400));
  b2 = Math.max(b2, paints('unit ' + b.id, () => NS.buildingArt.unit(b.id), 400));
  b3 = Math.max(b3, paints('scene ' + b.id, () => NS.buildingArt.backdrop(b.id), 600));
}
check(BUILDINGS.length + ' producer icons, units and scenes paint within budget', b1 < 400 && b2 < 400 && b3 < 600, b1 + '/' + b2 + '/' + b3);
check('every producer has its own unit painter', BUILDINGS.every(b => typeof NS.buildingArt.UNITS[b.id] === 'function'));
for (const c of Object.values(NS.eventData.CARRIERS)) paints('golden ' + c.id, () => NS.hud.goldenSprite(c.id), 400);
for (const id in CAST) paints('portrait ' + id, () => NS.cineRender.portrait(id), 400);
for (let k = 0; k < 10; ++k) paints('particle ' + k, () => NS.fxRender.partSprite(k, '#ff8800'), 60);
for (const se of NS.treatData.SEASON_IDS) paints('decor ' + se, () => NS.backdrop.decor(NS.backdrop.theme('bakery'), se), 3000);
check('golden carriers, portraits, particles and seasonal decor paint within budget', true);

/* a busy frame */
G.profile.seenIntro = true;
NS.screens.setScreen('game');
for (const b of BUILDINGS) G.run.buildings[b.id] = 60;
G.run.baked = 2e18;
G.run.stage = 7;
for (const u of NS.upgradeData.UPGRADES) if (u.kind === 'deco') G.run.upgrades[u.id] = true;
NS.production.invalidate();
NS.golden.spawn('golden');
NS.golden.apply(G.run, NS.eventData.OUTCOMES[5], 300, 300);
for (let i = 0; i < 30; ++i) NS.clicking.click(false);
NS.fx.burst(300, 300, 200, ['#fff'], 'stars', 300);
for (let i = 0; i < 30; ++i) NS.app.update(1 / 60);
const ctx = env.gameCanvas.ctx;
NS.frame.draw();
const created = K.stats().created;
const c0 = ctx.calls, t0 = ctx.texts, g0 = ctx.gradients;
NS.frame.draw();
const calls = ctx.calls - c0;
check('a busy bakery frame stays under 9000 draw calls', calls < 9000, calls);
check('a busy frame creates no new art', K.stats().created === created);
check('a busy frame needs at most 140 texts', ctx.texts - t0 <= 140, ctx.texts - t0);
check('a busy frame creates at most 60 gradients', ctx.gradients - g0 <= 60, ctx.gradients - g0);
check('fewer than 700 particles alive', NS.fx.count() <= 700);
let shadow = ctx.shadowBlurUsed;
for (const k in K.cache) shadow += K.cache[k].ctx.shadowBlurUsed;
check('no shadowBlur in any art or frame', shadow === 0);
done();
