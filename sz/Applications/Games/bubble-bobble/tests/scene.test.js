'use strict';

/* The whole game in a fake browser: boot onto the title with the demo playing, the story intro
   and map, a room started with its cinematics and played with the keyboard,
   pause and resume, the bot finishing the stage into the results, every screen, every
   cinematic, every mode and every guardian drawing, a busy frame inside the draw-call budget,
   no shadowBlur and warm frames painting nothing new. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;
const key = k => H.key(env, k);
function frames(n, dt) { for (let i = 0; i < n; ++i) { NS.app.update(dt || 1 / 60); NS.frame.draw(); } }
function calls() { const c0 = ctx.calls; NS.frame.draw(); return ctx.calls - c0; }

check('boots onto the title', G.screen === 'title');
frames(30);
check('the title demo plays', G.demo && G.demo.game.time > 0.3);
check('the title draws', calls() > 200);
check('today has quests and a festival', G.profile.quests && G.profile.quests.list.length === 3 && G.season && G.season.name);

NS.widgets.activate(G.hitAreas.find(a => a.id === 't-story'));
check('the first Story opens the intro', G.cine && G.cine.id === 'intro');
frames(3);
key('Escape');
check('Escape skips the intro onto the map', !G.cine && G.screen === 'map');
frames(3);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'play'));
check('Play starts the first room with the kingdom cinematic', G.screen === 'game' && G.cine && G.cine.shots.some(s => s.kind === 'card'));
let err = null;
try { for (let i = 0; i < 400 && G.cine; ++i) { frames(1, 1 / 30); if (i % 20 === 19) NS.cine.next(); } } catch (e) { err = e; console.log(e.stack); }
check('the cinematic plays through the count into the game', !err && !G.cine && G.screen === 'game');
const g = G.run.game;
const x0 = g.player.x;
env.listeners['d:keydown'].forEach(f => f({ key: 'ArrowRight', preventDefault() {} }));
frames(20);
env.listeners['d:keyup'].forEach(f => f({ key: 'ArrowRight', preventDefault() {} }));
check('Right runs', g.player.x > x0 + 20);
env.listeners['d:keydown'].forEach(f => f({ key: ' ', preventDefault() {} }));
frames(2);
env.listeners['d:keyup'].forEach(f => f({ key: ' ', preventDefault() {} }));
check('Space blows a bubble', g.bubbles.length >= 1 || g.stats.trapped >= 1);
env.listeners['d:keydown'].forEach(f => f({ key: 'ArrowUp', preventDefault() {} }));
frames(3);
env.listeners['d:keyup'].forEach(f => f({ key: 'ArrowUp', preventDefault() {} }));
check('Up jumps', !g.player.ground || g.player.vy !== 0);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frames(2);
key('Escape');
check('Escape again resumes with a count', G.screen === 'game' && G.cine && G.cine.id === 'resume');
frames(120);
NS.input.reset();
const bm = {};
for (let i = 0; i < 20000 && G.screen === 'game'; ++i) {
  const run = G.run;
  run.game.lives = Math.max(run.game.lives, 3);
  NS.run.tick(run, 1 / 60, NS.bot.input(run.game, bm), G.profile);
  NS.run.takeEvents(run);
  if (run.done) NS.play.complete();
  if (i % 60 === 0) frames(1, 1 / 60);
}
frames(2);
check('finishing the stage opens the results', G.screen === 'results' && G.result && G.result.won && G.result.stars[0]);
check('the stage is recorded with stars, shards and XP', NS.progress.starsOf(G.profile, 'candy-1') >= 1 && G.result.shards > 0 && G.result.xp > 0);

let errs = [];
for (const s of ['title', 'modes', 'map', 'tree', 'wardrobe', 'journal', 'help', 'results']) {
  try {
    NS.screens.setScreen(s);
    frames(3);
    if (s === 'wardrobe') for (let t = 0; t < 3; ++t) { G.ui.wardTab = t; NS.frame.draw(); }
    if (s === 'journal') for (let t = 0; t < 5; ++t) { G.ui.journalTab = t; NS.frame.draw(); }
    if (s === 'map') for (let w = 0; w < 5; ++w) { G.ui.world = w; NS.frame.draw(); }
  } catch (e) { errs.push(s + ': ' + e.message); console.log(e.stack); }
}
check('every screen draws', errs.length === 0, errs.join(' | '));

const ST = NS.storyData, W = NS.worldData;
const all = [ST.SHOTS.intro, ST.SHOTS.finale];
for (let w = 0; w < 5; ++w) all.push(ST.worldIntro(w, W.WORLDS[w]), ST.bossIntro(w, W.BOSSES[w]), ST.bossWin(w, W.BOSSES[w]));
errs = [];
for (const shots of all) {
  try {
    NS.cine.play(shots, 'test');
    for (let i = 0; i < shots.length; ++i) { frames(4, 0.3); NS.cine.next(); NS.cine.next(); }
    NS.cine.end();
  } catch (e) { errs.push(e.message); console.log(e.stack); }
}
check('every cinematic shot draws', errs.length === 0, errs.join(' | '));

let worst = 0;
errs = [];
for (const mode of ['story', 'arcade', 'blitz', 'zen', 'daily', 'rush']) {
  try {
    NS.play.start(mode, mode === 'story' ? { stage: 'castle-6' } : {});
    NS.cine.end();
    const gg = G.run.game;
    for (const id of ['shoes', 'rapid', 'range', 'big', 'shield', 'magnet']) NS.engine.applyPower(gg, id);
    for (let k = 0; k < 6; ++k) NS.engine.spawnElement(gg);
    gg.time = 60;
    const m = {};
    for (let i = 0; i < 40; ++i) { NS.run.tick(G.run, 1 / 30, NS.bot.input(gg, m), G.profile); NS.run.takeEvents(G.run); frames(1, 1 / 30); }
    for (let i = 0; i < 900; ++i) NS.fx.spawn(640, 360, 0, 0, 2, 5, '#fff', i % 12, 0);
    worst = Math.max(worst, calls());
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('every mode starts and draws with candy, elements and the shade', errs.length === 0, errs.join(' | '));
check('a busy frame stays under 3,000 draw calls', worst < 3000, worst);

/* co-op: the toggle on the modes screen brings Pop into every mode; he draws, gets knocked out
   and floats back on screen, and the results count his traps */
