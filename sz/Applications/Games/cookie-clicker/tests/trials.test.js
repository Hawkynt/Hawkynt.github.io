'use strict';

/* Sanctum Trials, music and save codes: trials open after the first ascension, each rule bites
   (no click power, striking grandmas, taxed prices, slow ovens, no golden treats, a producer
   cap), reaching the goal era completes the trial with its cinematic and a lasting production
   bonus, abandoning lifts the rule, cosmetics unlock at 3 and 6; the soundtrack picks a theme
   per era, mode and season and the shared composer is deterministic; a save exports to a code
   and imports back. */
const H = require('./harness');
const env = H.installEnv();
require('../../../shared/game-music.js');
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const T = NS.trials;
const M = window.SZ.GameMusic;
const ctx = env.gameCanvas.ctx;

G.profile.seenIntro = true;
NS.screens.setScreen('game');

check('six trials', T.TRIALS.length === 6);
check('trials are closed before the first ascension', !T.available() && !T.begin('hands'));
G.profile.ascensions = 1;
check('they open after it', T.available());

/* Hands Off */
check('a trial begins a fresh bakery under its rule', T.begin('hands') && G.run.trial === 'hands' && G.run.baked === 0 && G.cine && G.cine.id === 'trialStart');
NS.cinematics.skip();
NS.production.refresh(true);
check('Hands Off: clicks bake nothing', G.st.click === 0);
const b0 = G.run.baked;
NS.clicking.click(false);
check('a click adds nothing', G.run.baked === b0);

/* the rule's other faces */
const run = G.run;
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.strike.mods));
NS.production.invalidate(); NS.production.refresh(true);
check('Grandma Strike: grandmas bake nothing', G.st.per.grandma === 0 && G.st.per.farm > 0);
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.tax.mods));
NS.production.invalidate(); NS.production.refresh(true);
const normal = NS.economy.buildingCost(run, Object.assign({}, G.st, { costMul: 1 }), 'cursor', 1);
check('Sugar Tax: producers cost ten times as much', NS.economy.buildingCost(run, G.st, 'cursor', 1) >= normal * 9.9);
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.slow.mods));
const before = NS.economy.compute(Object.assign({}, run, { mods: null }), G.profile, {});
NS.production.invalidate(); NS.production.refresh(true);
check('Slow Oven: producers at a tenth, clicks x10', Math.abs(G.st.per.cursor / before.per.cursor - 0.1) < 1e-9 && G.st.click > before.click * 9);
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.dark.mods));
NS.production.invalidate(); NS.production.refresh(true);
run.goldenTimer = 0.01;
G.goldens.length = 0;
NS.golden.update(0.1);
check('Lights Out: no golden treats spawn', G.goldens.length === 0);
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.lean.mods));
NS.production.invalidate(); NS.production.refresh(true);
run.cookies = 1e30;
run.buildings.cursor = 25;
check('Lean Kitchen: no 26th producer', !NS.purchasing.buyBuilding('cursor') && run.buildings.cursor === 25);
run.mods = JSON.parse(JSON.stringify(NS.trialData.BY_ID.hands.mods));
run.mods.name = 'Hands Off';

/* completing */
const prod0 = NS.economy.compute(run, G.profile, {}).trialF;
NS.production.earn(run, 1e9 + 1);
NS.app.update(1 / 60);
while (G.cine) NS.cinematics.skip();
check('reaching the goal era completes the trial', G.profile.trials.hands && !G.run.trial && !G.run.mods);
check('the best time is kept', G.profile.trialBest.hands > 0 || G.profile.trialBest.hands === 0);
NS.production.invalidate(); NS.production.refresh(true);
check('a completed trial adds +10% production', Math.abs(G.stMain.trialF - prod0 - 0.1) < 1e-9, G.stMain.trialF);
check('the bakery carries on with clicks back', G.st.click > 0);
check('the completion cinematic exists', NS.cinematics.build('trialDone', { trial: NS.trialData.BY_ID.hands, first: true, time: 60 }).length >= 3);

/* abandoning */
T.begin('tax');
NS.cinematics.skip();
check('abandoning lifts the rule', T.abandon() && !G.run.trial && !G.run.mods && !G.profile.trials.tax);

/* cosmetics and achievements */
G.profile.trials = { hands: true, strike: true, tax: true };
NS.progression.checkUnlocks();
const skin = NS.treatData.SKINS.find(s => s.id === 'sanctum');
check('three trials unlock the Sanctum Glass skin', NS.progression.isUnlocked(skin, 'skin'));
G.profile.trials = { hands: true, strike: true, tax: true, slow: true, dark: true, lean: true };
NS.progression.checkAchievements();
check('all six give their achievements', G.profile.achievements['tr-all'] && G.profile.achievements['tr-lean']);

/* screens */
let err = null;
try {
  for (const s of ['trials', 'ascend', 'paused']) { NS.screens.setScreen(s); NS.app.update(1 / 60); NS.frame.draw(); }
  T.begin('dark'); NS.cinematics.skip(); NS.screens.setScreen('game'); NS.frame.draw();
} catch (e) { err = e; console.log(e.stack); }
check('trial screens and the trial pill draw', !err);

/* music */
check('the shared composer is available', !!M && typeof M.compose === 'function');
const song = NS.music.ERA[0];
const a = JSON.stringify(M.compose(song, 3, 1)), b = JSON.stringify(M.compose(song, 3, 1));
check('composing is deterministic', a === b && a.length > 20);
check('bars vary over a phrase', JSON.stringify(M.compose(song, 0, 1)) !== JSON.stringify(M.compose(song, 2, 1)));
const low = M.compose(song, 1, 0).length, high = M.compose(song, 1, 1).length;
check('intensity brings layers in', high > low, low + ' / ' + high);
const notes = M.compose(NS.music.ERA[7], 5, 1);
check('notes stay in a sane range and inside the bar', notes.every(n => n.t >= 0 && n.t < 16 && (n.midi === 0 || (n.midi > 20 && n.midi < 110))));
check('every era has a theme and they differ', NS.music.ERA.length === 8 && new Set(NS.music.ERA.map(s => s.bpm + s.scale + s.root)).size === 8);
G.season = 'halloween';
const spooky = NS.music.flavour(song, 'halloween');
check('Halloween turns a major theme spooky', spooky.scale === 'harmonic' && song.scale === 'major');
NS.screens.setScreen('zen');
check('the Zen Kitchen has its calm theme', NS.music.themeFor() === NS.music.ZEN);
NS.screens.setScreen('garden');
check('the garden has its own theme', NS.music.themeFor() === NS.music.GARDEN);
NS.screens.setScreen('game');
check('a trial plays the trial theme', NS.music.themeFor() === NS.music.TRIAL);
NS.music.update(1);
check('the music follows the screen', M.current && M.current.id.indexOf('cc-trial') === 0);
check('the music switch toggles and is remembered', (M.toggle(), !M.enabled && env.store['sz-game-music-off'] === '1') && (M.toggle(), M.enabled));

/* save codes */
G.profile.garden.known.moonmelon = true;
const code = NS.app.exportCode();
check('a save exports to a code', /^SZCC1:/.test(code));
G.profile.garden.known = { butterwheat: true };
check('a bad code is refused', !NS.app.importCode('nonsense') && !NS.app.importCode('SZCC1:@@@'));
check('a code imports back', NS.app.importCode(code) && G.profile.garden.known.moonmelon && G.profile.trials.lean);
check('no shadowBlur', ctx.shadowBlurUsed === 0);
done();
