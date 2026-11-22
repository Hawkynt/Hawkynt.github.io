'use strict';

/* The Verdant Shoals played by bots in the running game, from a save that has cleared the
   Kessler Drift and the Amber Reach. A builder bot founds the outpost and works down a build
   order through the build layer a player uses (place a building where the grid allows, nearest
   the hub), orders supply freighters from the hub when the stock runs short, flies over the hub
   to unload, sterilises infected buildings, escorts the Supply Run freighters and flies its ship
   at whatever invades - laser locked with Space, weapons firing. A competent bot builds a full
   defence (lasers, flak, Tesla Coils, a Stasis Beam) and fights; a weak one builds two lasers,
   never fights and lets an outbreak run. Each operation reports whether it was won, in how many
   tries, its time, the waves it held and the tension the director measured. FATE=1 logs how
   each operation ended, HURT=1 adds the ship's damage by source and who dealt the first hit. */
const H = require('./harness');
const clock = 1762300000000;
Date.now = () => clock;
let seed = 777;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;
const O = NS.ops;
const { BUILDING_BY_ID } = NS.colonyData;

const hurtBy = {};
if (process.env.HURT) {
  const orig = NS.ship.hurt;
  NS.ship.hurt = function(n, why) {
    hurtBy[why] = (hurtBy[why] || 0) + n;
    if (why === 'bolt' && !hurtBy._who) {
      const s = G.ship;
      hurtBy._who = G.enemies.filter(e => e.alive && Math.hypot(e.x - s.x, e.y - s.y) < 900).map(e => e.type + (e.dormant ? 'z' : '') + (e.wave ? 'w' + e.wave : '')).join(',') +
        ' | pir ' + G.pirates.filter(p => p.alive).length + ' | units ' + G.units.filter(u => u.alive).map(u => u.side + u.type).join(',') + ' | rogue ' + (G.base ? G.base.data.buildings.filter(o => o.rogue).length : 0);
    }
    return orig.apply(this, arguments);
  };
}
const view = {};
function point(x, y) {
  NS.camera.toView(x, y, view);
  G.input.mouseX = view.x;
  G.input.mouseY = view.y;
}