NS.screens.setScreen('modes');
frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'coop'));
check('the co-op toggle switches Pop on and is saved', G.profile.settings.coop === true);
errs = [];
for (const mode of ['story', 'arcade', 'zen', 'rush']) {
  try {
    NS.play.start(mode, mode === 'story' ? { stage: 'candy-2' } : {});
    NS.cine.end();
    if (!G.run.game.buddy) errs.push(mode + ': no Pop');
    const m = {};
    for (let i = 0; i < 60; ++i) { NS.run.tick(G.run, 1 / 30, NS.bot.input(G.run.game, m), G.profile); NS.run.takeEvents(G.run); frames(1, 1 / 30); }
    G.run.game.buddy.inv = 0;
    NS.engine.hurt(G.run.game, 'enemy', G.run.game.buddy);
    for (let i = 0; i < 10; ++i) { NS.play.present({ type: 'die', who: 1, x: 300, y: 300 }); frames(1, 1 / 30); }
    worst = Math.max(worst, calls());
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('Pop joins every mode and draws, knocked out or not', errs.length === 0, errs.join(' | '));
NS.play.start('story', { stage: 'candy-1', seed: 21 });
NS.cine.end();
const cm = {};
for (let i = 0; i < 6000 && G.screen === 'game'; ++i) {
  if (!G.cine) NS.run.tick(G.run, 1 / 30, NS.bot.input(G.run.game, cm), G.profile);
  if (G.run.done) NS.play.complete();
  else frames(1, 1 / 30);
}
check('a co-op room ends in the results with Pop\'s traps counted', G.screen === 'results' && G.result.popTrapped != null && G.profile.stats.coopRooms >= 1, G.result && G.result.won);
G.profile.settings.coop = false;
for (let w = 0; w < 5; ++w) { NS.play.start('story', { stage: W.WORLDS[w].id + '-6' }); NS.cine.end(); frames(2); }
check('every kingdom and guardian draws', G.run.game.boss && G.run.game.boss.w === 4);
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
frames(3);
const s0 = NS.artKit.stats().created;
frames(10);
check('warm frames paint no new sprites', NS.artKit.stats().created === s0, NS.artKit.stats().created - s0);
done();
