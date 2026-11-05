/* Screen switching: entering a screen resets the cursor and its timer; the tech tree, collection,
   journal and help remember where they were opened from (title, map, results or the pause menu);
   pausing (which autosaves the run) and resuming; leaving a run for the title keeps its autosave.
   Owns G.screen and the return targets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  const MENU = { title: 1, map: 1, results: 1, tree: 1, wardrobe: 1, journal: 1, help: 1 };

  function isMenu(s) {
    return !!MENU[s || G.screen];
  }

  /* a real run is open: playing, paused, or a screen opened from the pause menu */
  function inRun() {
    if (!G.run || G.run.mode === 'demo') return false;
    if (G.screen === 'playing' || G.screen === 'paused') return true;
    const sub = { tree: 1, wardrobe: 1, journal: 1, help: 1 };
    return !!sub[G.screen] && G.back[G.screen] === 'paused';
  }

  function setScreen(name) {
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.ui.pauseConfirm = false;
    if (name === 'results') NS.results.reset();
    if (name !== 'playing' && G.save) NS.save.writeSave();
    NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing' || !G.run || G.run.mode === 'demo') return;
    if (G.run.phase === 'over') return;
    NS.save.writeRun();
    setScreen('paused');
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused') return;
    setScreen('playing');
    if (G.run && G.run.phase === 'play') { G.run.phase = 'ready'; G.run.phaseT = 1.2; }
    sfx('blip');
  }

  function open(name, from) {
    G.back[name] = from || G.screen;
    if (name === 'help') G.ui.helpPage = 0;
    setScreen(name);
  }

  function back(name) {
    setScreen(G.back[name] || 'title');
  }

  /* to the title; an open run keeps its autosave so Continue brings it back */
  function toTitle() {
    if (inRun() && G.run.phase !== 'over') NS.save.writeRun();
    if (G.run && G.run.mode !== 'demo') G.run = null;
    G.cine = null;
    setScreen('title');
  }

  function toast(text, color) {
    NS.progress.toast(text, color);
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, open, back, toTitle, toast
  });
})();
