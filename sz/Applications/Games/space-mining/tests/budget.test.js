'use strict';

/* Frame budget: the loop's work per frame (simulation and drawing) is averaged; past 12 ms for a
   second the visual detail steps down (fewer particles, no drifting dust), under 6 ms for five
   seconds it steps back up; and hard caps keep pirates and enemies from running away. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.budget;

const st = B.create();
check('full detail to start', st.quality === 2);
for (let i = 0; i < 30; ++i) B.step(st, 20, 1 / 60);
check('a short stall does not drop the detail', st.quality === 2);
for (let i = 0; i < 90; ++i) B.step(st, 20, 1 / 60);
check('a second over budget drops a step', st.quality === 1);
for (let i = 0; i < 120; ++i) B.step(st, 20, 1 / 60);
check('another second, another step, never below 0', st.quality === 0);
for (let i = 0; i < 600; ++i) B.step(st, 20, 1 / 60);
check('it stays at the floor', st.quality === 0);
for (let i = 0; i < 60 * 3; ++i) B.step(st, 2, 1 / 60);
check('a few calm seconds are not enough to climb', st.quality === 0);
for (let i = 0; i < 60 * 4; ++i) B.step(st, 2, 1 / 60);
check('five calm seconds climb a step', st.quality === 1);
check('the particle budget shrinks with the detail', B.particles(2) === 1 && B.particles(1) < 1 && B.particles(0) < B.particles(1));

/* caps in the running game */
NS.trip.startTrip('career', 0);
NS.cinematics.skip(); G.cine = null;
for (let i = 0; i < B.CAPS.pirates + 30; ++i) NS.pirates.spawn('skimmer', 500, 500);
check('pirates stop at their cap', G.pirates.filter(p => p.alive).length === B.CAPS.pirates);
for (let i = 0; i < B.CAPS.enemies + 50; ++i) NS.enemies.spawn('swarmer', 500, 500, {});
check('enemies stop at theirs', G.enemies.filter(e => e.alive).length === B.CAPS.enemies);
const extra = NS.pirates.spawn('raider', 500, 500);
extra.prey = {};
check('a spawn past the cap is a dud the caller can still touch', extra && !extra.alive);
G.quality = 0;
const n0 = NS.fx.count();
for (let i = 0; i < 4000; ++i) NS.fx.spawn(0, 0, 0, 0, 0, 1, 1, '#fff');
check('at the lowest detail particles stop at the shrunken budget', NS.fx.count() - n0 <= Math.ceil(NS.constants.MAX_PARTICLES * B.particles(0)));
G.quality = 2;
NS.trip.endTrip('dock');

done();
