/* Starting a mode from the menus: the descriptions shown on the title, and a guard that asks
   before a new run replaces a suspended one (whose gems are paid out either way). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;

  const INFO = {
    story: { name: 'Story', icon: 'map', color: '#ffb347', sub: 'Five worlds, five bosses' },
    arcade: { name: 'Arcade', icon: 'arcade', color: '#ff5d5d', sub: 'Endless arenas, combos, high scores' },
    zen: { name: 'Zen', icon: 'zen', color: '#7cf08a', sub: 'No harm, calm gardens, gems' },
    daily: { name: 'Daily Challenge', icon: 'daily', color: '#6fd3ff', sub: 'Three arenas, one life, today only' },
    rush: { name: 'Boss Rush', icon: 'rush', color: '#c58bff', sub: 'All five bosses back to back' }
  };

  /* fn runs now, or after a yes when it would replace a suspended run */
  function guard(fn) {
    if (G.hasContinue) {
      const info = G.continueInfo;
      NS.screens.confirm('Start a new run?', 'Your saved ' + (info ? INFO[info.mode].name : '') + ' run (' + (info ? info.name : '') + ') will end. Gems it collected are kept.', fn);
      return;
    }
    fn();
  }

  function start(mode, opts) {
    guard(() => NS.run.newRun(mode, opts));
  }

  function dailyText() {
    if (!G.daily) return '';
    return G.daily.mods.map(m => NS.content.MODIFIER_BY_ID[m].name).join(' + ');
  }

  Object.assign(NS.modes, {
    INFO, guard, start, dailyText
  });
})();
