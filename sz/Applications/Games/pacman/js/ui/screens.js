/* Screen switching and the flows between them: entering a screen resets the cursor and saves;
   pausing and resuming; the tech tree, wardrobe, goals, season and help remember where they were
   opened from (title, map or the pause menu); starting each mode (story stages with their intro,
   chapter and boss cinematics, arcade, zen, daily, boss rush), Continue, leaving to the title
   with the run kept, toasts and achievement pop-ups. Owns G.screen and the return targets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { WORLDS } = NS.worlds;
  const { sfx } = NS.audio;

  const MENUS = { title: 1, map: 1, tree: 1, wardrobe: 1, goals: 1, season: 1, help: 1, results: 1, pause: 1 };

  function isMenu(s) {
    return !!MENUS[s || G.screen];
  }

  function setScreen(name) {
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    if (name === 'title' && (!G.run || !G.run.demo)) NS.run.demo();
    if (name !== 'playing' && name !== 'cine' && G.profile) NS.save.writeProfile();
    NS.statusBar.update();
  }

  /* a run is open behind this screen (playing, paused, or a screen opened from the pause menu) */
  function inRun() {
    return !!G.run && !G.run.demo;
  }

  function pause() {
    if (G.screen !== 'playing' || !inRun()) return;
    NS.save.saveRun();
    NS.save.writeProfile();
    setScreen('pause');
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (!inRun()) { setScreen('title'); return; }
    setScreen('playing');
    G.input.want = -1;
    sfx('blip');
  }

  function openFrom(screen, key, from) {
    G[key] = from || G.screen;
    setScreen(screen);
  }

  function openTree(from) { openFrom('tree', 'treeReturn', from); }
  function openWardrobe(from) { openFrom('wardrobe', 'wardrobeReturn', from); }
  function openGoals(from) { openFrom('goals', 'goalsReturn', from); }
  function openSeason(from) { openFrom('season', 'seasonReturn', from); }
  function openHelp(from) { G.ui.helpPage = 0; openFrom('help', 'helpReturn', from); }

  function back(key) {
    setScreen(G[key] || 'title');
  }

  /* ── starting runs ── */
  function begin(run) {
    NS.save.clearRun();
    NS.run.begin(run);
  }

  function story() {
    if (!G.profile.seen.intro) {
      NS.cinematics.play('intro', {}, () => setScreen('map'));
      return;
    }
    setScreen('map');
  }

  /* plays a world's chapter opening the first time, then continues */
  function chapter(world, then) {
    if (!G.profile.seen['chapter' + world]) NS.cinematics.play('chapter', { world: world }, then);
    else then();
  }

  function launchStory(world, stage) {
    const run = NS.run.create('story', { world: world, stage: stage });
    begin(run);
    const go = () => {
      if (stage === 4) NS.cinematics.play('boss', { world: world, boss: WORLDS[world].boss }, () => setScreen('playing'));
      else setScreen('playing');
    };
    if (stage === 0) chapter(world, go);
    else go();
  }

  function launch(mode) {
    let run;
    if (mode === 'daily') {
      const d = NS.seasons.daily(G.date);
      run = NS.run.create('daily', { seed: d.seed, mods: d.mods, world: d.world, dayKey: d.key });
    } else if (mode === 'bossrush') {
      run = NS.run.create('bossrush', {});
    } else if (mode === 'arcade') {
      const wk = G.ui.weeklyOn ? [NS.seasons.weekly(G.date).id] : [];
      run = NS.run.create('arcade', { mods: wk });
    } else {
      run = NS.run.create(mode, {});
    }
    begin(run);
    if (run.lvl.kind === 'boss') NS.cinematics.play('boss', { world: run.lvl.world, boss: run.lvl.bossId }, () => setScreen('playing'));
    else setScreen('playing');
  }

  function continueRun() {
    if (!NS.run.resume()) {
      toast('No saved run to continue', '#ff5a6a');
      G.savedRun = null;
      return;
    }
    setScreen('playing');
    G.ui.wipe = 1;
  }

  /* to the title, keeping the run saved for Continue */
  function toTitle() {
    NS.run.suspend();
    NS.fx.clear();
    setScreen('title');
  }

  function abandon() {
    if (inRun()) NS.run.finish(G.run, false);
  }

  /* ── messages ── */
  function toast(text, color) {
    const t = { text: text, color: color || '#ffd23a', t: 0 };
    const ui = G.ui;
    if (!ui.toast) ui.toast = t;
    else {
      ui.toastQueue = ui.toastQueue || [];
      if (ui.toastQueue.length < 6) ui.toastQueue.push(t);
    }
  }

  function achievements(list) {
    for (let i = 0; i < list.length; ++i) {
      G.ui.popups.unshift({ name: list[i].name, desc: list[i].desc, reward: list[i].reward, t: 0 });
      sfx('levelup', { volume: 0.6 });
    }
    if (G.ui.popups.length > 3) G.ui.popups.length = 3;
    NS.save.refreshStats();
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, openTree, openWardrobe, openGoals, openSeason, openHelp, back,
    story, chapter, launchStory, launch, continueRun, toTitle, abandon, toast, achievements
  });
})();
