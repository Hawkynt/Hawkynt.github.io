'use strict';

/* The whole game in a fake browser: boot onto the title with the bot playing the demo; the story
   intro and the map; the first stage started with its cinematic, played through real key events at
   the notes' times into the results with stars, discs and XP; pause and resume with the count-in;
   Retry; the song saved mid-play and continued after a reload at its bar with its score; every screen,
   tab, cinematic, mode, duel attack, mutator, note skin, highway, hit effect and performer drawing; a
   crate opened with its reveal; a busy frame inside the draw-call budget; no shadowBlur; warm frames
   painting nothing new. */
const H = require('./harness');
let env = H.installEnv();
let NS = H.load();
const { check, done } = H;
let G = NS.state;
let ctx = env.gameCanvas.ctx;
function frames(n, dt) { for (let i = 0; i < n; ++i) { NS.app.update(dt || 1 / 60); NS.frame.draw(); } }
function calls() { const c0 = ctx.calls; NS.frame.draw(); return ctx.calls - c0; }
const keyDown = (k, perf) => NS.input.onKeyDown({ key: k, timeStamp: perf, repeat: false, preventDefault() {} });
const keyUp = (k, perf) => NS.input.onKeyUp({ key: k, timeStamp: perf, preventDefault() {} });
const KEYS = ['d', 'f', 'j', 'k'];

/* plays the song in G.run with key events at the bot's times, frame by frame */
function playSong(profile, maxFrames) {
  const r0 = G.run;
  const plan = NS.bot.plan(r0.chart, profile || 'perfect', 9);
  for (let f = 0; f < (maxFrames || 20000) && G.screen === 'game' && G.run === r0; ++f) {
    const c = G.run.cond;
    const dt = 1 / 60;
    while (plan.i < plan.acts.length && plan.acts[plan.i].t <= c.t + dt) {
      const a = plan.acts[plan.i++];
      const perf = c.perf + (a.t - c.t) * 1000;
      if (a.type === 'press') keyDown(KEYS[a.lane], perf); else keyUp(KEYS[a.lane], perf);
    }
    if (G.run.eng.surge >= 0.5) keyDown(' ');
    NS.app.update(dt);
    if (f % 30 === 0) NS.frame.draw();
  }
}

check('boots onto the title', G.screen === 'title');
let focused = 0;
env.gameCanvas.focus = () => { ++focused; };
NS.input.onDown({ clientX: 10, clientY: 10, pointerType: 'mouse', pointerId: 1, preventDefault() {} });
NS.input.onUp({ clientX: 10, clientY: 10, pointerType: 'mouse', pointerId: 1 });
check('a press anywhere in the game focuses its canvas, so the keys reach it', focused === 1);
frames(120);
check('the bot plays the demo song behind the title', G.run && G.run.mode === 'demo' && G.run.eng.counts.perfect + G.run.eng.counts.great > 0);
check('the title draws', calls() > 200);
check('today has quests, a weekly challenge and a festival', G.profile.quests.list.length === 3 && G.profile.weekly && G.season && G.season.name);

NS.widgets.activate(G.hitAreas.find(a => a.id === 't-story'));
check('the first Story opens the intro', G.cine && G.cine.id === 'intro');
frames(3);
H.key(env, 'Escape');
check('Escape skips the intro onto the map', !G.cine && G.screen === 'map');
frames(3);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'play'));
check('Play starts the first stage with the district\'s cinematic', G.screen === 'game' && G.cine && G.cine.shots.some(s => s.kind === 'card'));
let err = null;
try { for (let i = 0; i < 400 && G.cine; ++i) { frames(1, 1 / 30); if (i % 20 === 19) NS.cine.next(); } } catch (e) { err = e; console.log(e.stack); }
check('the cinematic plays into the song', !err && !G.cine && G.screen === 'game');
check('the song counts in before its first bar', G.run.cond.t < 0);
frames(30);
keyDown('Escape');
check('Escape pauses and stops the clock', G.screen === 'paused' && G.run.cond.paused);
const tPaused = G.run.cond.t;
frames(30);
check('nothing moves while paused', G.run.cond.t === tPaused);
keyDown('Escape');
check('Escape resumes, rejoining at a bar with a count-in', G.screen === 'game' && G.run.cond.t < tPaused + 0.01);
try { playSong('perfect'); } catch (e) { err = e; console.log(e.stack); }
check('playing through the song with key events opens the results', !err && G.screen === 'results' && G.result && G.result.cleared);
check('the key presses landed', G.result.counts.perfect + G.result.counts.great > G.result.counts.miss * 4, JSON.stringify(G.result.counts));
check('the stage is recorded with stars, discs and XP', NS.progress.starsOf(G.profile, 'docks-1') >= 2 && G.result.discs > 0 && G.result.xp > 0);
frames(90);
check('the results draw with Retry and Next', G.hitAreas.some(a => a.id === 'retry') && G.hitAreas.some(a => a.id === 'next'));
keyDown('r');
check('R retries the song', G.screen === 'game' && G.run.stage.id === 'docks-1' && !G.result);

