'use strict';

/* Art budgets with a recording fake canvas: sprites are painted once and reused, a busy play
   frame (every effect running, darkness, a boss) and each menu stay within a draw-call budget,
   steady frames create no new canvases, the effect pools never grow, and every skin, ghost,
   boss, item and icon paints. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const K = NS.artKit;
const AA = NS.actorArt;
const IA = NS.itemArt;
const ctx = env.gameCanvas.ctx;

check('sprites are cached by key', AA.pac('classic', 3) === AA.pac('classic', 3) && AA.ghost('#ff0000', 'blinky', 0) === AA.ghost('#ff0000', 'blinky', 0));
let threw = '';
try {
  for (const s of NS.cosmetics.SKINS) for (let m = 0; m < 7; ++m) AA.pac(s.id, m);
  for (const k in NS.items.GHOSTS) for (let f = 0; f < 2; ++f) AA.ghost(NS.items.GHOSTS[k].color, k, f);
  for (const b in NS.worlds.BOSSES) for (const mode of ['normal', 'scared', 'flash']) AA.boss(b, mode);
  for (const p of NS.items.POWERUPS) IA.capsule(p.id, p.color);
  for (const f of NS.items.FRUITS) IA.fruit(f.id);
  for (const s of NS.cosmetics.SEASONS) { IA.token(s.token); NS.backdrop.seasonDecor(s.id); }
  for (const w of NS.worlds.WORLDS) NS.backdrop.scene(w.theme);
  for (const t of NS.cosmetics.MAZE_THEMES) if (t.theme) NS.backdrop.scene(t.theme);
} catch (e) { threw = e.stack; }
check('every skin, ghost, boss, item, token and backdrop paints', !threw, threw);

function frameCost(n) {
  let calls = 0, worst = 0;
  for (let i = 0; i < n; ++i) {
    NS.sim.update(1 / 60);
    const c0 = ctx.calls;
    NS.frame.draw();
    const c = ctx.calls - c0;
    calls += c;
    worst = Math.max(worst, c);
  }
  return { avg: calls / n, worst: worst };
}

/* a busy arcade frame */
NS.input.sample = (lvl) => NS.autopilot.drive(lvl, 1 / 60);
NS.screens.launch('arcade');
H.run(NS, 120, 0);
for (const id of ['mega', 'magnet', 'shield', 'blaster', 'decoy', 'speed', 'double', 'slowmo']) NS.powerups.activate(id);
NS.powerups.activate('bomb');
for (let i = 0; i < 6; ++i) NS.fx.confetti(640, 360, 60);
const busy = frameCost(120);
console.log('  busy play frame: ' + Math.round(busy.avg) + ' calls avg, ' + busy.worst + ' worst, particles ' + NS.fx.count());
check('a busy play frame stays under 2600 canvas calls', busy.worst < 2600, busy.worst);
const made = H.canvases;
frameCost(60);
check('steady play frames create no new canvases', H.canvases === made, H.canvases - made);

/* the woods (darkness) and a boss */
NS.screens.launchStory(3, 0);
while (G.cine) NS.cinematics.end();
H.run(NS, 60, 0);
const dark = frameCost(60);
check('a darkness frame stays under 1600 calls', dark.worst < 1600, dark.worst);
NS.screens.launchStory(4, 4);
while (G.cine) NS.cinematics.end();
H.run(NS, 240, 0);
const boss = frameCost(60);
check('a boss frame stays under 1600 calls', boss.worst < 1600, boss.worst);

/* menus */
const menus = {};
for (const s of ['title', 'map', 'tree', 'wardrobe', 'goals', 'season', 'help']) {
  NS.screens.setScreen(s);
  frameCost(5);
  menus[s] = frameCost(20).worst;
}
console.log('  menu frames: ' + JSON.stringify(menus));
check('every menu frame stays under 1800 calls', Object.values(menus).every(v => v < 1800), JSON.stringify(menus));
const made2 = H.canvases;
NS.screens.setScreen('tree');
frameCost(30);
check('steady menu frames create no new canvases', H.canvases === made2, H.canvases - made2);

check('the particle pool is fixed in size', NS.fx.P.length === NS.constants.MAX_PARTICLES);
check('the sprite cache stays bounded', K.stats().keys < 900, K.stats().keys);

done();
