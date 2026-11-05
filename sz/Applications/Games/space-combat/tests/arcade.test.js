'use strict';

/* The arcade rules in the fake browser: 8-way flight without drift, the play field bounds, the
   nose that always points up, focus, the dash, shots going up-screen, pointer following,
   formations, the enemy enter-fight-leave cycle, scrolling hazards, bosses entering from the top,
   grazing and saves from before the arcade view. */
const H = require('./harness');
H.installEnv();
global.requestAnimationFrame = () => 0;
const NS = H.load(null, ['js/app.js']);
const { check, done } = H;
const G = NS.state;
const C = NS.constants;
const F = NS.formations;
const { makeRng } = NS.rng;

function steps(n) {
  for (let i = 0; i < n; ++i) NS.sim.update(1 / 60);
}

function fresh() {
  NS.missions.startRun('campaign', { sector: 0, index: 0 });
  G.input.keys = {};
  G.input.steer = 'keys';
  G.input.touch = false;
  /* an empty, quiet field for the flight checks */
  G.enemies.length = 0;
  G.rocks.length = 0;
  G.mines.length = 0;
  G.eBullets.length = 0;
  G.stage.rt.nextWave = 1e9;
  G.stage.rt.queue.length = 0;
  G.stage.hazards = { rocks: 0, mines: 0, nebulae: 0, hole: false, flares: false };
  NS.hazards.setup({ rocks: [], mines: [], nebulae: [] }, G.stage);
  const p = G.player;
  p.x = C.PF_W / 2;
  p.y = 500;
  p.vx = p.vy = p.ex = p.ey = 0;
  p.iframes = 1e9;
  return p;
}

/* ── flight ── */
let p = fresh();
const sp = G.stats.speed;
G.input.keys.ArrowRight = true;
steps(3);
check('the ship answers within three frames', p.vx > sp * 0.7, Math.round(p.vx) + ' of ' + Math.round(sp));
G.input.keys.ArrowUp = true;
const x0 = p.x, y0 = p.y;
steps(30);
const dx = p.x - x0, dy = p.y - y0;
const v = Math.hypot(dx, dy) / 0.5;
check('diagonals move at the same speed as straight lines', Math.abs(v - sp) < sp * 0.12 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 6, Math.round(v) + ' vs ' + Math.round(sp));
check('right and up move right and up', dx > 0 && dy < 0);
G.input.keys = {};
steps(8);
check('no drift: the ship stops when the keys are released', Math.hypot(p.vx, p.vy) < sp * 0.05, Math.round(Math.hypot(p.vx, p.vy)));
check('the nose always points up', Math.abs(p.angle + Math.PI / 2) < 1e-9);

/* bounds */
G.input.keys.ArrowLeft = true;
G.input.keys.ArrowUp = true;
steps(240);
check('the ship stops at the left edge', p.x >= 0 && p.x < p.r + 2, p.x);
check('the top band belongs to the bosses', Math.abs(p.y - C.PLAYER_TOP) < 0.01, p.y);
G.input.keys = { ArrowRight: true, ArrowDown: true };
steps(240);
check('the ship stops at the right and bottom edges', p.x <= C.PF_W && p.x > C.PF_W - p.r - 2 && p.y <= C.PF_H && p.y > C.PF_H - p.r - 8, p.x + ',' + p.y);
G.input.keys = {};
steps(5);

/* focus */
p = fresh();
G.input.keys = { ArrowLeft: true, ShiftLeft: true };
steps(5);
const fx0 = p.x;
steps(30);
const focusV = (fx0 - p.x) / 0.5;
check('focus slows the ship to the focus speed', Math.abs(focusV - sp * C.FOCUS_MUL) < sp * 0.08 && p.focus, Math.round(focusV));
G.input.keys = {};
steps(10);

/* dash */
p = fresh();
p.iframes = 0;
const dx0 = p.x;
G.input.dashQ = true;
steps(Math.ceil(C.DASH_TIME * 60) + 1);
check('a dash gives invulnerability', p.iframes > 0);
check('a dash with no stick goes sideways by the dash distance', Math.abs(Math.abs(p.x - dx0) - C.DASH_DIST * G.stats.dashLen) < 20 && Math.abs(p.y - 500) < 1, Math.round(p.x - dx0));
const cd = p.dashCd;
G.input.dashQ = true;
steps(1);
check('the dash has a cooldown', cd > 0 && p.dashT <= 0);

