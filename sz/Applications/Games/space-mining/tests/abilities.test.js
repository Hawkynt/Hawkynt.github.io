'use strict';

/* Unit abilities in the running game: the six ability craft and the licences they need, the
   Herder pulling rocks into a clump, the Minelayer's ring and its limit, the Aegis bubble
   soaking damage for craft and the ship, the Phantom's cloak losing pursuers, the Lancer's
   overcharged rail piercing a line, the Bulwark's barrage, auto-cast and its toggle, T and the
   panel buttons - and, played out, what each is worth: craft with their ability against the
   same craft without it. */
const H = require('./harness');
/* a fixed clock and seed: every run plays the same fights */
Date.now = () => 1762300000000;
let seed = 2024;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;
const AB = NS.abilities;
const { UNITS, UNIT_BY_ID, ABILITIES } = NS.fleetData;
const { BUILDING_BY_ID } = NS.colonyData;

function steps(n) {
  for (let i = 0; i < n; ++i) {
    if (G.cine) { NS.cinematics.skip(); G.cine = null; }
    H.run(NS, 1);
  }
}

/* ── data ── */
const ab = UNITS.filter(u => u.ability);
check('six craft carry an ability, each with its own', ab.length === 6 && new Set(ab.map(u => u.ability)).size === 6 && ab.every(u => ABILITIES[u.ability]));
check('every ability craft comes from a factory that makes it', ab.every(u => BUILDING_BY_ID[u.from].makes.indexOf(u.id) >= 0));
check('the Herder, Minelayer and Aegis come with the Verdant licence, the rest with the Crimson Maw',
  ['herder', 'minelayer', 'aegis'].every(id => UNIT_BY_ID[id].licence === 'verdant') && ['phantom', 'lancer', 'bulwark'].every(id => UNIT_BY_ID[id].licence === 'crimson'));

/* ── a quiet outpost to play in ── */
G.save.seenIntro = G.save.seenHelp = true;
G.save.credits = 1e6;
G.save.licenses.push('amber', 'verdant');
NS.save.refreshStats();
NS.trip.startTrip('career', 2);
NS.cinematics.skip();
G.cine = null;
G.screen = 'playing';
G.run.pirateT = 1e9;
G.base.waveT = 1e9;
G.ship.maxHull = G.ship.hull = 1e6;
const s0 = G.base.site;
const hub = B.grant('hub', s0.hubX, s0.hubY);
G.save.bases.verdant = G.base.data;
for (const t of ['solar', 'solar', 'solar', 'solar', 'habitat', 'habitat', 'dronefactory', 'shipyard']) { const c = B.findSpot(t); if (c) B.grant(t, c.cx, c.cy); }
G.base.data.crew = 30;
G.base.data.stock.bar = { iron: 200, titanium: 200, copper: 50 };
G.base.data.stock.ore = { copper: 200, iron: 200 };
G.base.data.stock.comp = { alloy: 50, circuit: 50 };
B.refresh();
steps(20);
const yard = G.base.data.buildings.find(o => o.type === 'shipyard'), drones = G.base.data.buildings.find(o => o.type === 'dronefactory');
check('the licensed craft queue: Aegis and Herder with the Verdant licence', B.queueUnit(yard, 'aegis').ok && B.queueUnit(drones, 'herder').ok);
const lock = B.queueUnit(yard, 'lancer');
check('the Lancer waits for the Crimson licence', !lock.ok && /Crimson Maw licence/.test(lock.reason));
G.save.licenses.push('crimson');
check('and queues once it is bought', B.queueUnit(yard, 'lancer').ok);
yard.queue.length = 0; drones.queue.length = 0;

/* a clear field away from the outpost to test in */
const fx = hub.x + 1600 < G.world.w - 300 ? hub.x + 1600 : hub.x - 1600, fy = hub.y;
function clearField() {
  for (const r of G.rocks) if (Math.hypot(r.x - fx, r.y - fy) < 1200) r.alive = false;
  NS.grid.compact(G.rocks);
  NS.asteroids.rebuildGrid();
  for (const e of G.enemies) if (e.wave !== undefined || e.type !== 'hive') e.alive = false;
  for (const u of G.units) u.alive = false;
  steps(1);
  AB.clear();
}
const unit = (type, dx, dy) => { const u = NS.units.spawn(type, fx + (dx || 0), fy + (dy || 0), 'player'); u.orders.length = 0; u.auto = false; return u; };
const foe = (type, dx, dy, opts) => { const e = NS.enemies.spawn(type, fx + dx, fy + (dy || 0), Object.assign({ wave: 99 }, opts || {})); e.spawnT = 0; return e; };
G.ship.x = hub.x; G.ship.y = hub.y - 400;

