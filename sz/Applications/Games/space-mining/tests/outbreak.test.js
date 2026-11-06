'use strict';

/* Crew, Bloom infection and Lattice corruption (pure): crew arriving with housing, infection
   growing in staffed rooms, spreading along links, blocked by quarantine, treated by medical
   bays (faster with serum), killing crew and abandoning the outpost; sterilising; corruption
   replicating, spreading past its hold, hijacking at 100% (never the hub), firewall research,
   purge, the EMP and reclaiming. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/save.js');
const { check, done } = H;
const C = NS.colony, OB = NS.outbreak, R = NS.rules;
const { BUILDING_BY_ID } = NS.colonyData;

const stats = R.computeStats(R.freshSave());
function outpost() {
  const b = C.newBase('verdant');
  const s = C.site(2);
  const add = (type, cx, cy) => {
    const o = { id: b.nextId++, type: type, cx: cx, cy: cy, lvl: 1, hp: BUILDING_BY_ID[type].hp, prog: 1, inf: 0, cor: 0, rogue: false, quarantine: false };
    b.buildings.push(o);
    return o;
  };
  const hub = add('hub', s.hubX, s.hubY);
  const a = add('smelter', s.hubX + 3, s.hubY);
  const c = add('laser', s.hubX - 1, s.hubY);
  const far = add('relay', 0, 0);
  b.crew = 6;
  return { b: b, hub: hub, a: a, c: c, far: far, add: add };
}
function run(o, secs, st, kind) {
  const ev = [];
  for (let t = 0; t < secs; t += 0.25) {
    const net = C.links(o.b, st || stats);
    C.assignCrew(o.b);
    const w = { base: o.b, net: net, stats: st || stats, dt: 0.25 };
    ev.push.apply(ev, kind === 'cor' ? OB.corruptionStep(w) : OB.infectionStep(w));
  }
  return ev;
}

/* crew */
const o0 = outpost();
o0.b.crew = 1;
let arrived = 0;
for (let i = 0; i < 200; ++i) arrived += OB.crewStep(o0.b, 0.25, stats).length;
check('crew arrive while there is housing', o0.b.crew === 3 && arrived === 2);
o0.add('habitat', 2, 12);
const t0 = o0.b.crew;
for (let i = 0; i < 40; ++i) OB.crewStep(o0.b, 0.25, stats);
check('habitats bring them faster and house more', o0.b.crew > t0 && C.housing(o0.b) === 14);
for (let i = 0; i < 2000; ++i) OB.crewStep(o0.b, 0.25, stats);
check('never more crew than housing', o0.b.crew === 14);

/* infection */
const o1 = outpost();
OB.seedInfection(o1.a, 0.2);
let ev = run(o1, 20);
check('infection grows in a staffed building', o1.a.inf > 0.3);
check('and spreads along the links to its neighbours', o1.hub.inf > 0 && ev.some(e => e.type === 'spread'));
check('but not to unlinked buildings', o1.far.inf === 0);
const o2 = outpost();
OB.seedInfection(o2.a, 0.2);
o2.a.quarantine = true;
run(o2, 20);
check('quarantine keeps it inside', o2.hub.inf === 0 && o2.c.inf === 0);
const o3 = outpost();
OB.seedInfection(o3.a, 0.6);
const deaths = run(o3, 60).filter(e => e.type === 'death').length;
check('the sick die', deaths > 0 && o3.b.crew === 6 - deaths);
const o4 = outpost();
o4.add('medbay', o4.a.cx, o4.a.cy + 3);
OB.seedInfection(o4.a, 0.3);
const cured = run(o4, 40);
check('a medical bay treats infection in reach', o4.a.inf === 0 && cured.some(e => e.type === 'cured'));
const o5 = outpost(), o6 = outpost();
o5.add('medbay', o5.a.cx, o5.a.cy + 3);
o6.add('medbay', o6.a.cx, o6.a.cy + 3);
o6.b.stock.comp.serum = 3;
OB.seedInfection(o5.a, 0.9);
OB.seedInfection(o6.a, 0.9);
run(o5, 6);
run(o6, 6);
check('serum in stock treats twice as fast', o6.a.inf < o5.a.inf);
const vacc = R.computeStats(Object.assign(R.freshSave(), { tree: { b_vaccine: 3 } }));
const o7 = outpost(), o8 = outpost();
OB.seedInfection(o7.a, 0.2);
OB.seedInfection(o8.a, 0.2);
run(o7, 15);
run(o8, 15, vacc);
check('vaccine research slows it', o8.a.inf < o7.a.inf && o8.hub.inf < o7.hub.inf);
const o9 = outpost();
OB.seedInfection(o9.a, 0.8);
C.assignCrew(o9.b);
const killed = OB.sterilize(o9.b, o9.a);
check('sterilising kills the spores and some of the staff', o9.a.inf === 0 && killed >= 1 && o9.b.crew === 6 - killed);

/* abandonment */
const oa = outpost();
for (const b of oa.b.buildings) OB.seedInfection(b, 1);
oa.b.crew = 2;
ev = run(oa, 120);
check('when the last crew die the outpost is abandoned', oa.b.abandoned && oa.b.crew === 0 && ev.some(e => e.type === 'abandoned'));
check('an abandoned outpost staffs nothing', Object.values(C.assignCrew(oa.b)).every(v => v === 1 || v === 0) && oa.b.buildings.every(b => !b._staff));
check('reclaiming brings new crew and a clean station', OB.reclaim(oa.b, 4) && !oa.b.abandoned && oa.b.crew === 4 && oa.b.buildings.every(b => b.inf === 0));

/* corruption */
const oc = outpost();
OB.inject(oc.a, 0.2);
ev = run(oc, 30, null, 'cor');
check('corruption replicates inside a building', oc.a.cor > 0.4);
check('and spreads along the links once it takes hold', oc.hub.cor > 0);
ev = ev.concat(run(oc, 120, null, 'cor'));
check('on through the hub to the next building', oc.c.cor > 0);
check('at 100% the building is hijacked', oc.a.rogue && ev.some(e => e.type === 'rogue' && e.b === oc.a));
check('the hub is never hijacked', !oc.hub.rogue && oc.hub.cor <= 0.95);
check('a hijacked building drops out of storage and housing', C.housing(oc.b) === 0 || !oc.hub.rogue);
const fw = R.computeStats(Object.assign(R.freshSave(), { tree: { b_firewall: 3 } }));
const od = outpost(), oe = outpost();
OB.inject(od.a, 0.2);
OB.inject(oe.a, 0.2);
run(od, 20, null, 'cor');
run(oe, 20, fw, 'cor');
check('firewall research slows it', oe.a.cor < od.a.cor);
check('a purge resets a building and reboots it', OB.purge(oc.a) && oc.a.cor === 0 && !oc.a.rogue && oc.a._stun > 0);
oc.c.cor = 0.5;
oc.far.cor = 0.5;
const n = OB.emp(oc.b, 7);
check('the EMP purges near the hub only', oc.c.cor === 0 && oc.far.cor === 0.5 && n >= 1);
const of = outpost();
of.a.cor = 0.3;
of.a.quarantine = true;
run(of, 30, null, 'cor');
check('quarantine stops corruption spreading too', of.hub.cor === 0);

done();
