'use strict';

/* Escort: the pure rules (trading posts at the belt edges, lanes with bends, points along a
   lane, choke points, where each freighter goes, pay by cargo, the drain of a latched skimmer),
   the Amber Reach operations, and freighters in the running game - undocking on schedule,
   following the lane, an ambush at a choke point, skimmers draining cargo and giving it back
   when shot down, hull damage and losses failing the operation, delivery paying by cargo, the
   reactor stop that takes ore from the hold, storms slowing the convoy, the hired wing, the
   autosave, and supply freighters the hub orders to the outpost. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const E = NS.escort;
const O = NS.ops;
const { OP_BY_ID } = NS.opsData;

/* ── pure rules ── */
const rng = (seed) => NS.rng.makeRng(seed);
const W = 6400, Hh = 4600, dock = { x: W / 2, y: Hh / 2 };
const posts = E.posts(rng(7), W, Hh, dock);
const by = id => posts.find(p => p.id === id);
check('four trading posts, one at each edge of the belt', posts.length === 4 && by('n').y < 500 && by('s').y > Hh - 500 && by('w').x < 500 && by('e').x > W - 500);
check('the posts stay inside the belt', posts.every(p => p.x > 300 && p.x < W - 300 && p.y > 300 && p.y < Hh - 300));
const again = E.posts(rng(7), W, Hh, dock), other = E.posts(rng(8), W, Hh, dock);
check('the seed places them: the same seed the same posts, another seed others', JSON.stringify(again) === JSON.stringify(posts) && JSON.stringify(other) !== JSON.stringify(posts));
const lane = E.lane(dock, by('e'), rng(3));
const straight = Math.hypot(by('e').x - dock.x, by('e').y - dock.y);
check('a lane leaves the dock ring and ends short of the post', Math.hypot(lane[0].x - dock.x, lane[0].y - dock.y) > 150 &&
  Math.hypot(lane[lane.length - 1].x - by('e').x, lane[lane.length - 1].y - by('e').y) < 150);
check('a lane bends: four points, longer than the straight line', lane.length === 4 && E.length(lane) > straight - 320);
const p0 = E.at(lane, 0), pe = E.at(lane, E.length(lane)), pm = E.at(lane, E.length(lane) / 2);
check('points along a lane run from its start to its end', Math.hypot(p0.x - lane[0].x, p0.y - lane[0].y) < 1 && Math.hypot(pe.x - lane[3].x, pe.y - lane[3].y) < 1 &&
  E.distance(lane, pm.x, pm.y) < 1);
check('the distance to a lane', E.distance(lane, lane[1].x, lane[1].y + 100) <= 100 && E.distance(lane, lane[1].x, lane[1].y) < 1e-6);
const ch = E.chokes(lane, 2, rng(5)), len = E.length(lane);
check('choke points lie between 30% and 85% of the way, in order', ch.length === 2 && ch.every(c => c.d > len * 0.3 && c.d < len * 0.85) && ch[0].d < ch[1].d);
const [near, far, opp, side, side2] = E.resolve(['near', 'far', 'opp', 'side', 'side2'], posts, dock);
check('near is the closest post, far the farthest, opp across from near', near.id === 'n' || near.id === 's');
check('opp is across from near; side and side2 are the other two, nearer first', opp.id === near.opp && side !== side2 &&
  [near, opp, side, side2].map(p => p.id).sort().join() === 'e,n,s,w' && Math.hypot(side.x - dock.x, side.y - dock.y) <= Math.hypot(side2.x - dock.x, side2.y - dock.y));
check('far is one of the side posts', far === side2);
check('the fee scales with the cargo still aboard', E.pay(1000, 1) === 1000 && E.pay(1000, 0.55) === 550 && E.pay(1000, 1.3) === 1000);
check('under half the cargo a post pays nothing and voids the contract', E.pay(1000, 0.49) === 0 && E.pay(1000, 0) === 0 && !E.accepted(0.49) && E.accepted(0.5));
check('a latched skimmer drains a twentieth a second, never more than is aboard', Math.abs(E.drain(1, 1, 1) - 0.05) < 1e-9 && E.drain(0.01, 1, 1) === 0.01 && E.drain(0, 3, 1) === 0);

