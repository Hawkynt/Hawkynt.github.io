'use strict';

/* The whole game in a fake browser: boot onto the title with the demo sweeping; the story intro and
   map; a stage started with its cinematics and played with the mouse as in the classic game (left
   press and release opens, right press flags, both buttons chord) and the keyboard (cursor, Space,
   F); Tock's face starts a new Classic game; pause and resume; the bot finishing the stage into the
   results; Classic from its screen with a best time recorded; every screen, every cinematic, every
   mode and every guardian drawing; a busy frame inside the draw-call budget; no shadowBlur; warm
   frames painting nothing new. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = env.gameCanvas.ctx;
const key = k => H.key(env, k);
function frames(n, dt) { for (let i = 0; i < n; ++i) { NS.app.update(dt || 1 / 60); NS.frame.draw(); } }
function calls() { const c0 = ctx.calls; NS.frame.draw(); return ctx.calls - c0; }
const ptr = (type, x, y, button, buttons) => NS.input[type]({ clientX: x, clientY: y, button: button || 0, buttons: buttons || 0, pointerType: 'mouse', pointerId: 1, type: type === 'onUp' ? 'pointerup' : 'pointerdown' });
function cellCentre(i) { const g = G.run.game, L = NS.boardRender.layout(g); return { x: L.x0 + (i % g.w + 0.5) * L.s, y: L.y0 + (Math.floor(i / g.w) + 0.5) * L.s }; }
function click(i, button) { const c = cellCentre(i); ptr('onMove', c.x, c.y); ptr('onDown', c.x, c.y, button || 0, button === 2 ? 2 : 1); ptr('onUp', c.x, c.y, button || 0, 0); }

check('boots onto the title', G.screen === 'title');
frames(60);
check('the title demo sweeps a field', G.demo && G.demo.game.opened > 0);
check('the title draws', calls() > 200);
check('today has quests and a festival', G.profile.quests && G.profile.quests.list.length === 3 && G.season && G.season.name);

NS.widgets.activate(G.hitAreas.find(a => a.id === 't-story'));
check('the first Story opens the intro', G.cine && G.cine.id === 'intro');
frames(3);
key('Escape');
check('Escape skips the intro onto the map', !G.cine && G.screen === 'map');
frames(3);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'play'));
check('Play starts the first stage with the land cinematic', G.screen === 'game' && G.cine && G.cine.shots.some(s => s.kind === 'card'));
let err = null;
try { for (let i = 0; i < 400 && G.cine; ++i) { frames(1, 1 / 30); if (i % 20 === 19) NS.cine.next(); } } catch (e) { err = e; console.log(e.stack); }
check('the cinematic plays into the game', !err && !G.cine && G.screen === 'game');
frames(2);
const g = G.run.game;
const mid = Math.floor(g.h / 2) * g.w + Math.floor(g.w / 2);
const c = cellCentre(mid);
ptr('onMove', c.x, c.y);
ptr('onDown', c.x, c.y, 0, 1);
check('a held left button presses the cell down', NS.input.pressedCells() && NS.input.pressedCells()[0] === mid && NS.hud.faceState(G.run) === 'press');
frames(1);
ptr('onUp', c.x, c.y, 0, 0);
check('releasing opens it and the field floods', g.state === 'play' && g.opened > 1);
frames(10);
const closed = g.open.findIndex((o, i) => !o && g.mine[i]);
click(closed, 2);
check('a right click flags', g.flag[closed] === 1);
/* chord with both buttons on a satisfied number */
const nb = NS.board.neighbours(g.w, g.h);
let chordCell = -1;
for (let i = 0; i < g.w * g.h && chordCell < 0; ++i) if (g.open[i] && g.num[i] > 0 && nb[i].some(j => !g.open[j] && !g.mine[j])) chordCell = i;
if (chordCell >= 0) {
  for (const j of nb[chordCell]) if (g.mine[j] && g.flag[j] !== 1) NS.engine.setFlag(g, j, true);
  const before = g.opened, cc = cellCentre(chordCell);
  ptr('onMove', cc.x, cc.y);
  ptr('onDown', cc.x, cc.y, 0, 1);
  ptr('onDown', cc.x, cc.y, 2, 3);
  ptr('onUp', cc.x, cc.y, 2, 1);
  ptr('onUp', cc.x, cc.y, 0, 0);
  check('both buttons on a satisfied number chord it', g.opened > before);
} else check('the field offers a number to chord', false);
/* keyboard */
key('ArrowLeft');
check('an arrow key shows the cell cursor', G.input.cursor >= 0);
const cur = G.input.cursor;
key('d');
check('WASD moves it too', G.input.cursor === cur + 1 || cur % g.w === g.w - 1);
const target = g.open.findIndex((o, i) => !o && !g.mine[i] && g.flag[i] === 0);
G.input.cursor = target;
key(' ');
check('Space opens the cell under the cursor', g.open[target] === 1);
const fl = g.open.findIndex((o, i) => !o && g.flag[i] === 0);
G.input.cursor = fl;
key('f');
check('F flags it', g.flag[fl] === 1);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frames(2);
key('Escape');
check('Escape again resumes with a count', G.screen === 'game');
for (let i = 0; i < 200 && G.cine; ++i) frames(1, 1 / 30);
/* the bot finishes it */
for (let i = 0; i < 3000 && G.screen === 'game'; ++i) {
  const a = NS.bot.next(G.run.game);
  if (a) NS.play.act(a.type === 'flag' ? 'flag' : 'reveal', a.i);
  frames(1, 1 / 30);
}
check('finishing the stage opens the results', G.screen === 'results' && G.result && G.result.won && G.result.stars[0]);
check('the stage is recorded with stars, shards and XP', NS.progress.starsOf(G.profile, 'meadow-1') >= 1 && G.result.shards > 0 && G.result.xp > 0);
frames(20);

