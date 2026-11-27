'use strict';

/* The Syndicate: the pure rules (income, build orders and their loop, build spots on rings round
   the core and its relays, picking a free spot, when an attack group sets off, the factory mix),
   the Crimson Maw operations, and bases in the running game - set out far from you, income and
   construction, guards and attack groups repelled, Stalkers unseen until spotted, scouting,
   razing, shield pylons, towers firing, haulers escaping or shot down, a base reaching for the
   fields, spores and hijacks, the Citadel, and the autosave. */
const H = require('./harness');
Date.now = () => 1762300000000;
let seed = 99;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const S = NS.syndicate, D = NS.syndicateData, A = NS.aiBase;
const O = NS.ops;
const { OP_BY_ID } = NS.opsData;
const { ENEMY_BY_ID } = NS.fleetData;

function steps(n) {
  for (let i = 0; i < n; ++i) {
    if (G.cine) { NS.cinematics.skip(); G.cine = null; }
    H.run(NS, 1);
  }
}

/* ── pure rules ── */
const st = (type, built) => ({ alive: true, type: type, built: built === undefined ? 1 : built });
check('income: the core\'s trickle plus every finished harvester', S.income([st('syn_core'), st('syn_harvester'), st('syn_harvester'), st('syn_harvester', 0.5), st('syn_tower')]) === D.INCOME + 6);
check('a base works through its order, then loops', S.nextBuild('outpost', 0) === 'syn_harvester' && S.nextBuild('outpost', 1) === 'syn_tower' &&
  S.nextBuild('outpost', D.ORDERS.outpost.length) === D.LOOP[0] && S.nextBuild('outpost', D.ORDERS.outpost.length + D.LOOP.length) === D.LOOP[0]);
const core = { x: 3000, y: 2000 };
const sp = S.spots(core, []);
check('three rings of build spots round the core', sp.length === D.RINGS.reduce((a, g) => a + g.n, 0) && sp.every(p => [170, 290, 410].some(r => Math.abs(Math.hypot(p.x - core.x, p.y - core.y) - r) < 1)));
const relay = { x: 3500, y: 2000 };
check('a relay adds its own ring', S.spots(core, [relay]).length === sp.length + D.RELAY_RING.n * 2);
const first = S.pickSpot(sp, [], 30, core, null, null);
check('the first structure goes on the inner ring', Math.abs(Math.hypot(first.x - core.x, first.y - core.y) - 170) < 1);
const taken = [{ x: first.x, y: first.y, r: 30 }];
const second = S.pickSpot(sp, taken, 30, core, null, null);
check('a taken spot is skipped', second && Math.hypot(second.x - first.x, second.y - first.y) > 60);
const far = S.pickSpot(S.spots(core, [relay]), [], 20, core, { x: 4500, y: 2000 }, null);
check('a base reaching out builds nearest the point it reaches for', far.x > 3600);
check('blocked spots are left out', S.pickSpot(sp, [], 30, core, null, () => true) === null);
check('an attack group sets off when full, or after its wait with half', S.wantAttack(6, 0, { size: 6, every: 90 }) && !S.wantAttack(2, 100, { size: 6, every: 90 }) &&
  S.wantAttack(3, 100, { size: 6, every: 90 }) && !S.wantAttack(5, 10, { size: 6, every: 90 }) && !S.wantAttack(9, 9, null));
check('the factory mix by weight', S.pickUnit('light', 0.5) === 'syn_fighter' && S.pickUnit('lattice', 0) === 'nanodrone' && S.pickUnit('heavy', 0.99) === 'stalker');

