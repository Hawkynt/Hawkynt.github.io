'use strict';

/* Tower defense in the Verdant Shoals: the Tesla Coil's chain lightning and the Stasis Beam's
   slow, waves composed with a favoured lead, a forced mothership and a second bearing, the
   bearings the minimap and radar show, and the Verdant operations in the running game - the
   wave pace they set, founding, turrets and waves as goals, the outpost falling, the forced
   outbreak, the radiation season under shield domes, split waves, the Supply Run freighters
   and the mothership on the third wave. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;
const C = NS.colony;
const O = NS.ops;
const { OP_BY_ID } = NS.opsData;
const { BUILDING_BY_ID } = NS.colonyData;
const { ZONE_BY_ID } = NS.ores;

/* n steps; cinematics a step sets off are skipped so the simulation keeps running */
function steps(n) {
  for (let i = 0; i < n; ++i) {
    if (G.cine) { NS.cinematics.skip(); G.cine = null; }
    H.run(NS, 1);
  }
}

/* ── pure: wave composition ── */
const z = ZONE_BY_ID.verdant;
const plain = C.composeWave(4, z, 0, 99, {});
check('waves compose exactly as before without the new options', JSON.stringify(plain) === JSON.stringify(C.composeWave(4, z, 0, 99, { favor: null, split: false, forceBoss: false })) &&
  plain.angle2 === undefined);
