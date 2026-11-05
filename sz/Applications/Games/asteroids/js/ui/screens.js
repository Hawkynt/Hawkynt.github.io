/* Screen switching: entering a screen resets the cursor; the tech tree, hangar, goals and help
   remember where they were opened from (title, map, results or the pause menu); pausing (which
   autosaves), resuming, continuing the autosaved run, leaving a run for the title (kept for
   Continue) and the toast queue. Owns G.screen and G.returns. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  const MENU = { title: 1, map: 1, tree: 1, wardrobe: 1, goals: 1, help: 1, results: 1 };

  function isMenu(s) {
    return !!MENU[s || G.screen];
  }

  /* a run is open: flying, paused, or a screen opened from the pause menu */
  function inRun() {
    if (G.screen === 'playing' || G.screen === 'paused') return true;
    const r = G.returns;
    return (G.screen === 'tree' && r.tree === 'paused') || (G.screen === 'wardrobe' && r.wardrobe === 'paused') ||
      (G.screen === 'goals' && r.goals === 'paused') || (G.screen === 'help' && r.help === 'paused');
  }

  function setScreen(name) {
    /* a short dip to black between screens (not for pausing or resuming) */
    const quiet = (G.screen === 'playing' && name === 'paused') || (G.screen === 'paused' && name === 'playing');
    if (!quiet && name !== G.screen) G.fade = 0.22;
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.input.fire = false;
    G.input.mouseDown = false;
    if (name === 'title') NS.backdrop.setChapter(-1);
    if (name === 'map') NS.backdrop.setChapter(G.ui.mapChapter);
    if (name === 'playing' && G.run && G.run.mode === 'story') NS.backdrop.setChapter(G.run.chapter);
    if (name === 'playing' && G.run && G.run.mode !== 'story') NS.backdrop.setChapter(G.run.mode === 'rush' ? G.run.rushIdx : G.run.mode === 'zen' ? -1 : (Math.floor((G.run.wave - 1) / 4)) % 5);
    if (name !== 'playing') NS.save.writeSave();
    if (NS.statusBar.update) NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing') return;
    setScreen('paused');
    NS.snapshot.autosave(true);
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused') return;
    setScreen('playing');
    sfx('blip');
  }

  function open(which, from) {
    G.returns[which] = from || (G.screen === 'paused' ? 'paused' : G.screen);
    setScreen(which);
  }

  function back(which) {
    setScreen(G.returns[which] || 'title');
  }

  /* leave the run but keep it for Continue (Zen and finished runs are simply closed) */
  function quitToTitle() {
    if (G.run && !G.run.results) NS.snapshot.autosave(true);
    G.run = null;
    G.ship = null;
    setScreen('title');
  }

  /* abandon the run for good */
  function abandon() {
    NS.snapshot.clear();
    G.run = null;
    G.ship = null;
    setScreen('title');
  }

  function continueRun() {
    if (!NS.snapshot.restore()) {
      toast('The saved flight could not be restored', '#ff5a6a');
      return false;
    }
    setScreen('playing');
    setScreen('paused');
    toast('Welcome back, pilot - resume when ready', '#5ad8ff');
    return true;
  }

  function toast(text, color) {
    const ts = G.ui.toasts;
    if (ts.length && ts[ts.length - 1].text === text) return;
    ts.push({ text: text, color: color || '#ffd25a', t: 0, life: 3.6 });
    if (ts.length > 4) ts.shift();
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, open, back, quitToTitle, abandon, continueRun, toast
  });
})();