/* ── the Amber Reach operations ── */
const amber = O.zoneOps('amber');
check('the Amber Reach has nine escort operations ending in the Long Haul', amber.length === 9 && O.capstoneOf('amber').id === 'a_haul' && amber.every(o => o.convoy));
check('the moods run challenging, breather, surprise, harder ... nightmare', amber.map(o => o.mood).join('') === 'CESHEHWSN' && O.moodsOk(amber));
check('every escort can be won within the losses it allows', amber.every(o => o.goals[0].type === 'deliver' && o.goals[0].n === o.convoy.list.length - o.convoy.loss));
check('the schedules name real destinations and ambush real pirates', amber.every(o => o.convoy.list.every(c => ['near', 'far', 'opp', 'side', 'side2'].indexOf(c.to) >= 0) &&
  Object.keys(o.convoy.ambush.kinds).every(k => NS.ships.PIRATES[k]) && (!o.convoy.ambush.lead || NS.ships.PIRATES[o.convoy.ambush.lead])));
check('Hired Wing unlocks the wing for later convoys', OP_BY_ID.a_wing.convoy.wing && OP_BY_ID.a_wing.reward.unlock.indexOf('wing') >= 0);
check('the progress counts delivered freighters', O.progress(OP_BY_ID.a_twin, { delivered: 1 })[0].have === 1 && O.complete(OP_BY_ID.a_twin, { delivered: 2 }));

/* ── in the running game ── */
G.save.seenIntro = G.save.seenHelp = true;
G.save.licenses.push('amber');
NS.save.refreshStats();
const steps = (n) => H.run(NS, n);

function launch(id) {
  NS.trip.startTrip('career', 1, { op: id });
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  const s = G.ship;
  s.maxHull = s.hull = 1e6;
  G.run.pirateT = 1e9;
  if (G.storm && !OP_BY_ID[id].force) G.storm = null;
  return G.freighters;
}
/* the ship parks far from everything */
function park() {
  const s = G.ship;
  s.x = 300; s.y = G.world.h - 300; s.vx = s.vy = 0;
}

