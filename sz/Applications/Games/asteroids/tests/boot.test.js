'use strict';

/* Boots every script in index.html order and drives each screen for a while: the title with its
   attract scene, the map, the story flow into a level, every mode, pause, the tech tree, hangar,
   goals, help and results - checking that nothing throws and every screen draws. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const scr = NS.screens;

function frames(n) {
  for (let i = 0; i < n; ++i) {
    NS.sim.update(1 / 60);
    NS.frame.draw();
  }
}

let threw = null;
try {
  frames(5);
  check('boots to the title or the season opening', G.screen === 'title' || G.screen === 'cine', G.screen);
  if (G.screen === 'cine') { G.cine.t = 9; NS.cinematics.skip(); }
  check('the season opening hands over to the title', G.screen === 'title', G.screen);
  frames(240);
  check('the attract scene flies a ship among rocks', G.ship && G.rocks.length > 0);
  NS.title.startMode('story');
  frames(10);
  check('story opens the world map', G.screen === 'map');
  NS.cinematics.enterLevel(0, 0);
  check('the first mission starts with the opening cinematic', G.screen === 'cine' && G.cine.kind === 'intro');
  frames(45);
  NS.cinematics.skip();
  check('then the prologue dialogue', G.screen === 'story');
  for (let i = 0; i < 40 && G.screen === 'story'; ++i) { NS.story.advance(); frames(2); }
  check('then the chapter arrival', G.screen === 'cine' && G.cine.kind === 'chapter', G.screen);
  frames(45);
  NS.cinematics.skip();
  for (let i = 0; i < 40 && G.screen === 'story'; ++i) { NS.story.advance(); frames(2); }
  check('and finally the mission', G.screen === 'playing' && G.run.mode === 'story', G.screen);
  frames(600);
  check('flying for ten seconds works', G.screen === 'playing' || G.screen === 'results', G.screen);
  scr.pause();
  frames(5);
  check('pause menu', G.screen === 'paused');
  scr.open('tree', 'paused');
  frames(5);
  scr.back('tree');
  scr.open('wardrobe', 'paused');
  frames(5);
  scr.back('wardrobe');
  scr.open('goals', 'paused');
  for (const t of NS.goals.TABS) { G.ui.goalsTab = t[0]; frames(2); }
  scr.back('goals');
  scr.open('help', 'paused');
  for (let p = 0; p < 5; ++p) { G.ui.helpPage = p; frames(2); }
  scr.back('help');
  check('pause sub-screens return to pause', G.screen === 'paused');
  scr.quitToTitle();
  frames(5);
  check('quitting keeps the run for Continue', NS.snapshot.has());
  for (const m of ['arcade', 'zen', 'daily', 'rush']) {
    NS.title.startMode(m);
    frames(300);
    check(m + ' runs', G.screen === 'playing' || G.screen === 'results', G.screen);
    scr.quitToTitle();
  }
  for (const kind of ['boss', 'ending', 'season']) {
    NS.cinematics.play(kind, { boss: 'maw', chapter: 4, season: 'winter' }, () => scr.setScreen('title'));
    for (let i = 0; i < 10; ++i) { G.cine.t += 3; frames(2); if (!G.cine) break; }
    check('cinematic ' + kind + ' plays to its end', G.screen === 'title');
  }
  G.ui.mapChapter = 4;
  scr.setScreen('map');
  frames(4);

  /* finishing a chapter's titan for the first time: debriefing, then the next chapter's arrival */
  NS.waves.startRun('story', { chapter: 0, level: 5 });
  scr.setScreen('playing');
  G.boss = null;
  NS.waves.finish();
  G.run.clearT = 0;
  frames(3);
  check('the titan mission ends on the results', G.screen === 'results' && G.ui.results.win && G.ui.results.chapterEnd);
  const cont = G.hitAreas.find(h => h.id === 'r0');
  NS.widgets.activate(cont);
  check('Continue opens the debriefing', G.screen === 'story' && G.story.lines === NS.campaign.CHAPTERS[0].outro);
  for (let i = 0; i < 40 && G.screen === 'story'; ++i) { NS.story.advance(); frames(2); }
  check('then the next chapter arrives', G.screen === 'cine' && G.cine.kind === 'chapter' && G.cine.data.chapter === 1, G.screen);
  frames(45);
  NS.cinematics.skip();
  for (let i = 0; i < 40 && G.screen === 'story'; ++i) { NS.story.advance(); frames(2); }
  check('and its first mission starts', G.screen === 'playing' && G.run.chapter === 1 && G.run.level === 0, G.screen);
  check('the chapter cosmetics and achievement were earned', NS.rules.chaptersDone(G.save) >= 1 || G.save.stars['1-6'] > 0);
} catch (e) {
  threw = e;
}
check('nothing threw', !threw, threw && threw.stack);
done();
