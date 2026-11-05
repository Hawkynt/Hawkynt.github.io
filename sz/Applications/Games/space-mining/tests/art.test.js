'use strict';

/* Procedural art with a recording fake canvas: every sprite paints, is cached after the first
   request and stays within its painting budget; a blit is one draw call; a busy flight frame
   stays within a draw-call budget; no shadowBlur anywhere. */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const K = NS.artKit;
const { ORES, ZONES } = NS.ores;
const { HULLS } = NS.ships;

function paints(name, fn, budget) {
  const before = K.stats().created;
  const s = fn();
  const calls = s.canvas.ctx.calls;
  const mid = K.stats().created;
  const again = fn();
  check(name + ' paints and is cached', calls > 0 && again === s && mid > before && K.stats().created === mid, calls);
  if (budget) check(name + ' stays under ' + budget + ' calls', calls < budget, calls);
  return calls;
}

for (const h of HULLS)
  for (const b of [-1, 0, 1]) paints('hull ' + h.id + ' bank ' + b, () => NS.shipArt.shipSprite(h.id, h.colors, b), 800);
check('bank frames quantise to five', NS.shipArt.bankFrame(-1) === 0 && NS.shipArt.bankFrame(0) === 2 && NS.shipArt.bankFrame(1) === 4);
paints('drone', () => NS.shipArt.drone());
let heaviest = 0;
for (const z of ZONES)
  for (let t = 1; t <= 4; ++t) heaviest = Math.max(heaviest, paints('rock ' + z.id + ' ' + t, () => NS.rockArt.body(t, t % 4, z.theme.rock)));
check('the heaviest rock stays under 1500 calls', heaviest < 1500, heaviest);
for (const o of ORES) {
  paints('veins ' + o.id, () => NS.rockArt.veins(3, 1, o.id), 1200);
  paints('vein glow ' + o.id, () => NS.rockArt.veinGlow(3, 1, o.id), 400);
  paints('nugget ' + o.id, () => NS.rockArt.nugget(o.id, 0), 200);
}
paints('volatile veins', () => NS.rockArt.veins(2, 0, 'volatile'));
for (let st = 1; st <= 3; ++st) paints('cracks ' + st, () => NS.rockArt.cracks(4, 0, st), 600);
paints('geode', () => NS.rockArt.geode('voidCrystal'), 1500);
paints('crown heart', () => NS.rockArt.crown(), 1500);
paints('dock', () => NS.propArt.dock(), 800);
for (const k of ['skimmer', 'raider', 'gunship']) paints('pirate ' + k, () => NS.propArt.pirate(k), 400);
paints('derelict', () => NS.propArt.derelict(0), 400);
paints('gravity well', () => NS.propArt.well(), 1500);
paints('radiation cloud', () => NS.propArt.radCloud(3), 400);
for (const m of NS.ships.MODULES)
  for (let l = 0; l <= 3; ++l) paints('module ' + m.id + ' ' + l, () => NS.stationArt.module(m.id, l), 400);
paints('station ring', () => NS.stationArt.ring(), 1500);
let neb = 0;
ZONES.forEach((z, i) => {
  neb = Math.max(neb, paints('nebula ' + z.id, () => NS.backdropArt.nebulaLayer(i, z.theme)));
  if (z.theme.planet) paints('planet ' + z.id, () => NS.backdropArt.planet(z.id, z.theme.planet));
  paints('far belt ' + z.id, () => NS.backdropArt.farBelt(i, z.theme.rock), 1500);
});
check('backdrop painting stays under 3000 calls', neb < 3000, neb);
for (const k of Object.keys(NS.propArt.ICONS)) paints('icon ' + k, () => NS.propArt.iconSprite(k, '#ffffff'), 120);

const ctx = H.fakeCtx();
K.blit(ctx, NS.rockArt.nugget('gold', 0), 10, 10);
check('a plain blit is a single draw call', ctx.calls === 1);

/* a busy flight frame: count the real draw calls on the game canvas */
NS.save.refreshStats();
NS.trip.startTrip('career', 3);
NS.cinematics.skip();
H.run(NS, 60);
NS.pirates.wave();
for (let i = 0; i < 60; ++i) NS.mining.spawnNugget(NS.state.ship.x + 100, NS.state.ship.y, 'platinum', 1, null, 200);
NS.fx.explode(NS.state.ship.x, NS.state.ship.y - 100, 40);
H.run(NS, 20);
const g = NS.view.ctx;
const c0 = g.calls;
NS.frame.draw();
const frameCalls = g.calls - c0;
check('a busy flight frame stays under 6000 canvas calls', frameCalls < 6000, frameCalls);
check('creating sprites stops once the frame is warm', (() => { const a = K.stats().created; NS.frame.draw(); return K.stats().created === a; })());

const files = H.scriptList().map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
check('no shadowBlur in any game file', files.every(src => src.indexOf('shadowBlur') < 0));
check('art sprites are painted at twice their size', K.SCALE === 2);
check('every game file stays under 800 lines', files.every(src => src.split('\n').length < 800));

done();