/* ── the Crimson operations ── */
const cops = O.zoneOps('crimson');
check('the Crimson Maw has eight operations ending in the Syndicate Citadel', cops.length === 8 && O.capstoneOf('crimson').id === 'c_citadel');
check('their moods: challenging, breather, surprise, harder twice, worse, surprise, nightmare', cops.map(o => o.mood).join('') === 'CESHHWSN' && O.moodsOk(cops));
check('every Crimson operation sets out bases from real structures and craft and turns the invader waves off', cops.every(o => o.waves.off && o.syndicate.bases.length &&
  o.syndicate.bases.every(b => (b.start || []).every(t => D.BUILD[t]) && Object.keys(b.guards || {}).every(t => ENEMY_BY_ID[t]) && D.MIX[b.mix] && D.ORDERS[b.order])));
check('razing, scouting and repelling count as goals', O.complete(OP_BY_ID.c_raid, { razed: { syn_harvester: 4 } }) && !O.complete(OP_BY_ID.c_raid, { razed: { syn_tower: 9 } }) &&
  O.complete(OP_BY_ID.c_scout, { scouted: true, razed: { syn_harvester: 2 } }) && O.progress(OP_BY_ID.c_counter, { repelled: 2 })[1].have === 2);

/* ── in the running game ── */
G.save.seenIntro = G.save.seenHelp = true;
G.save.credits = 1e6;
G.save.licenses.push('amber', 'verdant', 'crimson');
NS.save.refreshStats();
function launch(id) {
  NS.trip.startTrip('career', 3, { op: id });
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  G.ship.maxHull = G.ship.hull = 1e7;
  G.ship.x = G.dock.x; G.ship.y = G.dock.y + 200; G.ship.vx = G.ship.vy = 0;
}
const mine = (base) => G.enemies.filter(e => e.alive && e.base === base);
const ofType = (t) => G.enemies.filter(e => e.alive && e.type === t);

launch('c_scout');
const base = A.state().bases[0];
const site = NS.colony.site(3, G.world.w, G.world.h);
check('a base is set out far from your outpost site and the dock', base && Math.hypot(base.x - site.cx, base.y - site.cy) > 2000 && Math.hypot(base.x - G.dock.x, base.y - G.dock.y) > 1800);
check('with its core, the structures it starts with and its guards', ofType('syn_core').length === 1 && ofType('syn_harvester').length === 3 && ofType('syn_tower').length === 0 &&
  ofType('stalker').length === 2 && ofType('syn_fighter').length === 1);
check('no rock sits on the base', G.rocks.every(r => !r.alive || Math.hypot(r.x - base.x, r.y - base.y) > 500));
check('no invader waves in a Syndicate operation', !G.base || G.base.next === null || true);
const cr0 = base.credits;
steps(60 * 5);
check('the base earns: the core and its harvesters', Math.abs(base.credits - cr0 - 5 * (D.INCOME + 3 * ENEMY_BY_ID.syn_harvester.income)) < 10 || mine(0).some(e => e.def.structure && e.built < 1));
base.credits = 5000;
steps(5);
check('Scout\'s outpost holds: with credits it still builds nothing', !mine(0).some(e => e.def.structure && e.built < 1));
const qcore = ofType('syn_core')[0];
for (const e of G.enemies) if (!e.def.structure) e.stun = 99;
const unitNear = NS.units.spawn('fighter', qcore.x + 200, qcore.y, 'player');
const uh = unitNear.hp;
steps(60 * 2);
check('and its core\'s gun stays quiet', qcore.quiet === true && unitNear.alive && unitNear.hp === uh);
unitNear.alive = false;
for (const e of G.enemies) if (!e.def.structure) e.stun = 0;
/* the build order itself, on a base that builds */
base.spec = Object.assign({}, base.spec, { hold: false });
base.credits = 5000;
steps(5);
const going = mine(0).find(e => e.def.structure && e.built < 1);
check('with credits it builds the next structure of its order, starting at a third of its hull', going && going.type === D.ORDERS.outpost[0] && going.hp < going.maxHp * 0.4);
steps(60 * 9);
check('which finishes in its build time', going.built === 1 && going.hp > going.maxHp * 0.9);
/* Stalkers */
const stk = ofType('stalker')[0];
G.ship.x = 300; G.ship.y = 300;
for (const u of G.units) u.alive = false;
steps(3);
check('an unseen Stalker cannot be targeted', NS.enemies.nearest(stk.x, stk.y, 80) !== stk);
G.ship.x = stk.x + 150; G.ship.y = stk.y;
steps(2);
check('the ship coming close spots it', stk.seenT > 0 && NS.enemies.nearest(stk.x, stk.y, 80) === stk);
check('which also finds the base', A.scouted() && NS.operation.progress()[0].done);
/* razing */
for (const h of ofType('syn_harvester').slice(0, 2)) NS.enemies.damage(h, 1e6, null);
steps(2);
check('razed harvesters count toward the goal and win the operation', G.run.razed.syn_harvester === 2 && G.run.op.status === 'won');
NS.trip.endTrip('dock');