/* save mid-song, reload, continue */
for (let i = 0; i < 1400 && G.run.cond.t < 12; ++i) NS.app.update(1 / 60);
const r1 = G.run;
const hits = NS.bot.plan(r1.chart, 'perfect', 1);
for (const a of hits.acts) if (a.type === 'press' && a.t < r1.cond.t - 0.2 && a.t > r1.cond.t - 6) { NS.play.press(a.lane); NS.play.release(a.lane); }
r1.eng.score = 12345;
r1.eng.combo = 17;
NS.save.saveRun(r1);
check('a song in progress is saved', !!env.store['sz-rhythm-game-run']);
env = H.installEnv({ store: env.store });
ctx = env.gameCanvas.ctx;
NS = H.load();
G = NS.state;
const saved = NS.save.loadRun();
check('after a reload the saved song is there', saved && saved.eng.score === 12345 && saved.recipe.stage === 'docks-1');
frames(2);
check('the title offers Continue', G.hitAreas.some(a => a.id === 't-cont'));
NS.widgets.activate(G.hitAreas.find(a => a.id === 't-cont'));
check('Continue rejoins the song at the bar it reached with its score and combo', G.screen === 'game' && G.run.eng.score === 12345 && G.run.eng.combo === 17
  && G.run.cond.bar === Math.floor((saved.t + 0.05) / G.run.chart.barLen) && G.run.cond.bar > 0);
frames(10);

/* every screen and tab */
let errs = [];
const tabs = { shop: ['shopTab', 4], wardrobe: ['wardTab', 4], journal: ['journalTab', 5], map: ['world', 5] };
for (const s of ['title', 'modes', 'map', 'library', 'tree', 'shop', 'wardrobe', 'journal', 'settings', 'help']) {
  try {
    NS.screens.setScreen(s);
    frames(3);
    if (tabs[s]) for (let t = 0; t < tabs[s][1]; ++t) { G.ui[tabs[s][0]] = t; NS.frame.draw(); }
  } catch (e) { errs.push(s + ': ' + e.message); console.log(e.stack); }
}
G.ui.remix = true; NS.screens.setScreen('map'); frames(2); G.ui.remix = false;
check('every screen and tab draws', errs.length === 0, errs.join(' | '));

/* calibration */
NS.screens.setScreen('settings');
frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'calib-start'));
const c0 = G.ui.calib.t0;
for (let k = 2; k < NS.settings.CLICKS; ++k) NS.settings.tap(c0 + k * NS.settings.BEAT + 0.03);
G.ui.calib.t0 -= 30;
frames(2);
check('the calibration test turns taps 30 ms late into a +30 ms offset', G.ui.calib.done && G.profile.settings.offset === 30);
G.profile.settings.offset = 0;

/* a crate */
G.profile.crates.owned = 2;
NS.screens.setScreen('shop'); G.ui.shopTab = 3; frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'crate-open'));
check('opening a crate starts the reveal', G.ui.crate && G.ui.crate.rolls.length === 3 && G.profile.crates.owned === 1);
frames(200);
check('the three cards flip one by one', G.ui.crate.shown === 3 && G.hitAreas.some(a => a.id === 'crate-done'));
NS.widgets.activate(G.hitAreas.find(a => a.id === 'crate-done'));

/* every cinematic */
const ST = NS.storyData, WD = NS.worldData;
const all = [ST.SHOTS.intro, ST.SHOTS.finale];
for (let w = 0; w < 5; ++w) all.push(ST.worldIntro(w, WD.WORLDS[w]), ST.bossIntro(w, WD.BOSSES[w]), ST.bossWin(w, WD.BOSSES[w]));
errs = [];
for (const shots of all) {
  try {
    NS.cine.play(shots, 'test');
    for (let i = 0; i < shots.length; ++i) { frames(4, 0.3); NS.cine.next(); NS.cine.next(); }
    NS.cine.end();
  } catch (e) { errs.push(e.message); console.log(e.stack); }
}
check('every cinematic shot draws', errs.length === 0, errs.join(' | '));

