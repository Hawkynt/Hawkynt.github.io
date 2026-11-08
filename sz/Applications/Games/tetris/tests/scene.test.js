'use strict';

/* The whole game in a fake browser: boot onto the title with the demo playing, the story intro
   and map, a stage started with its cinematics and played from the keyboard (moves, turns,
   hold, drops, a power), pause and resume, every screen and every cinematic shot draws, every
   realm and guardian draws, a busy frame stays inside the draw-call budget, nothing uses
   shadowBlur, and the results screen settles a finished game. */
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
check('the title demo plays', G.demo && G.demo.game.pieces >= 1);
check('the title draws', calls() > 200);
check('today has quests and a festival', G.profile.quests && G.profile.quests.list.length === 3 && G.season && G.season.name);

/* story */
const story = G.hitAreas.find(a => a.id === 't-story');
NS.widgets.activate(story);
check('the first Story opens the intro', G.cine && G.cine.id === 'intro');
frames(3);
key('Escape');
check('Escape skips the intro onto the map', !G.cine && G.screen === 'map');
frames(3);
const play = G.hitAreas.find(a => a.id === 'play');
NS.widgets.activate(play);
check('Play starts the first stage with the realm cinematic', G.screen === 'game' && G.cine && G.cine.shots.some(s => s.kind === 'card'));
let shotErr = null;
try { for (let i = 0; i < 400 && G.cine; ++i) { frames(1, 1 / 30); if (i % 20 === 19) NS.cine.next(); } } catch (e) { shotErr = e; console.log(e.stack); }
check('the cinematic plays through to the count and the game', !shotErr && !G.cine && G.screen === 'game');
const g = G.run.game;
const x0 = g.piece.x;
key('ArrowLeft');
check('Left moves the piece', g.piece.x === x0 - 1);
key('ArrowUp');
check('Up turns it', g.piece.r === 1 || g.piece.t === 'O');
const xw = g.piece.x, rw = g.piece.r;
key('a');
check('A moves left like Left', g.piece.x === xw - 1);
key('d');
check('D moves right like Right', g.piece.x === xw);
key('w');
check('W turns like Up', g.piece.r === ((rw + 1) & 3) || g.piece.t === 'O');
key('q');
check('Q turns half way', g.piece.r === ((rw + 3) & 3) || g.piece.t === 'O');
key('c');
check('C holds', g.hold);
const p0 = g.pieces;
key(' ');
check('Space hard drops', g.pieces === p0 + 1);
G.run.powers = ['sweep'];
key('e');
check('E uses a power', G.run.powers.length === 0 && G.run.powersUsed === 1);
frames(30);
key('Escape');
check('Escape pauses', G.screen === 'paused');
frames(2);
key('Escape');
check('Escape again resumes with a count', G.screen === 'game' && G.cine && G.cine.id === 'resume');
frames(120);
check('then play goes on', !G.cine);

/* play the stage to the end with the bot */
for (let i = 0; i < 4000 && G.screen === 'game'; ++i) {
  if (G.run.game.piece && !G.run.game.clearing) NS.bot.playPiece(G.run.game);
  frames(1, 1 / 15);
}
check('finishing the stage opens the results', G.screen === 'results' && G.result && G.result.won && G.result.stars[0]);
check('the stage is recorded with stars, shards and XP', NS.progress.starsOf(G.profile, 'verdant-1') >= 1 && G.result.shards > 0 && G.result.xp > 0);
frames(20);

/* every screen */
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

/* every cinematic */
const ST = NS.storyData, W = NS.worldData;
const all = [ST.SHOTS.intro, ST.SHOTS.finale];
for (let w = 0; w < 5; ++w) all.push(ST.worldIntro(w, W.WORLDS[w]), ST.bossIntro(w, W.BOSSES[w]), ST.bossWin(w, W.BOSSES[w]));
errs = [];
for (const shots of all) {
  try {
    NS.cine.play(shots, 'test');
    for (let i = 0; i < shots.length; ++i) { frames(4, 0.3); NS.frame.draw(); NS.cine.next(); NS.cine.next(); }
    NS.cine.end();
  } catch (e) { errs.push(e.message); console.log(e.stack); }
}
check('every cinematic shot draws', errs.length === 0, errs.join(' | '));

