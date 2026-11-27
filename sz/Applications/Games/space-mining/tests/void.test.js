'use strict';

/* The Void Crown: seven operations in the mood order, allied stations at the rim with their own
   hull and guns that invaders fly for (all of them lost fails the operation), fronts of a
   faction arriving from the rim on a schedule, factions that feud with each other, Lattice
   ambushes on survivor freighters, holding out for a time, and the Crown Heart as the capstone. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const O = NS.ops;
const F = NS.fuel;
const { OP_BY_ID, MOODS } = NS.opsData;

const ops = O.zoneOps('void');
check('the Void Crown has seven operations', ops.length === 7);
check('in the mood order C H E W S H N', ops.map(o => o.mood).join('') === 'CHEWSHN');
check('never two peaks back to back', O.moodsOk(ops));
check('The Crown is the capstone', ops[6].id === 'vc_crown' && ops[6].capstone);
check('every goal type is one the runner measures', ops.every(o => o.goals.every(g => ['ore', 'hold', 'outpost', 'build', 'waves', 'deliver', 'raze', 'crown'].indexOf(g.type) >= 0)));
check('hold counts the seconds of the operation', O.progress(OP_BY_ID.vc_ally, { t: 100 })[0].have === 100 && !O.complete(OP_BY_ID.vc_ally, { t: 100 }) && O.complete(OP_BY_ID.vc_ally, { t: 240 }));
check('the crown goal is the Crown Heart shattered', O.complete(OP_BY_ID.vc_crown, { crown: true }) && !O.complete(OP_BY_ID.vc_crown, { crown: false }));

const steps = n => H.run(NS, n);
function launch(id) {
  G.save.licenses = ['kessler', 'amber', 'verdant', 'crimson', 'void'];
  NS.trip.startTrip('career', 4, { op: id });
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  const s = G.ship;
  s.maxHull = s.hull = 1e6;
  s.maxFuel = s.fuel = 1e6;
  G.run.pirateT = 1e9;
  for (const o of G.specials) o.found = true;
  for (const r of G.rocks) if (r.kind !== 'rock') r.found = true;
  return G.run.op;
}
G.save.seenIntro = true;

/* an allied station under siege */
launch('vc_ally');
check('Protect Friends places an allied station out at the rim', G.allies.length === 1 && F.reach(G.allies[0].x, G.allies[0].y, G.dock, G.world.w, G.world.h) >= 0.5 && G.allies[0].hp > 0);
const ally = G.allies[0];
G.ship.x = 200; G.ship.y = 200;
steps(60 * (OP_BY_ID.vc_ally.fronts[0].first + 2));
const raiders = G.enemies.filter(e => e.alive && e.front);
check('a front arrives on schedule', raiders.length >= OP_BY_ID.vc_ally.fronts[0].size[0]);
check('the siege flies for the allied station', raiders.every(e => e.allyT === ally));
check('its faction is the Hive', raiders.every(e => e.def.faction === 'alien'));
for (const e of G.enemies) e.alive = false;
const foe = NS.enemies.spawn('raider', ally.x + 300, ally.y, {});
foe.allyT = ally;
const fh = foe.hp;
steps(60 * 3);
check('the station\'s guns shoot what comes within 480 px', !foe.alive || foe.hp < fh);
const ah = ally.hp;
NS.enemies.hitTarget(ally, 50, 'enemy', null);
check('invaders hurt the station', ally.hp === ah - 50);
ally.hp = 1;
NS.enemies.hitTarget(ally, 5, 'enemy', null);
steps(2);
check('when every allied station falls the operation fails', !ally.alive && G.run.op.status === 'failed' && G.run.op.why === 'ally');
NS.trip.endTrip('dock');

/* the station gives the ship time to arrive, but cannot hold alone */
G.save.skill.level = 1.7;
launch('vc_ally');
G.ship.x = 200; G.ship.y = 200;
const st = G.allies[0];
check('a raised difficulty fortifies the station as much as it toughens the foes', Math.abs(st.maxHp - OP_BY_ID.vc_ally.allies[0].hp * NS.skill.diff(1.7).hp) < 1e-6);
steps(60 * 75);
check('even at a raised difficulty the station still stands 75 s in without help', st.alive && G.run.op.status === 'active');
NS.trip.endTrip('dock');
G.save.skill.level = 1;
launch('vc_ally');
G.ship.x = 200; G.ship.y = 200;
let fell = false;
for (let s = 0; s < 240 && !fell; s += 5) { steps(60 * 5); G.ship.x = 200; G.ship.y = 200; fell = !G.allies[0].alive; }
check('left alone it falls before the four minutes are out', fell);
NS.trip.endTrip('dock');

/* holding out */
launch('vc_ally');
G.run.op.t = OP_BY_ID.vc_ally.goals[0].n;
steps(2);
check('holding out the time with the station standing wins', G.run.op.status === 'won');
NS.trip.endTrip('dock');

/* three factions in a feud */
launch('vc_war');
check('the Three-Front War sets the factions feuding and puts a Syndicate base down', NS.allies.feud() && G.enemies.some(e => e.alive && e.type === 'syn_core'));
const sf = NS.enemies.spawn('raider', 3000, 3000, {});
const sw = NS.enemies.spawn('swarmer', 3200, 3000, {});
G.ship.x = 200; G.ship.y = 200;
steps(30);
check('in a feud a raider turns on the nearest craft of another faction', sf.target === sw || !sw.alive || sw.hp < sw.maxHp);
check('the war has fronts of the Hive and the Lattice', OP_BY_ID.vc_war.fronts.some(f => f.faction === 'alien') && OP_BY_ID.vc_war.fronts.some(f => f.faction === 'lattice'));
NS.trip.endTrip('dock');
check('outside a feud the factions leave each other alone', !NS.allies.feud());

/* survivors through Lattice space */
launch('vc_survivors');
const fr = G.freighters;
check('Survivors sends two freighters to the far posts', fr.length === 2);
fr[0].wait = 0;
steps(5);
fr[0].d = 500;
steps(2);
const p = G.posts.find(q => q.id === fr[0].to);
p.chokes[0].d = fr[0].d + 100;
p.chokes[0].sprung = false;
steps(60 * 3);
const lattice = G.enemies.filter(e => e.alive && e.def.faction === 'lattice' && e.prey === fr[0]);
check('Lattice drones ambush the survivors', lattice.length > 0);
const sh = fr[0].hp;
steps(60 * 6);
check('and their bolts hurt the freighter', fr[0].hp < sh || fr[0].state === 'lost');
NS.trip.endTrip('dock');

/* the Crown */
G.save.crownDone = false;
launch('vc_crown');
const crown = G.rocks.find(r => r.kind === 'crown');
check('The Crown brings the Crown Heart, an allied station and the feud', crown && G.allies.length >= 1 && NS.allies.feud());
check('the Crown sings it whole: four times the hull, raised by the difficulty level', Math.abs(crown.maxHp - 4200 * 4 * NS.operation.dm().hp) < 1e-6 && crown.hp === crown.maxHp);
G.run.crownBroken = true;
steps(2);
check('shattering the Crown Heart wins it', G.run.op.status === 'won');
NS.trip.endTrip('dock');

/* the autosave keeps the allies */
launch('vc_ally');
G.allies[0].hp = 1234;
const snap = NS.resume.capture();
NS.trip.startTrip('career', 4, { resume: JSON.parse(JSON.stringify(snap)) });
check('continuing restores the allied stations', G.allies.length === 1 && G.allies[0].hp === 1234);
NS.frame.draw();
check('the Void draws without errors', true);
NS.trip.endTrip('dock');

done();