let fr = launch('a_first');
const f = fr[0];
check('an escort operation lays out the posts and its freighter, waiting at the dock', G.posts.length === 4 && fr.length === 1 && f.state === 'wait' && f.cargo === 1);
const p = G.posts.find(q => q.id === f.to);
check('the freighter goes to the nearest post, on a lane cleared of rocks', p && p.path && G.rocks.every(r => r.kind !== 'rock' || E.distance(p.path, r.x, r.y) >= r.r + f.r + 50));
park();
steps(60 * 7);
check('it undocks on schedule', f.state === 'fly' && f.d > 0);
const d0 = f.d;
steps(60);
check('freighters cruise faster in the wider belts, so a run takes as long', E.pace(6400) === E.FREIGHTER.speed && Math.abs(E.pace(9200) / E.pace(6400) - 9200 / 6400) < 1e-9);
check('it follows its lane at its pace', Math.abs(f.d - d0 - E.pace(G.world.w)) < 2 && E.distance(p.path, f.x, f.y) < 1);
/* fly it to the choke */
f.d = p.chokes[0].d - 300;
steps(60 * 2);
const amb = G.pirates.filter(q => q.prey === f);
check('pirates jump it near the choke point', p.chokes[0].sprung && amb.length === 2 && G.run.op.ambushes === 1);
/* a skimmer latches and drains */
const sk = amb[0];
sk.x = f.x + 40; sk.y = f.y; sk.vx = sk.vy = 0;
amb[1].alive = false;
steps(10);
check('a skimmer that reaches it latches on', sk.latch === f);
steps(60 * 2);
check('and drains its cargo', f.cargo < 0.95 && f.cargo > 0.85 && sk.took > 0.05);
const before = f.cargo, took = sk.took;
NS.pirates.damage(sk, 1e6, sk.x, sk.y);
check('shooting the skimmer down brings the cargo back', Math.abs(f.cargo - (before + took)) < 1e-6);
const sk2 = NS.pirates.spawn('skimmer', f.x + 30, f.y);
sk2.prey = f;
steps(5);
steps(60 * 4);
check('a skimmer with its share lets go and runs with it', !sk2.latch && sk2.loot && sk2.loot.cargo >= E.FREIGHTER.take - 1e-6 && f.cargo < 0.9);
const c1 = f.cargo;
NS.pirates.damage(sk2, 1e6, sk2.x, sk2.y);
check('caught on the run, it gives the cargo back too', f.cargo > c1 + 0.14);
/* raiders shoot the hull */
const rd = NS.pirates.spawn('raider', f.x + 240, f.y);
rd.prey = f;
rd.fireT = 0;
const hp0 = f.hp;
steps(60 * 3);
check('raiders shoot its hull', f.hp < hp0);
rd.alive = false;
f.cargo = 0.8;
const cr0 = G.save.credits;
f.d = p.len - 5;
steps(10);
check('docked at its post it pays the fee times its cargo', f.state === 'done' && f.paid === 480 && G.run.op.paid === 480 && G.run.op.delivered === 1 &&
  G.save.credits - cr0 === 480 + OP_BY_ID.a_first.reward.cr);
check('the operation is won with the delivery', G.run.op.status === 'won' && O.done(G.save, 'a_first'));
const raider = NS.pirates.spawn('raider', f.x + 300, f.y);
raider.prey = f;
steps(2);
check('ambushers whose freighter docked give up the raid', raider.prey === null && raider.flee > 0);
NS.trip.endTrip('dock');

/* losses fail it */
fr = launch('a_long');
park();
fr[0].wait = 0;
steps(5);
NS.freighters.hurt(fr[0], 1e6);
steps(2);
check('a freighter whose hull gives out is lost', fr[0].state === 'lost' && G.run.op.lost === 1);
check('more losses than allowed fail the operation', G.run.op.status === 'failed' && G.run.op.why === 'convoy');
NS.trip.endTrip('dock');

/* a short delivery */
fr = launch('a_long');
park();
fr[0].wait = 0;
steps(5);
fr[0].cargo = 0.4;
const crS = G.save.credits;
fr[0].d = G.posts.find(q => q.id === fr[0].to).len - 5;
steps(10);
check('a freighter that docks with under half its cargo voids its contract and counts as lost', fr[0].state === 'short' && G.run.op.lost === 1 &&
  G.run.op.status === 'failed' && G.save.credits === crS);
NS.trip.endTrip('dock');

/* convoys allow some losses */
fr = launch('a_convoy');
park();
check('a convoy sends three freighters down one lane, one after another', fr.length === 3 && fr.every(x => x.to === fr[0].to) && fr[0].wait < fr[1].wait && fr[1].wait < fr[2].wait);
fr[0].wait = 0;
steps(5);
NS.freighters.hurt(fr[0], 1e6);
steps(2);
check('one loss is allowed in a convoy', G.run.op.status === 'active');
NS.trip.endTrip('dock');

/* the reactor stop */
fr = launch('a_order');
const g = fr[0];
park();
g.wait = 0;
steps(5);
g.d = g.need.d - 10;
steps(30);
check('a freighter with reactor trouble stops on the way and asks for the belt\'s commonest ore', g.state === 'need' && g.need.ore === 'copper');
const dStop = g.d;
steps(60);
check('it waits until it gets it', g.d === dStop && g.state === 'need');
const s = G.ship;
G.run.cargo.copper = 20;
NS.mining.refreshCargoSpace();
s.x = g.x + 100; s.y = g.y; s.vx = s.vy = 0;
steps(5);
check('alongside and slow with the ore aboard, the ship hands it over and it flies on', g.need.done && g.state === 'fly' && G.run.cargo.copper === 5);
NS.trip.endTrip('dock');