/* every guardian fight and mode draws, busy frames stay in budget */
let worst = 0;
errs = [];
const playOne = gm => gm.match ? NS.match.playPiece(gm) : NS.bot.playPiece(gm);
const MODE_RUNS = ['story', 'marathon', 'sprint', 'ultra', 'zen', 'daily', 'rush', 'master', 'blast', 'pairs', 'jewels', 'versus', 'versus:blast', 'versus:pairs', 'versus:jewels'];
for (const entry of MODE_RUNS) {
  const mode = entry.split(':')[0];
  const opts = mode === 'story' ? { stage: 'void-6' } : entry.indexOf(':') > 0 ? { rule: entry.split(':')[1] } : {};
  try {
    NS.play.start(mode, opts);
    NS.cine.end();
    for (let i = 0; i < 40; ++i) { if (G.run.game.piece && NS.run.engineOf(G.run.game).active(G.run.game)) playOne(G.run.game); frames(1, 1 / 20); }
    if (opts.rule && G.run.rule !== opts.rule) errs.push(entry + ': wrong rule');
    G.run.powers = ['bomb', 'laser'].slice(0, G.run.slots);
    for (let i = 0; i < 700; ++i) NS.fx.spawn(640, 360, 0, 0, 2, 5, '#fff', i % 12, 0);
    NS.fx.text(640, 300, 'TEST', '#fff', 20, 2);
    worst = Math.max(worst, calls());
  } catch (e) { errs.push(mode + ': ' + e.message); console.log(e.stack); }
}
check('every mode and Versus rule set starts and draws', errs.length === 0, errs.join(' | '));
check('a busy frame stays under 3,000 draw calls', worst < 3000, worst);
/* the Versus card: pick Jewels, then the Rookie */
NS.screens.setScreen('modes');
frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'vsr-jewels'));
frames(1);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'vs-rookie'));
check('the Versus card plays the chosen rule set', G.screen === 'game' && G.run.rule === 'jewels' && G.run.rival.match && G.profile.settings.vsRule === 'jewels');
NS.cine.end();
for (let i = 0; i < 60; ++i) { if (NS.match.active(G.run.game)) NS.match.playPiece(G.run.game); frames(1, 1 / 20); }
G.profile.settings.vsRule = 'blocks';

/* Versus from the modes screen: pick the Rookie, play until someone tops out */
NS.screens.setScreen('modes');
frames(2);
NS.widgets.activate(G.hitAreas.find(a => a.id === 'vs-rookie'));
check('the Versus card starts a match against the chosen CPU', G.screen === 'game' && G.run.vs && G.run.vs.cpu === 'rookie');
NS.cine.end();
NS.play.start('versus', { cpu: 'rookie', seed: 2024 });
NS.cine.end();
for (let i = 0; i < 6000 && G.screen === 'game'; ++i) {
  if (G.run.game.piece && !G.run.game.clearing && i % 3 === 0) NS.bot.playPiece(G.run.game, { deep: true });
  frames(1, 1 / 20);
}
check('a quick player beats the Rookie and the win is counted', G.screen === 'results' && G.result.cpu === 'rookie' && G.result.won && G.profile.stats.vsWins === 1 && G.profile.stats.vsBest === 1);
frames(5);
for (let w = 0; w < 5; ++w) { NS.play.start('story', { stage: W.WORLDS[w].id + '-6' }); NS.cine.end(); frames(2); }
check('every realm and guardian draws', G.run.bossState && G.run.bossState.w === 4);
check('no shadowBlur anywhere', ctx.shadowBlurUsed === 0);
const s0 = NS.artKit.stats ? NS.artKit.stats().created : 0;
frames(10);
check('warm frames paint no new sprites', !NS.artKit.stats || NS.artKit.stats().created === s0);
done();