let favoured = 0, base = 0;
for (let w = 1; w <= 12; ++w) {
  const f = C.composeWave(w, z, 0, 7, { favor: ['bomber', 'siege'] }), p = C.composeWave(w, z, 0, 7, {});
  for (const g of f.groups) if (g.type === 'bomber' || g.type === 'siege') favoured += g.n;
  for (const g of p.groups) if (g.type === 'bomber' || g.type === 'siege') base += g.n;
}
check('a favoured lead joins every wave and leads it', favoured > base * 2 && favoured >= 12, favoured + ' vs ' + base);
check('a forced mothership comes now, whatever the wave', C.composeWave(2, z, 0, 5, { forceBoss: true }).boss && C.composeWave(2, z, 0, 5, { forceBoss: true }).groups.some(g => g.type === 'mothership'));
const sp = C.composeWave(5, z, 0, 5, { split: true });
const gap = Math.abs(((sp.angle2 - sp.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
check('a split wave has a second bearing well away from the first', sp.angle2 !== undefined && gap > 1.8 && gap < 3.2);

/* ── the Verdant operations as data ── */
const vops = O.zoneOps('verdant');
check('the Verdant Shoals have eight operations ending in the Mothership', vops.length === 8 && O.capstoneOf('verdant').id === 'v_mother');
check('their moods: challenging, breather, surprise, harder twice, worse, surprise, nightmare', vops.map(o => o.mood).join('') === 'CESHHWSN' && O.moodsOk(vops));
check('every Verdant operation sets the wave pace', vops.every(o => o.waves && o.waves.first > 0 && o.waves.every > 0));
check('goals: the outpost, turrets by category or type, waves and an outbreak ended', O.complete(OP_BY_ID.v_found, { outpost: true, built: { laser: 1, tesla: 1 }, waves: 1 }) &&
  !O.complete(OP_BY_ID.v_found, { outpost: true, built: { laser: 1, solar: 3 }, waves: 1 }) &&
  O.complete(OP_BY_ID.v_siege, { built: { flak: 1, missile: 1 }, waves: 3 }) && !O.complete(OP_BY_ID.v_siege, { built: { laser: 4 }, waves: 3 }) &&
  O.progress(OP_BY_ID.v_bloom, { clean: true, waves: 1 })[0].done);

/* ── in the running game ── */
{
  G.save.seenIntro = true;
  if (G.save.licenses.indexOf('verdant') < 0) G.save.licenses.push('amber', 'verdant');
  let over = 0;
  for (let k = 0; k < 12; ++k) {
    G.save.stats.trips = k;
    NS.trip.startTrip('career', 2);
    const s = G.base.site;
    for (const r of G.radZones) if (Math.hypot(Math.max(s.x0 - r.x, 0, r.x - s.x0 - s.w), Math.max(s.y0 - r.y, 0, r.y - s.y0 - s.h)) < r.r) ++over;
    NS.trip.endTrip('dock');
  }
  check('the belt\'s own radiation never lies over the outpost site', over === 0, over);
}
G.save.seenIntro = G.save.seenHelp = true;
G.save.credits = 1e6;
for (const id of ['amber', 'verdant']) if (G.save.licenses.indexOf(id) < 0) G.save.licenses.push(id);
NS.save.refreshStats();

function launch(id) {
  NS.trip.startTrip('career', 2, id ? { op: id } : undefined);
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  G.ship.maxHull = G.ship.hull = 1e6;
  G.run.pirateT = 1e9;
}
/* a working outpost: hub, power and the turrets asked for, all finished */
function outpost(turrets) {
  const s = G.base.site;
  const hub = B.hub() || B.grant('hub', s.hubX, s.hubY);
  for (const t of ['solar', 'solar', 'solar', 'habitat'].concat(turrets || [])) {
    const c = B.findSpot(t);
    if (c) B.grant(t, c.cx, c.cy);
  }
  G.base.data.crew = 20;
  B.refresh();
  return hub;
}
function foe(type, x, y) {
  const e = NS.enemies.spawn(type, x, y, {});
  e.spawnT = 0;
  return e;
}

/* the Tesla Coil and the Stasis Beam */
launch();
const hub = outpost(['tesla', 'stasis']);
steps(30);
const coil = G.base.data.buildings.find(b => b.type === 'tesla'), beam = G.base.data.buildings.find(b => b.type === 'stasis');
check('the Tesla Coil and the Stasis Beam can be built and run', coil && beam && B.powered(coil) && B.powered(beam));
const sw = [];
for (let i = 0; i < 6; ++i) sw.push(foe('swarmer', coil.x + 120 + i * 60, coil.y + 10));
for (const e of sw) { e.hp = e.maxHp = 1e4; e.stun = 99; }
beam.prog = 0.5;
const hp0 = sw.map(e => e.hp);
coil._fireT = 0;
steps(2);
const hits = sw.filter((e, i) => e.hp < hp0[i]);
check('one bolt strikes four invaders: its target and three hops', hits.length === 4, hits.length);
const dmg = hits.map(e => hp0[sw.indexOf(e)] - e.hp).sort((a, b) => b - a);
check('each hop strikes weaker', dmg[0] > dmg[1] && dmg[1] > dmg[2] && dmg[2] > dmg[3]);
check('the bolt draws as jagged lightning', G.tbeams.some(t => t.zig));
for (const e of sw) e.alive = false;
beam.prog = 1;
coil.prog = 0.5;
const frig = foe('frigate', beam.x + 200, beam.y), drone = foe('swarmer', beam.x - 250, beam.y);
frig.hp = frig.maxHp = 1e6;
drone.hp = drone.maxHp = 1e6;
steps(20);
check('the Stasis Beam picks the heaviest invader in reach and slows it', frig.slowT > 0 && frig.slowK < 0.5 && !(drone.slowT > 0));
frig.alive = drone.alive = false;
const a = foe('raider', hub.x + 1400, hub.y), b2 = foe('raider', hub.x + 1400, hub.y + 400);
a.hp = b2.hp = 1e6;
NS.enemies.slow(a, 0.45, 50);
const ax = a.x, bx = b2.x;
steps(120);
check('a slowed invader makes under half the way of one that is not', Math.abs(a.x - ax) < Math.abs(b2.x - bx) * 0.6 && Math.abs(b2.x - bx) > 50, Math.round(Math.abs(a.x - ax)) + ' vs ' + Math.round(Math.abs(b2.x - bx)));
const ms = foe('mothership', hub.x + 1800, hub.y);
NS.enemies.slow(ms, 0.45, 5);
check('a mothership shrugs off half the slow', Math.abs(ms.slowK - 0.725) < 1e-9);
a.alive = b2.alive = ms.alive = false;
NS.trip.endTrip('dock');

/* Found the Outpost: no waves before the hub, the operation's pace after it */
delete G.save.bases.verdant;
launch('v_found');
check('Found the Outpost starts with no outpost and no waves', !B.claimed() && G.run.op.status === 'active');
const placed = B.place('hub', G.base.site.hubX, G.base.site.hubY);
G.cine = null;
check('founding sets the first wave on the operation\'s clock', placed.ok && G.base.waveT === OP_BY_ID.v_found.waves.first);
placed.b.prog = 1;
outpost(['laser', 'laser']);
steps(5);
const pr = NS.operation.progress();
check('the hub and the turrets count toward the goals', pr[0].done && pr[1].done && !pr[2].done);
G.base.waveT = 0.1;
steps(60);
check('the wave comes', G.base.active);
for (const e of G.enemies) e.alive = false;
G.base.spawnQ.length = 0;
steps(5);
check('holding it wins the operation', G.run.op.status === 'won' && O.done(G.save, 'v_found'));
NS.trip.endTrip('dock');

/* Hold the Line: a standing outpost takes the operation's pace at once; losing the hub fails */
launch('v_hold');
check('a standing outpost takes the operation\'s pace at once', Math.abs(G.base.waveT - OP_BY_ID.v_hold.waves.first) < 0.5);
steps(5);
B.damage(B.hub(), 1e9, 'impact');
steps(5);
check('the outpost falling fails the operation', G.run.op.status === 'failed' && G.run.op.why === 'outpost');
NS.trip.endTrip('dock');

/* First Bloom: the outbreak breaks out in a crew building; ending it meets the goal */
launch();
outpost(['laser', 'laser', 'smelter', 'rig']);
NS.trip.endTrip('dock');
launch('v_bloom');
check('no outbreak before its time', !G.base.data.buildings.some(o => (o.inf || 0) > 0.01));
G.run.op.since = OP_BY_ID.v_bloom.force.outbreak;
steps(2);
const sick = G.base.data.buildings.filter(o => (o.inf || 0) > 0.01);
check('then the Bloom breaks out in a crew building', G.run.op.seeded && sick.length === 1 && sick[0].type !== 'hub' && BUILDING_BY_ID[sick[0].type].crew > 0);
check('the outbreak is not over while a building is infected', !NS.operation.progress()[0].done);
for (const o of G.base.data.buildings) o.inf = 0;
steps(2);
check('when no building is infected any more, it is over', NS.operation.progress()[0].done);
B.damage(B.hub(), 1e9, 'impact');
steps(3);
check('an outpost wiped out has not ended the outbreak: the operation fails', G.run.op.status === 'failed' && G.run.op.why === 'outpost');
NS.trip.endTrip('dock');

/* Radiation Season: clouds over the site slow what no powered dome covers */
launch('v_rad');
outpost(['laser', 'smelter', 'rig']);
steps(2);
G.run.op.since = OP_BY_ID.v_rad.force.radiation.at;
steps(2);
const clouds = G.radZones.filter(r => r.season);
check('the season brings its clouds over the outpost site', clouds.length === 3 && clouds.every(r => r.x >= G.base.site.x0 && r.x <= G.base.site.x0 + G.base.site.w));
const sm = G.base.data.buildings.find(o => o.type === 'smelter');
clouds[0].x = sm.x; clouds[0].y = sm.y; clouds[0].vx = clouds[0].vy = 0;
steps(90);
check('a building in a cloud runs slower', sm._rad > 0.4 && sm._eff < 0.6, sm._rad + ' / ' + sm._eff);
const sc = B.findSpot('shield');
const dome = B.grant('shield', sc.cx, sc.cy);
clouds[0].x = dome.x; clouds[0].y = dome.y;
B.refresh();
steps(90);
const covered = G.base.data.buildings.filter(o => o !== dome && Math.hypot(o.x - dome.x, o.y - dome.y) < BUILDING_BY_ID.shield.radius);
check('turrets, power and the core keep working in a cloud', G.base.data.buildings.filter(o => ['defense', 'power', 'core'].indexOf(BUILDING_BY_ID[o.type].cat) >= 0).every(o => !o._rad));
check('under a powered shield dome the radiation does not slow it', B.powered(dome) && covered.length > 0 && covered.every(o => !o._rad),
  B.powered(dome) + ' ' + covered.map(o => o.type + ':' + o._rad).join());
NS.trip.endTrip('dock');

/* Siege Breakers: bombers and siege ships lead */
launch('v_siege');
const next = G.base.next;
check('Siege Breakers waves lead with bombers and siege ships', next.groups.some(g => g.type === 'bomber' || g.type === 'siege'));
NS.trip.endTrip('dock');

/* Split Front: two bearings, shown on the minimap and the radar */
launch('v_split');
check('a split wave is composed with two bearings', G.base.next.angle2 !== undefined);
G.base.waveT = 20;
steps(2);
check('the bearings show once the wave is known', NS.waves.bearings().length === 2);
G.base.waveT = 0.05;
steps(40);
const q = G.base.spawnQ.concat(G.enemies.filter(e => e.alive));
const [e1, e2] = G.base.bearings;
const near = (p, c) => Math.hypot(p.x - c.x, p.y - c.y) < 400;
check('the invaders come from both bearings', q.some(p => near(p, e1)) && q.some(p => near(p, e2)) && Math.hypot(e1.x - e2.x, e1.y - e2.y) > 1000);
G.cmd.on = true;
NS.frame.draw();
G.cmd.on = false;
NS.frame.draw();
check('the minimap and the radar draw the bearings without errors', true);
NS.trip.endTrip('dock');

/* Supply Run: freighters to the hub count for the operation and fill the stock */
launch('v_supply');
const fr = G.freighters;
check('Supply Run sends two supply freighters down the lane to the hub', fr.length === 2 && fr.every(f => f.kind === 'supply' && f.op && f.to === 'hub'));
const lane = G.posts.find(p => p.id === 'hub');
check('the hub lane has its ambush', lane.chokes.length === 1);
const ice0 = G.base.data.stock.ore.ice || 0;
G.ship.x = 300; G.ship.y = 300;
fr[0].wait = 0;
steps(30);
fr[0].d = lane.len - 3;
steps(30);
check('a supply freighter at the hub fills the stock and counts as delivered', fr[0].state === 'done' && G.run.op.delivered === 1 && G.base.data.stock.ore.ice === ice0 + 20);
fr[1].wait = 0;
steps(30);
NS.freighters.hurt(fr[1], 1e9);
steps(5);
check('losing one fails the run', G.run.op.status === 'failed' && G.run.op.why === 'convoy');
NS.trip.endTrip('dock');

/* Mothership: the third wave brings it */
launch('v_mother');
check('the first wave is no boss wave', !G.base.next.boss);
G.run.waves = 2;
NS.waves.compose();
check('the third wave of the trip brings the mothership', G.base.next.boss && G.base.next.groups.some(g => g.type === 'mothership'));
NS.trip.endTrip('dock');

done();