/* Herder */
clearField();
const rocks = [];
for (let i = 0; i < 10; ++i) {
  const r = NS.asteroids.restoreRock('rock', fx + 300 + Math.cos(i) * 240, fy + Math.sin(i) * 240, 1, null, 0);
  r.vx = r.vy = 0;
  G.rocks.push(r);
  rocks.push(r);
}
NS.asteroids.rebuildGrid();
const tug = unit('herder');
const spread = () => rocks.reduce((a, r) => a + Math.hypot(r.x - (fx + 300), r.y - fy), 0) / rocks.length;
const before = spread();
check('the Herder casts Herd at a point', AB.cast(tug, { x: fx + 300, y: fy }) && AB.state().herds.length === 1 && AB.state().herds[0].rocks.length >= 8);
steps(60 * 5);
check('the loose rocks round the point end in a tight clump', spread() < before * 0.5, Math.round(before) + ' -> ' + Math.round(spread()));
check('the Herder does not herd on its own', ABILITIES.herd.auto === false);
check('then it recharges', !AB.ready(tug) && tug.abCd > 0);

/* Minelayer */
clearField();
const ml = unit('minelayer');
AB.cast(ml);
check('a mine ring: six mines round the Minelayer', AB.state().mines.length === 6 && AB.state().mines.every(m => Math.abs(Math.hypot(m.x - ml.x, m.y - ml.y) - ABILITIES.mines.ring) < 2));
for (let k = 0; k < 3; ++k) { ml.abCd = 0; AB.cast(ml); }
check('never more than eighteen of its own', AB.state().mines.filter(m => !m.dead).length === 18);
steps(1);
const m0 = AB.state().mines[AB.state().mines.length - 1];
const sw = foe('swarmer', m0.x - fx + 5, m0.y - fy);
sw.hp = sw.maxHp = 40;
sw.stun = 99;
steps(2);
check('a mine waits until it is armed', sw.alive && !m0.dead);
steps(70);
check('then whatever touches it is blown up', !sw.alive || sw.hp < 40);
const raider = foe('raider', AB.state().mines[3].x - fx, AB.state().mines[3].y - fy);
raider.hp = raider.maxHp = 1e4;
steps(5);
check('and stunned if it survives', raider.stun > 0);
raider.alive = false;

/* Aegis */
clearField();
const ag = unit('aegis'), ft = unit('fighter', 60);
AB.cast(ag);
const hp0 = ft.hp;
NS.units.damage(ft, 300, null);
check('the bubble soaks the damage to a craft inside it', ft.hp === hp0 && AB.state().bubbles[0].hp === ABILITIES.bubble.hp - 300);
NS.units.damage(ft, 500, null);
check('until it breaks: the rest goes through', ft.hp === hp0 - 100);
steps(2);
check('a broken bubble is gone', AB.state().bubbles.length === 0);
ag.abCd = 0;
G.ship.x = ag.x + 50; G.ship.y = ag.y;
AB.cast(ag);
const sh0 = G.ship.hull, shield0 = G.ship.shield;
NS.ship.hurt(100, 'bolt');
check('it covers your ship too', G.ship.hull === sh0 && G.ship.shield === shield0);
G.ship.x = hub.x; G.ship.y = hub.y - 400;

/* Phantom */
clearField();
const ph = unit('phantom'), ally = unit('fighter', 80), far = unit('fighter', 900);
AB.cast(ph);
check('the cloak covers the Phantom and the allies round it, not those far away', ph.cloakT > 0 && ally.cloakT > 0 && !(far.cloakT > 0));
check('invaders cannot pick a cloaked craft', NS.units.nearestPlayer(ph.x, ph.y, 300, false) === null);
const hunter = foe('raider', 200, 0);
hunter.target = ally;
steps(2);
check('a pursuer loses it', hunter.target !== ally && hunter.target !== ph);
steps(60 * 9);
check('the cloak wears off', !(ally.cloakT > 0));
hunter.alive = false;

/* Lancer */
clearField();
const ln = unit('lancer');
const line = [300, 380, 460].map(d => { const e = foe('frigate', d, 0); e.hp = e.maxHp = 1e4; e.shield = e.maxShield = 0; e.stun = 99; return e; });
steps(1);
AB.cast(ln);
check('Overcharge charges the next shot', ln.charged);
const lh = line.map(e => e.hp);
const hits = AB.rail(ln, line[0], ln.dmg, 'player');
check('the charged rail pierces everything on the line', hits === 3 && line.every((e, i) => e.hp < lh[i]) && !ln.charged);
const one = lh[0] - line[0].hp;
const plain = line[1].hp;
NS.enemies.hitTarget(line[1], ln.dmg, 'player', ln, 'kinetic');
check('at twice the damage of a plain shot', Math.abs(one - (plain - line[1].hp) * 2) < 1);