/* firing goes up-screen */
p = fresh();
G.pBullets.length = 0;
G.input.keys = { Space: true };
steps(30);
G.input.keys = {};
check('primary shots fly up-screen', G.pBullets.length > 0 && G.pBullets.every(b => b.vy < 0 && Math.abs(b.vx) < Math.abs(b.vy)), G.pBullets.length);
steps(90);
check('shots that leave the field are culled', G.pBullets.length === 0, G.pBullets.length);

/* the pointer: the ship follows it */
p = fresh();
G.input.steer = 'mouse';
G.input.mouseX = C.PF_X + 200;
G.input.mouseY = 300;
steps(120);
check('the ship follows the mouse pointer', Math.abs(p.x - 200) < 3 && Math.abs(p.y - 300) < 3, Math.round(p.x) + ',' + Math.round(p.y));
G.input.keys = { ArrowRight: true };
steps(2);
check('the keys take over from the pointer', p.vx > 0);
G.input.keys = {};
G.input.steer = 'keys';

/* ── formations ── */
const rng = makeRng(42);
let badStart = 0, badSlot = 0, badCount = 0, badOverlap = 0;
const kinds = ['row', 'vee', 'sweep', 'dive', 'column', 'flank', 'single'];
for (let k = 0; k < 400; ++k) {
  const kind = kinds[k % kinds.length];
  /* heavy ships fly alone or in pairs, the rest up to eight at a time */
  const n = kind === 'single' ? 1 + (k % 2) : 1 + (k % 8);
  const r = kind === 'single' ? 40 + (k % 3) * 13 : 12 + (k % 3) * 4;
  const plan = F.plan(kind, n, r, rng, C.PF_W, C.PF_H);
  if (plan.length !== n) ++badCount;
  for (const en of plan) {
    if (!(en.y0 < 0 || en.x0 < 0 || en.x0 > C.PF_W)) ++badStart;
    if (en.hold && (en.x1 < r || en.x1 > C.PF_W - r || en.y1 < F.SLOT_TOP || en.y1 > F.SLOT_BOTTOM + 60)) ++badSlot;
  }
  const held = plan.filter(e => e.hold);
  for (let i = 0; i < held.length; ++i)
    for (let j = i + 1; j < held.length; ++j)
      if (Math.hypot(held[i].x1 - held[j].x1, held[i].y1 - held[j].y1) < r * 1.6) ++badOverlap;
}
check('formations have one entry per ship', badCount === 0, badCount);
check('every formation enters from outside the field', badStart === 0, badStart);
check('hover slots sit inside the upper band', badSlot === 0, badSlot);
check('ships in a formation never share a slot', badOverlap === 0, badOverlap);
const en = F.plan('row', 1, 20, makeRng(1), C.PF_W, C.PF_H)[0];
const a = F.pathPoint(en, 0, {}), b = F.pathPoint(en, 1, {});
check('entry paths run from the start to the slot', a.x === en.x0 && a.y === en.y0 && Math.abs(b.x - en.x1) < 1e-9 && Math.abs(b.y - en.y1) < 1e-9);
check('every enemy type has formations', Object.keys(NS.enemyData.ENEMIES).every(t => F.BY_TYPE[t] && F.BY_TYPE[t].every(f => kinds.indexOf(f) >= 0)));

/* ── enemy cycle: enter, fight in the slot, leave, escape without score ── */
p = fresh();
const e = NS.enemies.spawn('fighter', 0, 0, { path: F.plan('row', 1, 20, makeRng(3), C.PF_W, C.PF_H)[0] });
check('a formation ship starts above the field', e.y < 0 && e.phase === 'enter');
steps(Math.ceil(e.path.dur * 60) + 2);
check('it ends its entry in its slot', e.phase === 'fight' && Math.hypot(e.x - e.homeX, e.y - e.homeY) < 25, e.phase + ' ' + Math.round(e.x) + ',' + Math.round(e.y));
const score = G.score;
e.t = e.stay + 1;
steps(60 * 8);
check('after its stay it leaves the field and is gone without score', !e.alive && e.escaped && G.score === score, e.phase + ' ' + Math.round(e.y));

/* hornets dive and come round once */
p = fresh();
const h = NS.enemies.spawn('interceptor', 0, 0, { path: F.plan('dive', 1, 17, makeRng(5), C.PF_W, C.PF_H)[0] });
let maxY = -1e9, looped = false;
for (let i = 0; i < 60 * 12 && h.alive; ++i) {
  steps(1);
  maxY = Math.max(maxY, h.y);
  if (h.loops > 0) looped = true;
}
check('hornets dive through the field and loop round once', maxY > C.PF_H && looped, Math.round(maxY));

