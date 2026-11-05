'use strict';

/* Boot and screens: the whole game loads in index order, the title runs its attract demo, every
   screen draws without errors, starting each mode works, pausing opens the tree with immediate
   effect, and no per-frame drawing uses shadowBlur. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;

check('the game boots onto the title', G.screen === 'title');
check('the title runs an attract demo', G.run && G.run.demo === true);
H.run(NS, 240, 4);
check('the demo plays by itself', G.run.lvl.dotsEaten > 0, G.run.lvl.dotsEaten);

const screens = ['title', 'map', 'tree', 'wardrobe', 'goals', 'season', 'help'];
let threw = '';
for (const s of screens) {
  try {
    NS.screens.setScreen(s);
    H.run(NS, 10, 1);
  } catch (e) { threw = s + ': ' + e.message; }
}
check('every menu screen draws', !threw, threw);
for (const tab of ['skin', 'trail', 'theme']) { G.ui.wardrobeTab = tab; NS.frame.draw(); }
for (const tab of ['quests', 'trophies', 'records']) { G.ui.goalsTab = tab; NS.frame.draw(); }
for (let p = 0; p < 5; ++p) { G.ui.helpPage = p; NS.screens.setScreen('help'); NS.frame.draw(); }
check('all tabs and help pages draw', true);

/* each mode starts and plays a little */
for (const mode of ['arcade', 'zen', 'daily', 'bossrush']) {
  let err = '';
  try {
    NS.screens.setScreen('title');
    NS.screens.launch(mode);
    if (G.screen === 'cine') NS.cinematics.end();
    H.run(NS, 200, 5);
  } catch (e) { err = e.stack; }
  check(mode + ' starts and runs', !err && G.run && G.run.mode === mode && G.screen === 'playing', err || G.screen);
}

/* story with its cinematics */
NS.screens.setScreen('title');
NS.screens.story();
check('the story opens with the intro cinematic', G.screen === 'cine' && G.cine.kind === 'intro');
for (let i = 0; i < 60 * 30 && G.screen === 'cine'; ++i) { NS.sim.update(1 / 60); if (i % 7 === 0) NS.frame.draw(); }
check('the intro plays through to the world map', G.screen === 'map');
NS.screens.launchStory(0, 0);
check('the first stage opens with the chapter card', G.screen === 'cine' && G.cine.kind === 'chapter');
NS.cinematics.skip();
H.run(NS, 30, 0);
NS.cinematics.skip();
check('skipping hands over to play', G.screen === 'playing', G.screen);

/* every cinematic scene draws */
const kinds = ['intro', 'chapter', 'boss', 'relight', 'ending', 'intermission'];
let cerr = '';
for (const k of kinds) {
  try {
    NS.cinematics.play(k, { world: 2, boss: 'frostmaw' }, () => NS.screens.setScreen('playing'));
    for (let i = 0; i < 60 * 40 && G.cine; ++i) { NS.sim.update(1 / 60); if (i % 5 === 0) NS.frame.draw(); }
  } catch (e) { cerr = k + ': ' + e.stack; }
}
check('every cinematic plays and ends', !cerr && !G.cine, cerr);

/* pause, tree with immediate effect */
NS.screens.setScreen('playing');
NS.screens.pause();
check('pausing opens the pause menu', G.screen === 'pause');
G.profile.shards = 1000;
const livesBefore = G.run.lives;
NS.screens.openTree('pause');
NS.tree.buy('s_life');
check('a tree purchase applies to the running game at once', G.run.lives === livesBefore + 1 && G.stats.lives === 4);
NS.screens.back('treeReturn');
check('the tree returns to the pause menu', G.screen === 'pause');
NS.screens.resume();
check('resume returns to play', G.screen === 'playing');

/* no shadowBlur in per-frame drawing */
const ctx = env.gameCanvas.ctx;
const before = ctx.shadowBlurUsed;
H.run(NS, 120, 1);
NS.screens.setScreen('title');
H.run(NS, 60, 1);
check('frames never use shadowBlur', ctx.shadowBlurUsed === before);

done();
