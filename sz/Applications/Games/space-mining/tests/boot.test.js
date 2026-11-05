'use strict';

/* Boot and flow: the whole game loads in index.html order, every screen and every cinematic
   draws, input reaches the game (keys, clicks through hit areas, cinematic skipping), and the
   Gold Rush and Daily Belt runs end in a scored report. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;

check('the game starts on the title', G.screen === 'title' && G.save.v === 2);
const key = (code, extra) => env.listeners.keydown.forEach(f => f(Object.assign({ code: code, key: code, preventDefault() {} }, extra || {})));
const keyUp = (code) => env.listeners.keyup.forEach(f => f({ code: code, key: code, preventDefault() {} }));

let errors = 0;
function frames(n) {
  try { H.run(NS, n, 3); } catch (e) { ++errors; console.log(e.stack); }
}
frames(30);
check('the title registers its menu', G.hitAreas.some(h => h.id === 'career') && G.hitAreas.some(h => h.id === 'tree'));

for (const s of ['station', 'map', 'tree', 'help']) {
  NS.screens.setScreen(s);
  frames(10);
}
for (const t of NS.station.TABS) {
  NS.screens.setScreen('station');
  G.ui.stationTab = t.id;
  frames(6);
}
check('every menu screen draws', errors === 0);
key('Tab');
check('Tab cycles the station tabs', G.ui.stationTab === 'market');

/* cinematics, skipped by a key */
for (const k of ['intro', 'launch', 'milestone', 'ending']) {
  NS.cinematics.play(k, { zone: NS.ores.ZONES[2] });
  frames(60);
  key('KeyX');
  check(k + ' cinematic plays and skips', !G.cine);
}
check('cinematics draw without errors', errors === 0);

/* a career trip with real keys */
G.save.seenIntro = true;
NS.trip.startTrip('career', 0);
check('a trip opens with the arrival sequence', G.cine && G.cine.kind === 'arrival' && G.screen === 'playing');
frames(60 * 4);
check('arrival hands control back', !G.cine && G.ship.control);
const y0 = G.ship.y;
key('KeyW');
frames(40);
keyUp('KeyW');
check('W thrusts the ship up', G.ship.y < y0 - 20);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frames(10);
NS.screens.openTree('paused');
frames(5);
G.save.rd = 50;
NS.tree.buy('f_shield');
check('research from the pause menu applies at once', G.ship.maxShield === 25 && G.stats.shield === 25);
NS.screens.setScreen('paused');
key('Escape');
check('Escape resumes', G.screen === 'playing');
NS.trip.abort();
frames(80);
check('a tow ends the trip in a report', G.screen === 'results' && G.ui.results.reason === 'tow');
key('Escape');
check('the report leads to the station', G.screen === 'station');

/* modes */
for (const m of ['rush', 'daily']) {
  NS.trip.startTrip(m, 1);
  NS.cinematics.skip();
  frames(60 * 3);
  G.run.cargo = { gold: 4 };
  NS.trip.quickSell();
  check(m + ': docking sells on the spot', G.run.sold === 4 * NS.ores.ORE_BY_ID.gold.value);
  G.run.timeLeft = 0.05;
  frames(120);
  check(m + ': the clock ends the run with a score', G.screen === 'results' && G.ui.results.score >= 4 * NS.ores.ORE_BY_ID.gold.value);
}
check('scores reach the high-score table', G.save.highScores.some(h => h.mode === 'rush') && G.save.highScores.some(h => h.mode === 'daily'));
check('no runtime errors', errors === 0);

done();
