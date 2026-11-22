'use strict';

/* The soundtrack follows the game: the mood from what is happening (mining, cruising, a wave or
   an ambush coming, a storm warned, pirates and invaders close, the outpost under attack, a
   mothership), climbing at once and calming down only after quiet seconds, the quiet pair (calm,
   explore) holding a piece two and a half minutes and rotating through variations, one theme across all
   moods in the 16-bit FM styles, switches on the bar line in flight and crossfades between
   screens, and the themes of the station, the menus and the modes. */
const path = require('path');
const H = require('./harness');
H.installEnv();
require(path.join(__dirname, '..', '..', '..', 'shared', 'game-music.js'));
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const MU = NS.music;
const GM = window.SZ.GameMusic;

/* every request the game makes of the shared engine */
const calls = [];
const play0 = GM.play;
GM.play = (song, opts) => { calls.push({ song: song, opts: opts || {} }); return play0(song, opts); };

const FM = { fm16calm: 1, fm16: 1, fm16war: 1 };

/* ── the themes ── */
const all = MU.BELTS.concat([MU.STATION, MU.MENU, MU.RUSH, MU.SIEGE]);
check('five belt themes and four more, all in the 16-bit FM styles', MU.BELTS.length === 5 && all.every(t => FM[t.style]), all.map(t => t.style).join());
const set = MU.moodSongs(MU.BELTS[2]);
check('each theme plays calm, explore, war and boss arrangements', set.calm.style === 'fm16calm' && set.explore.style === 'fm16' && set.war.style === 'fm16war' && set.boss.style === 'fm16war');
check('all four keep the theme\'s key, chords and motif', ['calm', 'explore', 'war'].every(k => set[k].root === set.explore.root && set[k].scale === set.explore.scale &&
  set[k].seed === set.explore.seed && set[k].prog.join() === set.explore.prog.join()));
check('the boss arrangement turns phrygian and heavy', set.boss.scale === 'phrygian' && set.boss.root === set.explore.root && set.boss.bpm < set.war.bpm);
check('the same theme gives the same songs', MU.moodSongs(MU.BELTS[2]) === set);

/* ── the moods ── */
const sig = (o) => Object.assign({ mining: false, cruising: false, docked: false, threats: 0, raid: false, waveSoon: false, storm: false, ambush: false, boss: false }, o);
check('mining or docked is calm', MU.decide(sig({ mining: true })) === 'calm' && MU.decide(sig({ docked: true })) === 'calm' && MU.decide(sig({})) === 'calm');
check('cruising explores', MU.decide(sig({ cruising: true })) === 'explore');
check('a wave coming, a storm warned or an ambush about to strike is tension', MU.decide(sig({ waveSoon: true, mining: true })) === 'tension' &&
  MU.decide(sig({ storm: true })) === 'tension' && MU.decide(sig({ ambush: true, cruising: true })) === 'tension');
check('pirates close or the outpost under attack is combat', MU.decide(sig({ threats: 2, waveSoon: true })) === 'combat' && MU.decide(sig({ raid: true })) === 'combat');
check('a mothership is the boss', MU.decide(sig({ boss: true, threats: 9 })) === 'boss');

let m = MU.newMood();
MU.step(m, 'combat', 0.5);
check('the music climbs at once', m.cur === 'combat');
for (let i = 0; i < 10; ++i) MU.step(m, i % 2 ? 'combat' : 'calm', 1);
check('one passing skimmer does not toss it around', m.cur === 'combat');
for (let i = 0; i < 6; ++i) MU.step(m, 'calm', 1);
check('it waits a few quiet seconds before it calms', m.cur === 'combat');
for (let i = 0; i < 4; ++i) MU.step(m, 'calm', 1);
check('then it calms down', m.cur === 'calm');
m = MU.newMood();
for (let i = 0; i < 60; ++i) MU.step(m, i % 20 < 10 ? 'explore' : 'calm', 1);
check('mining and cruising do not toss the quiet music around', m.cur === 'calm' && m.since >= 59);
for (let i = 0; i < MU.QUIET; ++i) MU.step(m, 'explore', 1);
check('a quiet piece plays two and a half minutes before the music trades places', m.cur === 'explore');
m = MU.newMood();
for (let i = 0; i < MU.QUIET - 1; ++i) MU.step(m, 'calm', 1);
check('a quiet stretch stays with its piece for two and a half minutes', m.piece === 0);
MU.step(m, 'calm', 1);
check('then it moves on to the next variation of the mood', m.piece === 1 && m.since === 0);
for (let i = 0; i < MU.QUIET * 2; ++i) MU.step(m, 'calm', 1);
check('and round the variations', m.piece === 0);
MU.step(m, 'combat', 0.5);
check('a fight still cuts in at once', m.cur === 'combat');
const vs = MU.moodSongs(MU.BELTS[1]);
check('each quiet mood has three pieces in its own style, each a different song', vs.calmV.length === MU.PIECES && vs.exploreV.length === MU.PIECES &&
  vs.calmV.every(v => v.style === 'fm16calm') && new Set(vs.calmV.map(v => v.id)).size === 3 && vs.calmV[0] === vs.calm);

check('each mood names its arrangement, entry and intensity', MU.ARRANGE.calm.song === 'calm' && MU.ARRANGE.tension.song === 'war' && MU.ARRANGE.combat.song === 'war' &&
  MU.ARRANGE.boss.song === 'boss' && MU.ARRANGE.combat.intensity > MU.ARRANGE.tension.intensity && MU.ARRANGE.tension.intensity > MU.ARRANGE.calm.intensity);

/* ── in the running game ── */
const step = (n) => { for (let i = 0; i < n; ++i) { NS.sim.update(1 / 60); MU.update(1 / 60); } };
G.save.seenIntro = true;
G.screen = 'title';
MU.update(1);
check('the title plays the menu theme with a crossfade', GM.current === MU.MENU && !calls[calls.length - 1].opts.onBar);
NS.trip.startTrip('career', 0);
NS.cinematics.skip();
G.screen = 'playing';
G.ship.vx = G.ship.vy = 0;
step(60);
const trip = MU.songsFor();
check('a career trip plays its own variant of the belt theme', trip.calm.id !== MU.moodSongs(MU.BELTS[0]).calm.id && trip.calm.style === 'fm16calm');
check('drifting near the dock is calm', MU.state().cur === 'calm' && GM.current === trip.calm);
const p = NS.pirates.spawn('raider', G.ship.x + 400, G.ship.y);
step(40);
const last = calls[calls.length - 1];
check('a raider closing in starts the battle arrangement on the bar line', MU.state().cur === 'combat' && GM.current === trip.war && last.opts.onBar);
check('battle music goes full', GM.intensity > 0.9);
p.alive = false;
G.pirates.length = 0;
step(60 * 3);
check('it keeps fighting a moment after the last kill', MU.state().cur === 'combat');
step(60 * 9);
check('and calms down after the quiet', MU.state().cur === 'calm' && trip.calmV.indexOf(GM.current) >= 0);
MU.state().since = MU.QUIET;
step(30);
const xf = calls[calls.length - 1];
check('a long quiet crossfades slowly to the next piece', trip.calmV.indexOf(GM.current) >= 0 && xf.opts.fade >= 3 && !xf.opts.onBar && xf.song !== trip.calmV[0]);
G.cmd.on = G.cmd.plan = true;
MU.update(1);
check('pause-and-plan thins the band', GM.intensity < 0.3);
G.cmd.on = G.cmd.plan = false;
NS.trip.endTrip('dock');
MU.update(1);
check('the trip report plays the station theme', GM.current === MU.STATION);

done();