/* turrets on terrain ride the scroll */
p = fresh();
const tu = NS.enemies.spawn('turret', 300, -40, { ground: true });
const ty0 = tu.y;
steps(60);
check('terrain sentries scroll down with the field', Math.abs(tu.y - ty0 - G.scroll.speed) < 2, tu.y - ty0);

/* waves are queued in formation and fly in from outside */
p = fresh();
G.stage.rt.nextWave = 0;
G.stage.period = 1e9;
steps(1);
const queued = G.stage.rt.queue.length + G.enemies.length;
steps(20);
check('a wave is queued as formation entries', queued > 0 && G.enemies.every(x => x.phase === 'enter' || x.phase === 'fight'), queued);
check('wave ships appear outside the field', G.enemies.every(x => x.phase !== 'enter' || x.pathT > 0.25 || !NS.camera.inField(x.x, x.y, -x.r)));

/* ── hazards ride the scroll ── */
p = fresh();
const rock = NS.hazards.addRock(100, -60, 1, 7, 0, 90);
steps(60 * 10);
check('asteroids drift down and leave the field', !rock.alive);
NS.hazards.spawnMine(200, -20, false);
const mine = G.mines[G.mines.length - 1];
steps(60);
check('mines drift down with the scroll', mine.y > 40, mine.y);
G.stage.hazards = { rocks: 26, mines: 18, nebulae: 4, hole: true, flares: true };
NS.hazards.setup({ rocks: [], mines: [], nebulae: [] }, G.stage);
const seen = { rocks: 0, mines: 0, nebulae: 0, holes: 0 };
for (let i = 0; i < 60 * 40; ++i) {
  steps(1);
  for (const k in seen) seen[k] = Math.max(seen[k], G[k].length);
}
check('the hazard stream brings rocks, mines, nebulae and a black hole', seen.rocks > 0 && seen.mines > 0 && seen.nebulae > 0 && seen.holes > 0, JSON.stringify(seen));
check('drifting hazards leave the field again', G.rocks.every(r => r.y < C.PF_H + r.r + 40) && G.mines.every(m => m.y < C.PF_H + 50));
check('a solar flare telegraphs a band of the screen', G.flare && (G.flare.band || G.flare.state === 'idle'));

/* ── bosses enter at the top and fight there ── */
for (const id of NS.enemyData.BOSS_ORDER) {
  p = fresh();
  const boss = NS.bosses.spawn(id, C.PF_W / 2);
  const startY = boss.y;
  let lowest = -1e9, edge = 0;
  for (let i = 0; i < 60 * 20; ++i) {
    steps(1);
    if (boss.introT <= 0 && boss.def.move.type !== 'serpent') {
      lowest = Math.max(lowest, boss.y);
      if (boss.x < 0 || boss.x > C.PF_W) ++edge;
    }
  }
  if (boss.def.move.type === 'serpent')
    check(id + ' swims in from the top and stays in the field', startY < 0 && boss.x > 0 && boss.x < C.PF_W && boss.y > -50 && boss.y < C.PF_H, Math.round(boss.x) + ',' + Math.round(boss.y));
  else
    check(id + ' descends from the top and holds the upper band', startY < 0 && lowest < 330 && lowest > 100 && edge === 0, Math.round(startY) + ' -> ' + Math.round(lowest));
  G.boss = null;
}

/* ── grazing ── */
p = fresh();
p.iframes = 0;
p.abilityCd = 10;
G.grazes = 0;
NS.projectiles.enemy('bolt', p.x + p.hitR + 14, p.y - 60, 0, 200, 2, 5, 4, 'red');
steps(40);
check('a near miss counts as a graze and charges the special', G.grazes === 1 && p.abilityCd < 10 - 0.6 && p.hull === p.maxHull, G.grazes + ' ' + p.abilityCd.toFixed(2));
NS.projectiles.enemy('bolt', p.x, p.y - 60, 0, 200, 2, 5, 4, 'red');
steps(40);
check('a shot on the core hits', p.shield < p.maxShield || p.hull < p.maxHull);

/* ── saves from before the arcade view ── */
const old = NS.rules.defaultSave();
old.tree = { e_thrust: 3, e_roll: 2, e_boost: 2, e_grip: 1, e_burn: 1, s_radar: 2, e_ram: 1 };
const st = NS.rules.computeStats(NS.rules.migrate ? NS.rules.migrate(old) : old, 'specter');
check('old tree levels still yield sane arcade stats', ['speed', 'dashCd', 'dashLen', 'focusDmg', 'graze', 'ram'].every(k => isFinite(st[k]) && st[k] > 0) && st.burn, JSON.stringify({ speed: st.speed, dashCd: st.dashCd, graze: st.graze }));

done();
