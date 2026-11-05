/* Screen switching: entering a screen resets the cursor; the tech tree, wardrobe, goals, stats
   and help remember where they were opened from (title, map or the pause menu); pausing and
   resuming (with an autosave), the confirmation modal, and the toast queue.
   Owns G.screen, G.back and G.ui.modal. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;

  const MENUS = { title: 1, map: 1, tree: 1, wardrobe: 1, goals: 1, stats: 1, help: 1, results: 1 };

  function isMenu(s) {
    return !!MENUS[s || G.screen];
  }

  /* A run is on screen behind this one (playing, paused, or a screen opened from pause) */
  function inRun() {
    const s = G.screen;
    if (!G.run || !G.run.level) return false;
    if (s === 'playing' || s === 'paused') return true;
    if (s === 'results') return true;
    return (s === 'tree' || s === 'help' || s === 'wardrobe' || s === 'goals' || s === 'stats') && G.back[s] === 'paused';
  }

  function setScreen(name) {
    const from = G.screen;
    if (from === 'playing' && name !== 'playing' && G.run && !G.run.over) NS.save.saveRun();
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.ui.modal = null;
    G.input.path = null;
    if (name === 'title') {
      NS.backdrop.setScene('village');
      NS.save.probeContinue();
    }
    if (name !== 'playing') NS.save.writeSave();
    NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing') return;
    setScreen('paused');
    NS.fx.sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused' || !G.run) return;
    setScreen('playing');
    NS.fx.sfx('blip');
  }

  function open(screen, from) {
    G.back[screen] = from || G.screen;
    setScreen(screen);
  }

  function back(screen) {
    const to = G.back[screen] || 'title';
    setScreen(to);
  }

  /* A yes/no question drawn over the current screen */
  function confirm(title, text, yes) {
    G.ui.modal = { title: title, text: text, yes: yes };
    G.menuCursor = 0;
  }

  function toast(text, color, icon) {
    const list = G.ui.toasts;
    if (list.length > 3) list.shift();
    list.push({ text: text, color: color || '#ffd84a', icon: icon || 'star', t: 0, dur: 3.2 });
  }

  function tickToasts(dt) {
    const list = G.ui.toasts;
    for (let i = list.length - 1; i >= 0; --i) {
      list[i].t += dt;
      if (list[i].t > list[i].dur) list.splice(i, 1);
    }
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, open, back, confirm, toast, tickToasts
  });
})();
