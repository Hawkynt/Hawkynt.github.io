/* Screen switching: entering a screen resets the cursor and timers; the tech tree, hangar and
   help remember where they were opened from (title, map, briefing or the pause menu), pausing
   and resuming, quitting to the title, and toasts. Owns G.screen and the return targets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  const MENU_SCREENS = { title: 1, map: 1, briefing: 1, hangar: 1, tree: 1, help: 1, results: 1 };

  function isMenu(s) {
    return !!MENU_SCREENS[s || G.screen];
  }

  /* a run is in progress (playing, paused, or a screen opened from the pause menu) */
  function inRun() {
    return G.screen === 'playing' || G.screen === 'paused' ||
      ((G.screen === 'tree' && G.treeReturn === 'paused') || (G.screen === 'help' && G.helpReturn === 'paused'));
  }

  function setScreen(name) {
    if (name === 'title' || name === 'map') {
      G.stage = null;
      G.boss = null;
      if (name === 'title') NS.backdrop.setSector(0);
    }
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.input.firing = false;
    G.input.mouseDown = false;
    if (name !== 'playing') NS.save.writeSave();
    NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing') return;
    setScreen('paused');
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused') return;
    setScreen('playing');
    sfx('blip');
  }

  function openTree(from) {
    G.treeReturn = from || (G.screen === 'paused' ? 'paused' : G.screen);
    setScreen('tree');
  }

  function openHelp(from) {
    G.helpReturn = from || G.screen;
    G.ui.helpPage = 0;
    setScreen('help');
  }

  function openHangar(from) {
    G.hangarReturn = from || G.screen;
    setScreen('hangar');
  }

  function back(target) {
    setScreen(target);
  }

  function toTitle() {
    setScreen('title');
  }

  function toast(text, color) {
    G.ui.toast = { text: text, color: color || '#ffd25a', t: 0 };
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, openTree, openHelp, openHangar, back, toTitle, toast
  });
})();
