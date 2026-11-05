'use strict';

/* Every story level is valid (closed border, clear start lane, every open cell reachable through
   portals, eggs reachable) and completable: the autopilot plays each one with the real game
   rules and no upgrades - eating the fruit goal and reaching the exit gate, or freeing the
   guardian - within a few attempts. Also checks the arcade, zen and daily boards. */
const H = require('./harness');
H.installEnv();
global.requestAnimationFrame = () => 0;
let clock = 1700000000000;
Date.now = () => (clock += 7919);
const NS = H.load('systems/sim.js');
const { check, done } = H;
const G = NS.state;

G.screen = 'title';
NS.screens.setScreen = (s) => { G.screen = s; G.screenT = 0; };
NS.screens.toTitle = () => { G.screen = 'title'; };

const L = NS.levels;
const { WORLDS, LEVELS_PER_WORLD } = NS.worlds;

/* structure */
let bad = [];
for (let w = 0; w < WORLDS.length; ++w)
  for (let l = 0; l < LEVELS_PER_WORLD; ++l) {
    const lv = L.storyLevel(w, l);
    const v = L.validate(lv);
    if (!v.ok) bad.push(w + '-' + l + ': ' + v.errors.join(', '));
    if (lv.eggs.length !== 3) bad.push(w + '-' + l + ': ' + lv.eggs.length + ' eggs');
  }
check('all 30 story levels validate', bad.length === 0, bad.join(' | '));

const a = L.storyLevel(2, 3), b = L.storyLevel(2, 3);
check('story levels are deterministic', a.tiles.join('') === b.tiles.join('') && a.eggs.join() === b.eggs.join());

for (const motif of Object.keys(L.MOTIFS)) {
  let ok = true;
  for (let s = 0; s < 20; ++s) {
    const lv = L.buildBoard({ seed: s * 977 + 3, theme: s % 5, motif: motif, crates: 4, portals: s % 3, hazards: { ice: 20, spike: 5 }, eggs: 3 });
    if (!L.validate(lv).ok) ok = false;
  }
  check('motif ' + motif + ' builds valid boards for 20 seeds', ok);
}

const zen = L.buildBoard({ seed: 5, motif: 'none', wrap: true });
check('zen board wraps with no walls', L.validate(zen).ok && zen.tiles.indexOf('#') < 0 && L.step(zen, 0, 3) === 29);

/* completability: the autopilot plays each level with a fresh save */
function playLevel(w, l, maxSeconds) {
  G.save = NS.rules.defaultSave();
  G.save.seen = { intro: true };
  NS.save.refreshStats();
  NS.run.startStory(w, l);
  G.run.auto = true;
  const frames = maxSeconds * 60;
  for (let f = 0; f < frames && G.screen === 'playing'; ++f) NS.sim.update(1 / 60);
  const r = G.ui.results;
  return { cleared: !!(r && r.outcome === 'cleared' && G.screen !== 'playing'), time: G.run ? G.run.time : 0, deaths: G.run ? G.run.deaths : 0 };
}

const failed = [];
const tries = [];
let worst = 0;
for (let w = 0; w < WORLDS.length; ++w)
  for (let l = 0; l < LEVELS_PER_WORLD; ++l) {
    let ok = false, attempt = 0;
    for (; attempt < (l === LEVELS_PER_WORLD - 1 ? 10 : 5) && !ok; ++attempt) {
      G.ui.results = null;
      const r = playLevel(w, l, 300);
      ok = r.cleared;
      if (ok) worst = Math.max(worst, r.time);
    }
    if (!ok) failed.push((w + 1) + '-' + (l + 1));
    tries.push(attempt);
  }
check('the autopilot clears all 30 story levels (5 bosses included)', failed.length === 0, 'failed: ' + failed.join(', '));
console.log('  slowest clear: ' + worst.toFixed(1) + 's of game time; attempts per level: ' + tries.join(' '));

done();
