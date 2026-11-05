/* The one explicit state object G: clocks, the active screen and menu cursor, input, UI
   transients, the player profile and derived stats, the current run (plain data, saved as is),
   the running cinematic, hit-stop and slow motion, and today's date with its season. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;

  Object.assign(G, {
    time: 0,
    screen: 'title',
    screenT: 0,
    menuCursor: 0,
    hitAreas: [],
    input: {
      keys: {}, mouseX: 640, mouseY: 360, mouseMoved: 0, touch: false, want: -1, wantT: 0,
    },
    ui: {
      toast: null, popups: [], banners: [], treeSel: 'a_speed', treeFlash: 0, treeFlashId: '',
      wardrobeTab: 'skin', wardrobeSel: 0, goalsTab: 'quests', helpPage: 0, mapSel: 0, results: null,
      flash: 0, flashColor: '#ffffff', titleSel: 0,
    },
    profile: null,
    stats: null,
    run: null,
    cine: null,
    hitStop: 0,
    slowMo: 0,
    slowScale: 1,
    treeReturn: 'title',
    helpReturn: 'title',
    wardrobeReturn: 'title',
    date: new Date(),
    season: null,
    savedRun: null,
  });
})();