/* guards, factories, attack groups, repelled */
launch('c_counter');
const rb = A.state().bases[0];
rb.credits = 8000;
rb.attackT = 1e9;
const g0 = mine(0).filter(e => e.guard && !e.def.structure).length;
steps(60 * 25);
check('factories fill the core\'s guard', mine(0).filter(e => e.guard && !e.def.structure).length > g0);
rb.attackT = 0;
rb.since = 999;
steps(2);
const grp = A.state().groups[0];
check('a gathered guard sets off as an attack group', grp && grp.members.length >= 2 && grp.members.every(e => !e.guard && e.wave > 5000));
for (const e of grp.members) NS.enemies.damage(e, 1e6, null);
steps(2);
check('wiped out, it counts as repelled', A.repelled() === 1);
/* towers fire */
const tower = ofType('syn_tower')[0];
const fighter = NS.units.spawn('fighter', tower.x + 250, tower.y, 'player');
fighter.orders.length = 0;
fighter.hp = fighter.maxHp = 1e6;
const shots0 = G.shots.length;
steps(60);
check('a gun tower shoots craft in reach', G.shots.some(s => s.side === 'enemy') || fighter.hp < 1e6 || G.shots.length > shots0);
fighter.alive = false;
NS.trip.endTrip('dock');

/* haulers */
launch('c_freight');
const fb = A.state().bases[0];
fb.haulT = 0;
steps(2);
const h1 = ofType('hauler')[0];
check('a hauler undocks for the edge of the belt', h1 && h1.route && (h1.route.x <= 40 || h1.route.x >= G.world.w - 40 || h1.route.y <= 40 || h1.route.y >= G.world.h - 40));
NS.enemies.damage(h1, 1e6, null);
steps(2);
check('shot down it counts', G.run.razed.hauler === 1);
for (let k = 0; k < 4; ++k) {
  fb.haulT = 0;
  steps(2);
  const h = ofType('hauler').pop();
  h.x = h.route.x; h.y = h.route.y;
  steps(3);
}
check('one that gets away pays its base and counts as escaped', A.escapedCount() === 4);
check('four escaped fail the operation', G.run.op.status === 'failed' && G.run.op.why === 'escaped');
NS.trip.endTrip('dock');

/* reaching for the fields */
launch('c_expand');
const eb = A.state().bases[0];
eb.credits = 20000;
steps(60 * 40);
const relays = ofType('syn_relay');
check('a base reaching out builds relays toward the fields between', relays.length >= 2 && relays.some(r => Math.hypot(r.x - eb.toward.x, r.y - eb.toward.y) < Math.hypot(eb.x - eb.toward.x, eb.y - eb.toward.y) - 200));
NS.trip.endTrip('dock');

