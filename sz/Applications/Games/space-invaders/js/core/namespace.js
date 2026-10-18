/* The game namespace SZ.SpaceInvaders with one empty object per module, created up front so
   modules can keep references to modules that load after them. Owns nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});

  const MODULES = ['constants', 'data', 'save', 'statusBar', 'audio', 'progress', 'view', 'backdrop', 'fx',
    'special', 'powerups', 'boss', 'combat', 'fleet', 'waves', 'stages', 'player', 'collisions', 'sim',
    'widgets', 'screens', 'world', 'overlays', 'hud', 'title', 'campaignMap', 'hangar', 'armory', 'help',
    'frame', 'input', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