/* Bulwark */
clearField();
const bw = unit('bulwark');
const big = foe('siege', 450, 0);
big.hp = big.maxHp = 1e5;
big.stun = 99;
bw.target = big;
AB.cast(bw);
check('Barrage queues six shells on the target area', AB.state().barrages.length === 6 && AB.state().barrages.every(b => Math.hypot(b.x - big.x, b.y - big.y) < ABILITIES.barrage.spread * 1.5));
const bh = big.hp;
steps(60 * 5);
check('and they land on it', big.hp < bh && AB.state().barrages.length === 0);

/* auto-cast */
clearField();
const ml2 = NS.units.spawn('minelayer', fx, fy, 'player');
ml2.orders.length = 0;
check('auto-cast is on by default for combat abilities', AB.autoOn(ml2));
foe('raider', 300, 0).stun = 99;
steps(60);
check('a Minelayer drops its ring when invaders come close', AB.state().mines.length === 6);
const ml3 = unit('minelayer', 0, 200);
steps(60);
check('with auto-cast off it waits to be told', !AB.state().mines.some(m => m.u === ml3));

/* T and the panel */
clearField();
const sel = [unit('aegis'), unit('aegis', 40), unit('fighter', 80)];
NS.command.select(sel, false);
G.cmd.on = true;
NS.frame.draw();
check('the panel shows the ability with its auto toggle', G.hitAreas.some(a => a.id === 'ab_aegis') && G.hitAreas.some(a => a.id === 'abauto_aegis'));
env.listeners.keydown.forEach(f => f({ code: 'KeyT', key: 't', preventDefault() {} }));
check('T casts every ready ability in the selection', AB.state().bubbles.length === 2 && sel.slice(0, 2).every(u => u.abCd > 0));
G.cmd.selB = yard;
NS.frame.draw();
check('the shipyard offers the new craft', ['aegis', 'phantom', 'lancer', 'bulwark'].every(id => G.hitAreas.some(a => a.id === 'mk_' + id)));
G.cmd.selB = null;
G.cmd.on = false;
steps(30);
NS.frame.draw();
check('the abilities draw without errors', true);

/* ── played out: with the ability against without it ── */
/* the summed score of six runs, so one lucky fight does not decide */
function duel(setup, secs) {
  let total = 0;
  for (let k = 0; k < 6; ++k) {
    clearField();
    const r = setup();
    steps(60 * secs);
    total += r.score();
  }
  return total;
}
/* three fighters under an Aegis against raiders, bubble on and off */
const aegisFight = (on) => duel(() => {
  const g = unit('aegis', -60), fs = [unit('fighter', 0, -30), unit('fighter'), unit('fighter', 0, 30)];
  g.auto = on;
  const rs = [];
  for (let i = 0; i < 8; ++i) rs.push(foe('raider', 380, -140 + i * 40));
  /* what is left of the fighters, plus a hundred for every raider down */
  return { score: () => fs.filter(f => f.alive).reduce((a, f) => a + f.hp, 0) + 100 * rs.filter(e => !e.alive).length };
}, 30);
const withBubble = aegisFight(true), noBubble = aegisFight(false);
check('fighters under an Aegis fare better against raiders', withBubble > noBubble * 1.2, Math.round(withBubble) + ' vs ' + Math.round(noBubble));
/* a swarm on a Minelayer and two fighters, mines on and off */
const mineFight = (on) => duel(() => {
  const m = unit('minelayer'), fs = [unit('fighter', -40), unit('fighter', 40)];
  m.auto = on;
  const swarm = [];
  for (let i = 0; i < 18; ++i) swarm.push(foe('swarmer', 520 + (i % 6) * 20, -60 + Math.floor(i / 6) * 40));
  return { score: () => swarm.filter(e => !e.alive).length };
}, 8);
const mined = mineFight(true), unmined = mineFight(false);
check('a Minelayer\'s rings kill more of a swarm', mined > unmined, mined + ' vs ' + unmined);
/* two Lancers against a line of frigates, overcharge on and off */
const lanceFight = (on) => duel(() => {
  const ls = [unit('lancer', 0, -20), unit('lancer', 0, 20)];
  for (const l of ls) l.auto = on;
  const row = [];
  for (let i = 0; i < 4; ++i) { const e = foe('frigate', 420 + i * 70, 0); e.stun = 99; row.push(e); }
  return { score: () => row.reduce((a, e) => a + (e.alive ? e.maxHp - e.hp + (e.maxShield - e.shield) : e.maxHp + e.maxShield), 0) };
}, 12);
const lanced = lanceFight(true), unlanced = lanceFight(false);
console.log('\nAbility duels (six runs each, ability on vs off): Aegis ' + Math.round(withBubble) + ' vs ' + Math.round(noBubble) + ', Minelayer kills ' + mined + ' vs ' + unmined +
  ', Lancer damage ' + Math.round(lanced) + ' vs ' + Math.round(unlanced));
check('Lancers that overcharge do more damage to a line of frigates', lanced > unlanced * 1.15, Math.round(lanced) + ' vs ' + Math.round(unlanced));

done();