/* every mode, every duel attack, busy frames */
let worst = 0;
errs = [];
const modes = [['story', { stage: 'docks-6' }], ['story', { stage: 'gardens-6' }], ['story', { stage: 'foundry-6' }], ['story', { stage: 'club-6' }], ['story', { stage: 'spire-6' }],
  ['free', { song: 'rg-shop-funk', diff: 'expert' }], ['free', { song: NS.songData.stageSong(0, 0).id, diff: 'easy', speed: 0.75 }], ['daily', {}], ['weekly', {}], ['zen', {}], ['marathon', {}], ['bossrush', { stage: 'docks-6' }], ['remix', { stage: 'club-3' }]];
G.profile.owned.songs['rg-shop-funk'] = true;
for (const [mode, opts] of modes) {
  try {
    NS.play.start(mode, opts);
    NS.cine.end();
    const r = G.run;
    for (let i = 0; i < 200; ++i) NS.app.update(1 / 20);
    if (r.eng.boss) {
      for (const a of r.chart.attacks.slice(0, 5)) { r.eng.attack = { kind: a.kind, slot: a.i, t1: 0, t2: 999 }; G.ui.banner = { kind: a.kind, t: 0.5, at: r.eng.t + 1 }; NS.frame.draw(); }
      r.eng.boss.rage = true;
    }
    r.eng.surgeOn = r.eng.t + 4; r.eng.groove = 0.1; G.input.lanes = [true, false, true, false];
    for (let i = 0; i < 800; ++i) NS.fx.spawn(640, 360, 0, 0, 2, 5, '#fff', i % 14, 0);
    worst = Math.max(worst, calls());
    G.input.lanes = [false, false, false, false];
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('every mode starts and draws with attacks, Surge, low groove and pressed lanes', errs.length === 0, errs.join(' | '));
check('a busy frame stays under 2,500 draw calls', worst < 2500, worst);
if (process.env.DEBUG) console.log('worst frame', worst);
errs = [];
NS.play.start('free', { song: 'rg-shop-funk', diff: 'hard', mutators: ['hidden', 'sudden', 'sight', 'mirror'] });
for (let i = 0; i < 100; ++i) NS.app.update(1 / 20);
try { NS.frame.draw(); } catch (e) { errs.push('mutators: ' + e.message); }
const M = NS.metaData;
for (const slot of Object.keys(M.SLOTS)) for (const item of M.SLOTS[slot]) {
  try { G.profile.owned.cos[item.id] = true; G.profile.equip[slot] = item.id; NS.frame.draw(); } catch (e) { errs.push(item.id + ': ' + e.message); }
}
check('every mutator, note skin, highway, hit effect and performer draws', errs.length === 0, errs.join(' | '));
/* the song clock follows what is heard: the audio time minus the output latency */
{
  const CD = NS.conductor;
  const c = CD.create(G.run.chart, { lead: 0 });
  const realA = window.SZ.GameAudio, realM = window.SZ.GameMusic;
  window.SZ.GameAudio = Object.assign({}, realA, { running: true, muted: false, context: { currentTime: 3, outputLatency: 0.03, baseLatency: 0.01 } });
  window.SZ.GameMusic = { enabled: true, current: c.song, schedule: { startedAt: 1, song: c.song }, play() {}, setIntensity() {} };
  c.started = true;
  CD.update(c, 1 / 60);
  check('the song clock subtracts the output latency from the audio time', Math.abs(c.t - (3 - 0.03 - 1)) < 1e-9, c.t);
  window.SZ.GameMusic = { enabled: true, current: c.song, schedule: { startedAt: 1, song: {} }, play() {}, setIntensity() {} };
  const before = c.t;
  CD.update(c, 1 / 60);
  check('and ignores a schedule that belongs to another song', Math.abs(c.t - before - 1 / 60) < 1e-9);
  window.SZ.GameAudio = realA; window.SZ.GameMusic = realM;
}
NS.screens.setScreen('results');
check('popups on the results stack under the grade, clear of the headline and the buttons', (() => { const L = NS.screens.toastLayout(); return L.top >= 480 && L.top + L.shown * 42 < 600 && L.cx + L.maxW / 2 <= 450; })());
NS.screens.setScreen('title');
check('and at the top elsewhere', NS.screens.toastTop() < 40);
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
frames(3);
const s0 = NS.artKit.stats().created;
const keys0 = Object.keys(NS.artKit.cache);
frames(10);
if (process.env.DEBUG) console.log(Object.keys(NS.artKit.cache).filter(k => keys0.indexOf(k) < 0));
check('warm frames paint no new sprites', NS.artKit.stats().created === s0, NS.artKit.stats().created - s0);
done();