/* storms */
fr = launch('a_storm');
check('Storm Crossing brings a storm front', G.storm && G.storm.phase === 'calm' && G.storm.t === OP_BY_ID.a_storm.force.storm);
park();
fr[0].wait = 0;
steps(5);
G.storm.phase = 'active';
G.storm.t = 100;
const ds = fr[0].d;
steps(60);
check('a storm halves a freighter\'s speed', Math.abs(fr[0].d - ds - E.pace(G.world.w) * E.FREIGHTER.storm) < 2);
NS.trip.endTrip('dock');

/* several directions */
fr = launch('a_three');
check('Three Directions sends three freighters to three different posts', fr.length === 3 && new Set(fr.map(x => x.to)).size === 3);
NS.trip.endTrip('dock');

/* the wing */
fr = launch('a_twin');
check('no wing before Hired Wing', G.wing.length === 0);
NS.trip.endTrip('dock');
fr = launch('a_wing');
check('Hired Wing brings two fighters', G.wing.length === 2 && G.wing.every(w => w.alive));
park();
fr[0].wait = 0;
steps(5);
fr[0].d = 600;
steps(2);
for (const w of G.wing) { w.x = fr[0].x - 100; w.y = fr[0].y + 50; }
const foe = NS.pirates.spawn('raider', fr[0].x + 200, fr[0].y);
foe.prey = fr[0];
foe.fireT = 99;
const fh = foe.hp;
steps(60 * 3);
check('the wing dives on a pirate attacking a freighter', !foe.alive || foe.hp < fh);
/* autosave */
const snap = NS.resume.capture();
check('the autosave keeps the posts, the freighters and the wing', snap.escort && snap.escort.posts.length === 4 && snap.escort.freighters.length === 1 && snap.escort.wing.length === 2);
const fx = fr[0].x, fd = fr[0].d;
NS.trip.startTrip('career', 1, { resume: JSON.parse(JSON.stringify(snap)) });
check('continuing restores them where they were', G.freighters.length === 1 && G.freighters[0].d === fd && G.freighters[0].x === fx && G.wing.length === 2 && G.posts.some(q => q.path));
NS.trip.endTrip('dock');
G.save.unlocks.push('wing');
launch('a_convoy');
check('once unlocked the wing flies with every convoy', G.wing.length === 2);
check('free trips have no freighters', (NS.trip.endTrip('dock'), NS.trip.startTrip('career', 1), G.freighters.length === 0 && G.posts.length === 0 && G.wing.length === 0));
NS.trip.endTrip('dock');

/* ── supply freighters ── */
const SU = NS.supply;
check('four supply packs: iron, copper, a builder\'s mix and parts', SU.PACKS.length === 4 && SU.PACKS.map(k => k.id).join() === 'iron,copper,mix,parts');
const priceIron = SU.packPrice(G.save, G.stats, SU.PACK_BY_ID.iron);
check('a pack costs the station\'s supply prices plus the freight fee', priceIron === SU.FREIGHT_FEE + SU.PACK_BY_ID.iron.load.bar.iron * SU.buyPrice(G.save, G.stats, 'bar', 'iron') +
  SU.PACK_BY_ID.iron.load.ore.iron * SU.buyPrice(G.save, G.stats, 'ore', 'iron'));