function nearest(list, x, y, pred, range) {
  let best = null, bd = range || Infinity;
  for (const o of list) {
    if (!o.alive || (pred && !pred(o))) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* the ship: invaders and pirates near the outpost or a freighter, else unload, else wait at the hub */
function pilot(fights) {
  const s = G.ship, run = G.run, inp = G.input;
  inp.rightDown = inp.mouseDown = false;
  inp.keys.KeyS = inp.keys.Space = false;
  inp.aimMode = 'mouse';
  if (!s || !s.alive || G.cine || !run || run.ending) return;
  const h = B.hub();
  const home = h || { x: G.base.site.cx, y: G.base.site.cy };
  const fl = G.freighters.filter(f => NS.freighters.flying(f));
  /* a defender stays by its turrets: heavies first, swarms only once they are close */
  const threat = o => !o.dormant && o.type !== 'hive' && (Math.hypot(o.x - home.x, o.y - home.y) < 650 || fl.some(f => Math.hypot(o.x - f.x, o.y - f.y) < 700));
  /* siege ships shell from beyond the turrets: only the ship can reach them */
  const far = o => !o.dormant && (o.type === 'siege' || o.type === 'frigate' || o.type === 'carrier') && Math.hypot(o.x - home.x, o.y - home.y) < 1000;
  const heavy = fights ? nearest(G.enemies, s.x, s.y, o => far(o) || (threat(o) && o.type !== 'swarmer')) : null;
  const foe = fights ? heavy || nearest(G.pirates, s.x, s.y, threat, 600) : null;
  let tx, ty, stand = 0, lock = false, cap = 260;
  const close = nearest(G.enemies, s.x, s.y, o => !o.dormant, 400);
  let sx = 0, sy = 0, sn = 0;
  for (const e of G.enemies) if (e.alive && e.type === 'swarmer' && Math.hypot(e.x - s.x, e.y - s.y) < 600) { sx += e.x; sy += e.y; ++sn; }
  if (sn >= 4) {
    /* a swarm: back away from it and let the turrets have it, firing all the while */
    sx /= sn; sy /= sn;
    const dd = Math.hypot(s.x - sx, s.y - sy) || 1;
    tx = s.x + (s.x - sx) / dd * 500; ty = s.y + (s.y - sy) / dd * 500; lock = true; cap = 460;
  }
  else if (s.hull < s.maxHull * 0.5 && h && close) {
    /* hurt: back behind the hub, away from the nearest invader, shooting on the way */
    const a = Math.atan2(h.y - close.y, h.x - close.x);
    tx = h.x + Math.cos(a) * 350; ty = h.y + Math.sin(a) * 350; lock = true; cap = 420;
  }
  else if (foe) { tx = foe.x; ty = foe.y; stand = 320; lock = true; cap = 380; }
  else if (fl.length) { const f = fl[0]; tx = f.x + f.vx; ty = f.y + f.vy; stand = 160; cap = 380; }
  else if (h && h.prog >= 1 && run.cargoUsed > 0) { tx = h.x; ty = h.y; cap = 150; }
  else {
    /* wait by the hub, out of any radiation cloud */
    let k = 0;
    while (k < 8 && NS.hazards.seasonAt(home.x + Math.cos(k * 0.785) * 420, home.y + Math.sin(k * 0.785) * 420) > 0) ++k;
    tx = home.x + Math.cos(k * 0.785) * (k ? 420 : 160); ty = home.y + Math.sin(k * 0.785) * (k ? 420 : 160); stand = 40;
  }
  point(tx, ty);
  const d = Math.hypot(tx - s.x, ty - s.y);
  const ux = (tx - s.x) / (d || 1), uy = (ty - s.y) / (d || 1);
  const closing = s.vx * ux + s.vy * uy, speed = Math.hypot(s.vx, s.vy);
  const want = Math.max(0, Math.min(cap, (d - stand) * 0.9));
  const brake = closing > want + 40 || speed > cap + 30;
  inp.keys.KeyS = brake;
  inp.rightDown = !brake && d > stand && closing < want;
  const aim = lock ? nearest(G.enemies.concat(G.pirates), s.x, s.y, o => !o.dormant, 650) : null;
  inp.keys.Space = !!aim;
  const fire = !!aim;
  for (let i = 0; i < NS.hardpoints.slots().length; ++i) {
    const on = !!NS.hardpoints.state().held[i];
    if (fire !== on) NS.hardpoints.trigger(i, fire);
  }
}

const PLAN = {
  pro: ['solar', 'solar', 'laser', 'laser', 'habitat', 'solar', 'flak', 'repairbay', 'tesla', 'laser', 'solar', 'stasis', 'habitat', 'flak', 'smelter', 'rig', 'tesla', 'solar', 'habitat',
    'laser', 'flak', 'solar', 'tesla', 'stasis', 'laser', 'flak'],
  weak: ['solar', 'laser', 'laser'],
};

/* the builder: found, then the first building of the order the outpost does not have yet;
   short of stock it orders the supply pack for what is missing */
function build(fights) {
  if (!G.base || G.cine) return;
  const b = G.base;
  if (!B.claimed()) {
    B.place('hub', b.site.hubX, b.site.hubY);
    return;
  }
  const h = B.hub();
  if (!h || h.prog < 1) return;
  /* sterilising at the first sign of the Bloom kills no one: a third of the staff dies only once it has taken hold */
  if (fights) for (const o of b.data.buildings)
    if ((o.inf || 0) > 0.01 && G.run.t - (o._ster || -99) > 3) { o._ster = G.run.t; B.sterilize(o); }
  /* the Lattice: the hub's purge pulse at the first corruption */
  if (fights && G.stats.emp && !(b.empCd > 0) && b.data.buildings.some(o => (o.cor || 0) > 0.05)) B.empPulse();
  /* crew for every post: hire while there is housing */
  if (fights && b.data.crew + 2 <= NS.colony.housing(b.data) && G.save.credits > 1500) B.recruit();
  /* the smelters' feed: iron ore while an operation wants bars */
  const op = NS.operation.def();
  if (fights && op && op.goals.some(g => g.stats && g.stats.indexOf('bars') >= 0) && (b.data.stock.ore.iron || 0) < 20 && NS.freighters.shipments() < 1) NS.freighters.order('iron');
  if (b.data.buildings.filter(o => o.prog < 1).length >= 2) return;
  const plan = fights ? PLAN.pro : PLAN.weak;
  const have = {};
  for (const o of b.data.buildings) have[o.type] = (have[o.type] || 0) + 1;
  const want = {};
  for (const type of plan) {
    want[type] = (want[type] || 0) + 1;
    if ((have[type] || 0) >= want[type]) continue;
    const spot = B.findSpot(type);
    if (!spot) continue;
    const r = B.place(type, spot.cx, spot.cy);
    if (r.ok) return;
    const miss = B.lack(NS.colony.buildCost(type, G.stats));
    if (miss && NS.freighters.shipments() < NS.supply.SHIP_MAX) {
      const ores = Object.assign({}, miss.ore, miss.bar);
      NS.freighters.order(ores.copper && !ores.iron ? 'copper' : ores.iron && !ores.copper && !ores.ice ? 'iron' : 'mix');
    }
    return;
  }
}

function play(op, fights, cap) {
  NS.trip.startTrip('career', 2, { op: op.id });
  for (let i = 0; i < 20 && G.cine; ++i) { H.run(NS, 30); NS.cinematics.skip(); }
  const trace = [];
  let t = 0, tick = 0;
  while (G.run && G.run.op && G.run.op.status === 'active' && t < cap) {
    pilot(fights);
    if (++tick % 20 === 0) build(fights);
    H.run(NS, 3);
    t += 3 / 60;
    if (G.cine && G.cine.kind !== 'docking') NS.cinematics.skip();
    if (!G.ship) break;
    if (G.run && G.run.op && trace.length < t) trace.push(G.run.op.pace.tension);
  }
  const o = G.run && G.run.op;
  const out = { id: op.id, mood: op.mood, won: !!o && o.status === 'won', why: o ? o.why : 'lost', time: Math.round(o ? o.t : t), waves: G.run ? G.run.waves : 0,
    built: G.base ? G.base.data.buildings.length : 0, peak: Math.max(0, ...trace), mean: trace.length ? trace.reduce((a, b) => a + b, 0) / trace.length : 0 };
  if (G.run) NS.trip.endTrip('dock');
  for (let i = 0; i < 10 && G.cine; ++i) NS.cinematics.skip();
  return out;
}

/* a pilot who has flown the first two belts: their operations cleared, credits put by */
function veteran(fights) {
  const s = G.save = NS.rules.freshSave();
  s.seenIntro = s.seenHelp = true;
  for (const z of ['kessler', 'amber']) for (const op of O.zoneOps(z)) O.finish(s, op, true, 60);
  s.licenses.push('amber', 'verdant');
  s.credits = 30000;
  s.stats.earned = 60000;
  s.unlocks.push('wing');
  if (fights) {
    s.hulls.push('wasp');
    s.hull = 'wasp';
    s.weapons.owned = { pulse: 1, flak: 1, missile: 1 };
    s.weapons.slots = ['pulse', 'missile', null];
    s.credits += 40000;
    for (const id of ['hull', 'hull', 'hull', 'hull', 'laser', 'laser', 'thrust']) NS.rules.buyUpgrade(s, id);
    s.credits = 30000;
    s.rd = 120;
    for (const id of ['f_shield', 'f_shield', 'f_turret', 'b_vaccine', 'b_vaccine', 'b_vaccine', 't_dmg', 't_dmg', 't_range', 'c_armor', 'c_build', 'b_firewall', 'b_emp']) NS.rules.buyNode(s, id);
  }
  NS.save.refreshStats();
}

function campaign(fights, label) {
  veteran(fights);
  const rows = [];
  for (const op of O.zoneOps('verdant')) {
    let r = play(op, fights, 900), tries = 1;
    while (!r.won && fights && tries < 3) { r = play(op, fights, 900); ++tries; }
    r.tries = tries;
    rows.push(r);
    if (process.env.FATE) console.log('  ' + op.id + ' ' + (r.won ? 'won' : 'lost ' + r.why) + ' built ' + r.built + ' hurt ' + JSON.stringify(hurtBy));
    for (const k in hurtBy) delete hurtBy[k];
    if (!r.won && fights) break;
  }
  console.log('\n' + label);
  console.log('op          mood  won  try  time  waves  built  peak  mean');
  for (const r of rows)
    console.log(r.id.padEnd(12) + r.mood.padEnd(6) + (r.won ? 'yes' : 'no').padEnd(5) + String(r.tries).padEnd(4) + String(r.time).padStart(5) + String(r.waves).padStart(7) +
      String(r.built).padStart(7) + r.peak.toFixed(2).padStart(6) + r.mean.toFixed(2).padStart(6));
  return rows;
}

const pro = campaign(true, 'Competent bot - Verdant Shoals');
const by = id => pro.find(r => r.id === id) || { mean: 0, peak: 0, won: false, tries: 9 };
check('the competent bot clears all eight Verdant operations (retries allowed)', pro.length === 8 && pro.every(r => r.won), JSON.stringify(pro.map(r => r.id + ':' + r.won + ':' + r.why)));
check('the Mothership opens the Crimson licence', O.licenceReady(G.save, 3));
check('the first two operations are won at the first try', by('v_found').tries === 1 && by('v_hold').tries === 1);
check('every operation brings waves', pro.every(r => r.waves >= 1));
check('the peaks run hotter than the start of the belt', by('v_split').mean > by('v_found').mean && by('v_mother').mean > by('v_found').mean);
check('the breather runs cooler than the operation after it', by('v_hold').mean < Math.max(by('v_rad').mean, by('v_bloom').mean, by('v_siege').mean) + 0.02);

const weak = campaign(false, 'Weak bot - Verdant Shoals');
const wby = id => weak.find(r => r.id === id) || { won: false };
check('a bot that never fights clears fewer operations than the competent one', weak.filter(r => r.won).length < pro.filter(r => r.won).length);
check('a bot that never fights nor builds a defence cannot hold the peaks', !wby('v_split').won && !wby('v_mother').won);
check('a bot that lets the outbreak run cannot end it', !wby('v_bloom').won);

done();
