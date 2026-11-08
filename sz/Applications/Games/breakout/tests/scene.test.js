'use strict';

/* The whole game in a fake browser: boot onto the title with the demo playing, the story intro
   and map, a stage started with its cinematics and played with the keyboard and the pointer,
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
check('Play starts the first stage with the fortress cinematic', G.screen === 'game' && G.cine && G.cine.shots.some(s => s.kind === 'card'));
let err = null;
try { for (let i = 0; i < 400 && G.cine; ++i) { frames(1, 1 / 30); if (i % 20 === 19) NS.cine.next(); } } catch (e) { err = e; console.log(e.stack); }
check('the cinematic plays through the count into the game', !err && !G.cine && G.screen === 'game');
const g = G.run.game;
check('the ball waits on the paddle', g.balls[0].stuck);
const x0 = g.paddle.x;
env.listeners['d:keydown'].forEach(f => f({ key: 'ArrowLeft', preventDefault() {} }));
frames(10);
env.listeners['d:keyup'].forEach(f => f({ key: 'ArrowLeft', preventDefault() {} }));
check('Left moves the paddle', g.paddle.x < x0 - 20);
key(' ');
frames(2);
check('Space launches the ball', !g.balls[0].stuck);
NS.input.onMove({ clientX: 900, clientY: 400, pointerType: 'mouse' });
frames(20);
check('the mouse steers the paddle', g.paddle.x > x0 + 100);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frames(2);
key('Escape');
check('Escape again resumes with a count', G.screen === 'game' && G.cine && G.cine.id === 'resume');
frames(120);
NS.input.reset();
for (let i = 0; i < 20000 && G.screen === 'game'; ++i) {
  const run = G.run;
  run.game.lives = Math.max(run.game.lives, 3);
  for (let k = 0; k < 4; ++k) NS.run.tick(run, 1 / 120, NS.bot.input(run.game), G.profile);
  NS.run.takeEvents(run);
  if (run.done) NS.play.complete();
  if (i % 60 === 0) frames(1, 1 / 60);
}
frames(2);
check('finishing the stage opens the results', G.screen === 'results' && G.result && G.result.won && G.result.stars[0]);
check('the stage is recorded with stars, shards and XP', NS.progress.starsOf(G.profile, 'neon-1') >= 1 && G.result.shards > 0 && G.result.xp > 0);

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
    NS.play.start(mode, mode === 'story' ? { stage: 'gloom-6' } : {});
    NS.cine.end();
    const gg = G.run.game;
    for (const id of ['multi', 'multi', 'laser', 'fire', 'barrier', 'wide']) NS.engine.applyPower(gg, id);
    NS.engine.launch(gg);
    for (let i = 0; i < 40; ++i) { NS.run.tick(G.run, 1 / 30, NS.bot.input(gg), G.profile); NS.run.takeEvents(G.run); frames(1, 1 / 30); }
    for (let i = 0; i < 900; ++i) NS.fx.spawn(640, 360, 0, 0, 2, 5, '#fff', i % 12, 0);
    worst = Math.max(worst, calls());
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('every mode starts and draws with many balls and power-ups', errs.length === 0, errs.join(' | '));
check('a busy frame stays under 3,000 draw calls', worst < 3000, worst);
for (let w = 0; w < 5; ++w) { NS.play.start('story', { stage: W.WORLDS[w].id + '-6' }); NS.cine.end(); frames(2); }
check('every fortress and guardian draws', G.run.game.boss && G.run.game.boss.w === 4);
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
frames(3);
const s0 = NS.artKit.stats().created;
frames(10);
check('warm frames paint no new sprites', NS.artKit.stats().created === s0, NS.artKit.stats().created - s0);
done();