/* Classic */
NS.screens.setScreen('classic', 'title');
frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'cl-beginner'));
check('the Classic screen starts Beginner straight away', G.screen === 'game' && G.run.mode === 'classic' && G.run.game.w === 9 && !G.cine);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'face'));
check('Tock\'s face starts a new game', G.screen === 'game' && G.run.mode === 'classic' && G.run.game.state === 'ready');
G.run.proven = true;
G.run.game.noGuess = true;
for (let i = 0; i < 2000 && G.screen === 'game'; ++i) {
  const a = NS.bot.next(G.run.game);
  if (a) NS.play.act(a.type === 'flag' ? 'flag' : 'reveal', a.i);
  frames(1, 1 / 10);
}
check('a won Classic game records a best time and a win', G.result && G.result.won && G.profile.stats.bestTimes.beginner > 0 && G.profile.stats.classicWins.beginner === 1 && G.profile.scores.classic.beginner.length === 1);
frames(5);

/* every screen */
let errs = [];
for (const s of ['title', 'modes', 'classic', 'map', 'tree', 'wardrobe', 'journal', 'help', 'results']) {
  try {
    NS.screens.setScreen(s);
    frames(3);
    if (s === 'wardrobe') for (let t = 0; t < 3; ++t) { G.ui.wardTab = t; NS.frame.draw(); }
    if (s === 'journal') for (let t = 0; t < 5; ++t) { G.ui.journalTab = t; NS.frame.draw(); }
    if (s === 'map') for (let w = 0; w < 5; ++w) { G.ui.world = w; NS.frame.draw(); }
  } catch (e) { errs.push(s + ': ' + e.message); console.log(e.stack); }
}
check('every screen draws', errs.length === 0, errs.join(' | '));

/* every cinematic */
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

/* every mode, every tile set, busy frames */
let worst = 0;
errs = [];
const modes = [['story', { stage: 'rust-6' }], ['classic', { diff: 'expert' }], ['classic', { diff: 'custom' }], ['daily', {}], ['zen', {}], ['rush', {}], ['gauntlet', {}], ['versus', { cpu: 'ace' }]];
for (const [mode, opts] of modes) {
  try {
    NS.play.start(mode, opts);
    NS.cine.end();
    const gg = G.run.game;
    NS.play.act('reveal', Math.floor(gg.h / 2) * gg.w + Math.floor(gg.w / 2));
    for (let i = 0; i < 40; ++i) { const a = NS.bot.next(G.run.game); if (a) NS.play.act(a.type === 'flag' ? 'flag' : 'reveal', a.i); frames(1, 1 / 20); }
    if (G.run && G.run.game && G.run.game.state === 'play') { NS.engine.fog(G.run.game, 4, 3); NS.engine.rebury(G.run.game, 3); G.run.game.flagLockT = 2; G.run.dark = true; G.input.hoverCell = 5; }
    for (let i = 0; i < 900; ++i) NS.fx.spawn(640, 360, 0, 0, 2, 5, '#fff', i % 12, 0);
    worst = Math.max(worst, calls());
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('every mode starts and draws with smoke, mounds, frost and Lantern Night', errs.length === 0, errs.join(' | '));
check('a busy frame stays under 3,000 draw calls', worst < 3000, worst);
errs = [];
for (const t of NS.metaData.TILES) {
  try { G.profile.cosmetics.tile = t.id; NS.frame.draw(); } catch (e) { errs.push(t.id + ': ' + e.message); }
}
for (const f of NS.metaData.FLAGS) {
  try { G.profile.cosmetics.flag = f.id; NS.frame.draw(); } catch (e) { errs.push(f.id + ': ' + e.message); }
}
check('every tile set and flag draws', errs.length === 0, errs.join(' | '));
G.profile.cosmetics.tile = 'meadow'; G.profile.cosmetics.flag = 'pennant';
for (let w = 0; w < 5; ++w) { NS.play.start('story', { stage: W.WORLDS[w].id + '-6' }); NS.cine.end(); NS.play.act('reveal', 100); frames(2); }
check('every land and guardian draws', G.run.bossState && G.run.bossState.w === 4);
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
frames(3);
const s0 = NS.artKit.stats().created;
frames(10);
check('warm frames paint no new sprites', NS.artKit.stats().created === s0, NS.artKit.stats().created - s0);
done();