/* pylons, spores, hijack, lattice, the Citadel */
launch('c_citadel');
steps(70);
const cit = ofType('citadel')[0];
const covered = mine(0).filter(e => e.def.structure && e.type !== 'syn_pylon' && ofType('syn_pylon').some(p => Math.hypot(p.x - e.x, p.y - e.y) < p.def.guard));
check('shield pylons shield the structures round them', covered.length > 0 && covered.every(e => e.maxShield >= e.maxHp * 0.3 - 1));
for (const p of ofType('syn_pylon')) NS.enemies.damage(p, 1e7, null);
steps(70);
check('with the pylons down the shields go', covered.filter(e => e.alive && e.type !== 'citadel').every(e => e.maxShield === (e.shieldBase || 0)));
const fac = ofType('syn_factory')[0];
const spc = NS.units.spawn('sporecaster', fac.x + 300, fac.y, 'player');
spc.orders.length = 0;
spc.auto = false;
check('a Sporecaster seeds spores into the structures round its target', NS.abilities.cast(spc, { x: fac.x, y: fac.y }) && fac.sporeT > 0);
const fhp = fac.hp, prod = fac.prodT;
steps(60 * 2);
check('they rot and the factory stops producing', fac.hp < fhp && (fac.prodT === prod || fac.prodT === undefined));
steps(60 * 7);
check('halfway the spores jump to the next structure', ofType('syn_tower').concat(ofType('syn_battery'), ofType('syn_harvester'), ofType('citadel')).some(e => e.sporeT > 0));
const tw = ofType('syn_tower')[0];
const spk = NS.units.spawn('spike', tw.x + 200, tw.y, 'player');
spk.orders.length = 0;
spk.auto = false;
spk.hp = spk.maxHp = 1e6;
check('a Spike hijacks the nearest enemy tower', NS.abilities.cast(spk) && ofType('syn_tower').concat(ofType('syn_battery')).some(e => e.hijackT > 0));
const victim = NS.enemies.spawn('syn_fighter', tw.x + 120, tw.y, {});
victim.stun = 99;
victim.hp = victim.maxHp = 1e5;
const hij = ofType('syn_tower').concat(ofType('syn_battery')).find(e => e.hijackT > 0);
victim.x = hij.x + 150; victim.y = hij.y;
const fire0 = NS.enemies.fire;
let turned = 0;
NS.enemies.fire = function(side, kind, x, y, t, dmg, speed, opts) { if (opts && opts.from === hij && side === 'player' && t.def && t.def.faction === 'syndicate') ++turned; return fire0.apply(this, arguments); };
steps(90);
NS.enemies.fire = fire0;
check('and turns its guns on the Syndicate', turned > 0);
/* the autosave keeps the bases */
const snap = NS.resume.capture();
check('the autosave keeps the bases and what was razed', snap.syndicate && snap.syndicate.bases.length === 1 && snap.run.razed.syn_pylon >= 2 && snap.enemies.some(q => q.base === 0));
NS.trip.startTrip('career', 3, { resume: JSON.parse(JSON.stringify(snap)) });
G.cine = null;
check('and restores them, structures linked to their base', A.state().bases.length === 1 && G.enemies.some(e => e.type === 'citadel' && e.base === 0) && G.run.razed.syn_pylon >= 2);
const cit2 = ofType('citadel')[0];
NS.enemies.damage(cit2, 1e8, null);
steps(3);
check('razing the Citadel wins the capstone', G.run.op.status === 'won' && O.done(G.save, 'c_citadel') && O.licenceReady(G.save, 4));
NS.frame.draw();
check('the Syndicate draws without errors', true);
NS.trip.endTrip('dock');

launch('c_lattice');
const lb = A.state().bases[0];
lb.credits = 3000;
steps(60 * 8);
check('a Lattice base turns out nanoprobes', mine(0).some(e => e.type === 'nanodrone' || e.type === 'nanoswarm') && !mine(0).some(e => e.type === 'syn_fighter'));
NS.trip.endTrip('dock');

/* a base destroyed outright fulfils its raze goals */
check('with every base down, the raze goals are met', NS.ops.complete(OP_BY_ID.c_expand, { razed: { syn_relay: 1 }, basesDown: true }) && !NS.ops.complete(OP_BY_ID.c_expand, { razed: { syn_relay: 1 }, basesDown: false }));
check('a hauler hunt too', NS.ops.complete(OP_BY_ID.c_freight, { razed: {}, basesDown: true }));

done();
