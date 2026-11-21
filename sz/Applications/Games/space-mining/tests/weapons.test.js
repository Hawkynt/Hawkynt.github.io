'use strict';

/* The hardpoints in the running game: every weapon against pirates and invaders - pulse bolts,
   flak pellets, homing missiles, the charged rail lance piercing a line, the EMP mine stripping
   shields and stunning, the gravity net holding, the cloak losing pursuers until you fire, the
   tether grabbing and flinging a rock, the drone swarm - cooldowns, the keys and their modes,
   and the combat model on hits from units, turrets and the laser. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const HP = NS.hardpoints;
const CB = NS.combat;

G.save.seenIntro = true;
G.save.hull = 'leviathan';
G.save.hulls.push('leviathan');
NS.save.refreshStats();

function trip(slots, zone) {
  G.save.weapons.owned = {};
  for (const id of slots) if (id) G.save.weapons.owned[id] = 1;
  G.save.weapons.slots = slots.slice();
  NS.trip.startTrip('career', zone || 0);
  NS.cinematics.skip();
  G.cine = null;
  G.screen = 'playing';
  const s = G.ship;
  s.maxHull = s.hull = 1e6;
  s.x = 1200; s.y = 1200; s.vx = s.vy = 0; s.angle = 0;
  for (const r of G.rocks) r.alive = false;
  G.rocks.length = 0;
  NS.asteroids.rebuildGrid();
  G.input.aimMode = 'keys';
}
const steps = (n) => H.run(NS, n);
const ahead = (d, dy) => ({ x: G.ship.x + d, y: G.ship.y + (dy || 0) });
function pirate(kind, d, dy) {
  const p = ahead(d, dy);
  const o = NS.pirates.spawn(kind, p.x, p.y);
  o.fireT = 99;
  return o;
}
function foe(type, d, dy) {
  const p = ahead(d, dy);
  const e = NS.enemies.spawn(type, p.x, p.y, {});
  e.spawnT = 0;
  return e;
}
const hold = (slot, frames) => { HP.trigger(slot, true); steps(frames); HP.trigger(slot, false); };

/* ── the combat model on a hit ── */
trip(['pulse', null, null]);
const light = pirate('raider', 2000), heavy = pirate('gunship', 2000, 300);
const l0 = light.hp, h0 = heavy.hp;
HP.hit(light, 50, 'energy', light.x, light.y);
HP.hit(heavy, 50, 'energy', heavy.x, heavy.y);
check('energy hits light hulls in full and armour at 70%', Math.abs((l0 - light.hp) - 50) < 1e-6 && Math.abs((h0 - heavy.hp) - 35) < 1e-6);
const bomber = foe('bomber', 2500), b0 = bomber.hp;
NS.enemies.hitTarget(bomber, 100, 'player', null, 'flak');
check('units and turrets count their type too: flak bounces off a bomber', Math.abs((b0 - bomber.hp) - 40) < 1e-6);
const frig = foe('frigate', 2600, -400), f0 = frig.shield;
NS.enemies.hitTarget(frig, 40, 'player', null, 'emp');
check('EMP strips shields', frig.shield < f0 - 80);

/* ── pulse ── */
trip(['pulse', null, null]);
let p = pirate('raider', 450);
const shots0 = G.wshots.length;
HP.trigger(0, true);
steps(2);
check('a held pulse key fires bolts along the nose', G.wshots.length > shots0 && G.wshots.every(w => Math.abs(w.vy) < Math.abs(w.vx) * 0.1));
steps(58);
HP.trigger(0, false);
check('the bolts hit the raider ahead', p.hp < p.maxHp);
const fired = HP.state().shots;
steps(30);
check('releasing the key stops the fire', HP.state().shots === fired);

/* ── flak ── */
trip(['flak', null, null]);
HP.trigger(0, true);
steps(1);
HP.trigger(0, false);
check('scatter flak throws a cone of pellets', G.wshots.filter(w => w.kind === 'pellet').length === 7);

/* ── missiles ── */
trip(['missile', null, null]);
p = pirate('gunship', 650, 260);
hold(0, 2);
check('the missile rack fires a salvo', G.wshots.filter(w => w.kind === 'missile').length === 3);
steps(60 * 3);
check('the missiles home in on the gunship off the nose', p.hp < p.maxHp * 0.7);

