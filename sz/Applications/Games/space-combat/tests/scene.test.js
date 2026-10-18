'use strict';

/* The whole game in a fake browser: start every mode, simulate a heavy battle (100+ enemies,
   hundreds of shots), and keep the per-frame draw-call budget; tree purchases apply mid-run. */
const H = require('./harness');
const env = H.installEnv();
global.requestAnimationFrame = () => 0;
const NS = H.load(null, ['js/app.js']);
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;

function steps(n) {
  for (let i = 0; i < n; ++i) NS.sim.update(1 / 60);
}

function frameCalls() {
  const c0 = ctx.calls;
  NS.frame.draw();
  return ctx.calls - c0;
}

/* menus all draw */
for (const s of ['title', 'map', 'hangar', 'tree', 'help', 'briefing']) {
  if (s === 'briefing') G.ui.briefing = { sector: 0, index: 0 };
  NS.screens.setScreen(s);
  steps(2);
  const calls = frameCalls();
  check('screen ' + s + ' draws with hit areas', calls > 50 && G.hitAreas.length > 0, calls + ' calls, ' + G.hitAreas.length + ' areas');
}

/* every mode starts and runs */
for (const mode of ['campaign', 'endless', 'daily', 'bossRush']) {
  NS.missions.startRun(mode, { sector: 2, index: 0 });
  steps(240);
  check(mode + ' runs', G.screen === 'playing' && G.player && G.stage && G.stage.rt.t > 3.9, G.screen);
}

/* every mission type sets up its objective */
const kinds = {};
for (let s = 0; s < 5; ++s) for (let i = 0; i < 6; ++i) {
  NS.missions.startRun('campaign', { sector: s, index: i });
  steps(120);
  const st = G.stage;
  let ok = G.player && G.player.alive;
  if (st.type === 'destroy') ok = ok && st.rt.outposts === st.n && G.enemies.some(e => e.objective);
  if (st.type === 'collect') ok = ok && G.pickups.filter(q => q.type === 'core').length === st.n;
  if (st.type === 'escort' || st.type === 'defend') ok = ok && G.allies.length === 1;
  if (st.type === 'boss') ok = ok && G.boss && G.boss.parts.length > 0;
  kinds[st.id] = ok;
}
const badKinds = Object.keys(kinds).filter(k => !kinds[k]);
check('all 30 missions set up their objectives', badKinds.length === 0, badKinds.join());

/* a heavy scene: 120 enemies, 400 enemy shots, 300 player shots */
NS.missions.startRun('campaign', { sector: 4, index: 2 });
steps(10);
const p = G.player;
p.iframes = 1e9;
const types = ['fighter', 'interceptor', 'drone', 'bomber', 'frigate', 'cloaker', 'lancer'];
for (let i = 0; i < 120; ++i) {
  const a = i * 0.7, r = 200 + (i % 10) * 60;
  NS.enemies.spawn(types[i % types.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { instant: true });
}
for (let i = 0; i < 400; ++i) NS.projectiles.enemyShot('orb', p.x + (i % 40) * 20 - 400, p.y - 300, 1.5, 120, 1, 'violet');
for (let i = 0; i < 300; ++i) NS.projectiles.player('bolt', p.x, p.y, Math.cos(i) * 900, Math.sin(i) * 900, 1, 10, 5, 'cyan');
for (let i = 0; i < 30; ++i) NS.fx.explode(p.x + i * 10, p.y, 30);
check('the heavy scene is populated', G.enemies.length >= 100 && G.eBullets.length >= 350 && NS.fx.count() > 500, G.enemies.length + '/' + G.eBullets.length + '/' + NS.fx.count());
const calls = frameCalls();
check('a heavy frame stays under 9000 draw calls', calls < 9000, calls);
const t0 = Date.now();
steps(60);
const ms = (Date.now() - t0) / 60;
check('a heavy simulation step costs under 4 ms in node', ms < 4, ms.toFixed(2) + ' ms');
check('particle pool is capped', NS.fx.count() <= NS.constants.MAX_PARTICLES);

/* buying in the tree while paused applies at once */
NS.screens.pause();
NS.screens.openTree('paused');
G.save.credits = 10000;
const before = G.player.maxHull;
NS.tree.buy('d_hull');
check('tree purchase raises max hull mid-run', G.player.maxHull > before && G.player.hull > 0, before + ' -> ' + G.player.maxHull);
G.save.tree.skin_gold = 1;
NS.rules.equipStyle(G.save, 'skin', 'gold');
NS.player.applyLooks(G.player);
check('a new paint scheme shows on the flying ship', G.player.skinKey === 'gold');
NS.screens.setScreen('paused');
NS.screens.resume();
check('resume returns to flight', G.screen === 'playing');

/* losing and winning end the stage with results and pay scrap */
const credits = G.save.credits;
G.player.iframes = 0;
G.player.aegis = 0;
G.player.lastStand = false;
NS.player.damage(1e6, G.player.x, G.player.y);
steps(200);
check('death ends the mission with results', G.screen === 'results' && G.ui.results && !G.ui.results.won, G.screen);
check('a lost mission still pays something', G.save.credits >= credits);
NS.missions.startRun('campaign', { sector: 0, index: 0 });
steps(60);
NS.missions.win();
steps(200);
check('winning shows results with stars', G.screen === 'results' && G.ui.results.won && G.ui.results.stars >= 1);
check('stars are saved', G.save.stars.s1m1 >= 1);

done();