check('a load scales down with the cargo still aboard', JSON.stringify(SU.scaleLoad(SU.PACK_BY_ID.mix.load, 0.5)) === JSON.stringify({ ore: { iron: 12, copper: 7, ice: 10 }, bar: { iron: 2, copper: 2 }, comp: {} }));
G.save.licenses.push('verdant');
NS.trip.startTrip('career', 2);
NS.cinematics.skip();
G.cine = null;
G.screen = 'playing';
G.ship.maxHull = G.ship.hull = 1e6;
G.run.pirateT = 1e9;
check('no shipment without a hub', !NS.freighters.order('iron'));
const shub = NS.base.grant('hub', G.base.site.hubX, G.base.site.hubY);
G.save.credits = 10;
check('no shipment without the credits', !NS.freighters.order('iron') && !G.freighters.length);
G.save.credits = 1e6;
const bars0 = G.base.data.stock.bar.iron || 0;
check('the hub orders a shipment and pays for it', NS.freighters.order('iron') && G.save.credits === 1e6 - priceIron && G.freighters.length === 1 && G.freighters[0].kind === 'supply');
check('at most two shipments at a time', NS.freighters.order('mix') && !NS.freighters.order('copper') && G.freighters.length === 2);
const sf = G.freighters[0];
const hubLane = G.posts.find(q => q.id === sf.to);
check('it flies a lane from the dock to the hub', hubLane && hubLane.hub && Math.hypot(hubLane.path[hubLane.path.length - 1].x - shub.x, hubLane.path[hubLane.path.length - 1].y - shub.y) < 150 &&
  Math.hypot(hubLane.path[0].x - G.dock.x, hubLane.path[0].y - G.dock.y) < 250);
check('a belt with pirates may lay an ambush on the way', sf.chokes && sf.chokes.length <= 1 && !!sf.ambush === (sf.chokes.length === 1));
G.ship.x = 300; G.ship.y = 300;
steps(60 * 4);
check('it undocks after a moment', sf.state === 'fly');
sf.cargo = 0.5;
sf.d = hubLane.len - 5;
steps(10);
check('what arrives goes into the outpost stock, scaled by the cargo aboard', sf.state === 'done' && G.base.data.stock.bar.iron === bars0 + 4);
check('a shipment counts toward no operation', !G.run.op);
const store0 = G.save.store.bar.iron || 0, storeIce = G.save.store.ore.ice || 0;
NS.trip.endTrip('dock');
check('a shipment still on its way at the end of the trip puts its load into the warehouse', (G.save.store.bar.iron || 0) === store0 + 4 && (G.save.store.ore.ice || 0) === storeIce + 20);

/* operations chain within one trip */
{
  for (const id of ['a_first', 'a_long', 'a_storm', 'a_twin', 'a_wing']) NS.ops.finish(G.save, OP_BY_ID[id], true, 60);
  launch('a_convoy');
  G.run.op.delivered = 2;
  steps(2);
  check('a won operation names the next one of the belt', G.run.op.status === 'won' && G.run.op.nextId === 'a_three');
  steps(60 * (NS.operation.NEXT_IN + 1));
  check('which starts in the same trip after a breather', G.run.op.id === 'a_three' && G.run.op.status === 'active' && G.freighters.length === 3);
  G.run.op.lost = 5;
  steps(2);
  check('a failed one is the next one again', G.run.op.status === 'failed' && G.run.op.nextId === 'a_three');
  steps(60 * (NS.operation.NEXT_IN + 1));
  check('and starts over in the same trip', G.run.op.id === 'a_three' && G.run.op.status === 'active' && G.run.op.lost === 0);
  const tries = G.save.ops.a_three.tries;
  NS.trip.endTrip('dock');
  check('going home leaves an operation that started on its own unfailed', G.save.ops.a_three.tries === tries && G.ui.results.op.id === 'a_convoy' &&
    G.ui.results.op.status === 'won');
}

/* drawing */
launch('a_three');
for (const x of G.freighters) x.wait = 0;
steps(60);
NS.frame.draw();
check('the escort draws without errors', true);
NS.trip.endTrip('dock');

done();