/* ── rail lance ── */
trip(['rail', null, null]);
const r1 = pirate('raider', 380), r2 = pirate('gunship', 760);
HP.trigger(0, true);
steps(3);
HP.trigger(0, false);
check('a tap does not fire the lance', r1.hp === r1.maxHp && !HP.state().rails.length);
steps(60 * 3);
/* charge for a second, line both pirates up on the nose, release */
HP.trigger(0, true);
steps(60);
Object.assign(r1, ahead(380), { vx: 0, vy: 0 });
Object.assign(r2, ahead(760), { vx: 0, vy: 0 });
HP.trigger(0, false);
check('a charged lance pierces everything in line', r1.hp < r1.maxHp && r2.hp < r2.maxHp && HP.state().rails.length === 1);

/* ── EMP mine ── */
trip(['emp', null, null]);
const f = foe('frigate', 60);
hold(0, 1);
hold(0, 1);
check('one mine per cooldown', HP.state().mines.length === 1);
steps(60);
check('the mine strips the frigate\'s shield and stuns it', f.shield <= 0 && f.stun > 1);

/* ── gravity net ── */
trip(['net', null, null]);
const n = foe('raider', 420);
n.speed = 280;
hold(0, 1);
steps(40);
const nx = n.x, ny = n.y;
steps(90);
check('the net holds an invader in place', n.held > 0 && Math.hypot(n.x - nx, n.y - ny) < 40, Math.round(Math.hypot(n.x - nx, n.y - ny)));

/* ── cloak ── */
trip(['cloak', 'pulse', null]);
const c = pirate('raider', 300);
c.fireT = 0;
hold(0, 1);
check('the cloak hides the ship', G.ship.cloak > 0);
const hull0 = G.ship.hull;
steps(60 * 3);
check('pirates lose the ship while it is cloaked', G.ship.hull === hull0);
hold(1, 2);
check('firing breaks the cloak', !(G.ship.cloak > 0));

/* ── tether ── */
trip(['tether', null, null]);
const rock = NS.asteroids.makeRock(G.ship.x - 220, G.ship.y, 1, 'iron', 0, Math.random);
rock.vx = rock.vy = rock.vr = 0;
G.rocks.push(rock);
NS.asteroids.rebuildGrid();
check('a test rock lies near the ship', !!rock);
hold(0, 1);
check('the tether grabs the nearest rock', HP.state().tow === rock);
steps(60);
check('the rock trails behind the ship', Math.hypot(rock.x - G.ship.x, rock.y - G.ship.y) < 260);
const t = pirate('raider', 500);
steps(60 * 1.1);
Object.assign(t, ahead(500), { vx: 0, vy: 0 });
hold(0, 1);
check('a second press flings it', !HP.state().tow && Math.hypot(rock.vx, rock.vy) > 500);
steps(60);
check('the flung rock smashes the pirate', t.hp < t.maxHp);

/* ── drone swarm ── */
trip(['swarm', null, null]);
const sp = pirate('gunship', 500, 120);
hold(0, 1);
check('the swarm launches four drones', HP.state().swarm.length === 4);
steps(60 * 5);
check('the drones hunt the gunship', sp.hp < sp.maxHp);
steps(60 * 9);
check('and return to nothing when their time is up', HP.state().swarm.length === 0);

/* ── keys (in a belt with an outpost, where control groups exist) ── */
trip(['pulse', null, null], 2);
const key = (type, code, extra) => (env.listeners[type] || []).forEach(fn => fn(Object.assign({ code: code, key: code, preventDefault() {} }, extra || {})));
const s0 = HP.state().shots;
key('keydown', 'Digit1');
steps(30);
key('keyup', 'Digit1');
check('1 fires the first hardpoint while held', HP.state().shots > s0 && !HP.state().held[0]);
let recalled = 0;
const rg = NS.command.recallGroup;
NS.command.recallGroup = (k) => { recalled = k; return false; };
key('keydown', 'Digit2', { shiftKey: true });
NS.command.recallGroup = rg;
check('Shift+2 recalls control group 2 in the pilot view', recalled === 2);
check('an empty hardpoint does nothing', (HP.trigger(2, true), HP.trigger(2, false), true));
check('the HUD shows the mounted weapons', (NS.frame.draw(), G.hitAreas !== undefined) && HP.slots().length === 3 && HP.slots()[0] === 'pulse');

done();
