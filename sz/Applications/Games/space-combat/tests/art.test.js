'use strict';

/* Procedural art with a recording fake canvas: every sprite paints, is cached after the first
   request, blits in one draw call, and painting stays within budget; no shadowBlur anywhere. */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
H.installEnv();
const NS = H.load('render/backdrop-art.js');
const { check, done } = H;
const K = NS.artKit;
const S = NS.shipArt;
const E = NS.enemyArt;
const P = NS.propArt;
const B = NS.backdropArt;
const { SHIPS, SKINS, POWERUPS, COLORS } = NS.ships;
const { SECTORS } = NS.campaign;

function paints(name, fn) {
  const before = K.stats().created;
  const s = fn();
  const calls = s.canvas.ctx.calls;
  const mid = K.stats().created;
  const again = fn();
  check(name + ' paints and is cached', calls > 0 && again === s && mid > before && K.stats().created === mid, calls);
  return { s, calls };
}

for (const ship of SHIPS)
  for (const b of [-1, 0, 1]) paints('ship ' + ship.id + ' bank ' + b, () => S.shipSprite(ship.id, 'stock', ship.colors, b));
for (const k of Object.keys(SKINS)) if (SKINS[k].colors) paints('skin ' + k, () => S.shipSprite('falcon', k, SKINS[k].colors, 0));
check('bank frames quantise to five', S.bankFrame(-1) === 0 && S.bankFrame(0) === 2 && S.bankFrame(1) === 4 && S.bankFrame(0.3) === 3);
const sil = S.shipFlash('falcon', 'stock', SHIPS[0].colors, 0);
check('hit-flash silhouettes are cached sprites', sil === S.shipFlash('falcon', 'stock', SHIPS[0].colors, 0) && sil.w === S.shipSprite('falcon', 'stock', SHIPS[0].colors, 0).w);

const enemyIds = ['fighter', 'interceptor', 'bomber', 'drone', 'turret', 'barrel', 'station', 'frigate', 'cloaker', 'carrier', 'lancer',
  'relay', 'freighter', 'warden', 'shield', 'beam', 'hydra', 'segment', 'solaris', 'maw', 'mawOpen', 'launcher', 'overmind', 'shard'];
let heaviest = 0;
for (const id of enemyIds) heaviest = Math.max(heaviest, paints('enemy art ' + id, () => E.enemySprite(id)).calls);
check('the heaviest enemy painting stays under 1500 calls', heaviest < 1500, heaviest);

for (let size = 1; size <= 3; ++size)
  for (let v = 0; v < 4; ++v) paints('rock ' + size + '/' + v, () => P.rock(size, v, 'kepler'));
for (const k of Object.keys(POWERUPS)) paints('capsule ' + k, () => P.capsule(k));
paints('scrap', () => P.scrap());
paints('data core', () => P.dataCore());
paints('mines', () => P.mine(false));
paints('missile', () => P.missile(false));
paints('black hole', () => P.blackHole(70));
paints('nebula cloud', () => P.nebula(1234, 400, SECTORS[1].theme.neb));
for (const c of Object.keys(COLORS)) paints('bolt ' + c, () => K.bolt(c, COLORS[c], 22, 5));
paints('glow', () => K.glow('#ff8800'));

let neb = 0;
SECTORS.forEach((sec, i) => {
  const r = paints('sector backdrop ' + sec.id, () => B.nebulaLayer(i, sec.theme));
  neb = Math.max(neb, r.calls);
  if (sec.theme.planet) paints('planet ' + sec.id, () => B.planet(sec.id, sec.theme.planet));
  if (sec.theme.moon) paints('moon ' + sec.id, () => B.moon(sec.id, sec.theme.moon));
  for (let l = 0; l < 3; ++l) paints('stars ' + sec.id + ' ' + l, () => B.starTile(l, sec.theme.star, sec.theme.accent));
});
paints('sun', () => B.sun(SECTORS[2].theme.sun));
check('backdrop painting stays under 3000 calls', neb < 3000, neb);

/* blitting a cached sprite is one drawImage plus its transform */
const ctx = H.fakeCtx();
const spr = E.enemySprite('fighter');
K.blitRot(ctx, spr, 10, 10, 1, 1);
check('a rotated blit costs at most five calls', ctx.calls <= 5 && ctx.images === 1, ctx.calls);
const ctx2 = H.fakeCtx();
K.blit(ctx2, spr, 10, 10);
check('a plain blit is a single draw call', ctx2.calls === 1);

/* no per-frame shadowBlur anywhere in the game code */
const files = H.scriptList().map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
check('no shadowBlur in any game file', files.every(src => src.indexOf('shadowBlur') < 0));
check('art sprites are painted at twice their size', K.SCALE === 2 && spr.canvas.width === spr.w * 2);

done();
