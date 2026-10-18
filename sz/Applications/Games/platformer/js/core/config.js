/*
 * The Platformer game namespace (SZ.Platformer) and its tuning constants.
 *
 * Every file under js/core, js/play, js/render and js/ui, and js/app.js, is one module: an IIFE
 * that fills NS.module('<name>') with the functions other modules call.
 * Shared, mutable game state lives in one object, NS.state (every module calls it G). Modules bind
 * the long-lived objects in G (canvas, ctx, particle pools, input sets) and a few small helpers
 * (sfx, view rects, formatTime, the drawing kit) once when they load, so those files come first in
 * index.html; every other call into another module goes through its module object at call time,
 * which leaves the remaining load order free.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Ph = SZ.PlatformerPhysics;
  const Levels = SZ.PlatformerLevels;

  NS.module = function(name) {
    return NS[name] || (NS[name] = {});
  };

  NS.config = Object.freeze({
    TS: Ph.TS,
    T: Ph.T,
    STEP: Ph.STEP,
    VIEW_W: 1280,
    VIEW_H: 720,
    ZOOM: 1.2,                // world pixels are drawn this much larger than view pixels
    MAX_DT: 0.05,
    MAX_STEPS: 8,
    FADE_RATE: 3.2,
    COYOTE_SAFE: 0.25,        // seconds on solid ground before it counts as a safe respawn spot
    RESPAWN_TIME: 0.7,
    KO_TIME: 1.6,
    STAR_TIME: 9,
    INTRO_TIME: 1.9,
    FIRE_SPEED: 600,
    STORAGE_SAVE: 'sz-platformer-v2',
    STORAGE_HIGHSCORES: 'sz-platformer-highscores',
    MAX_HIGH_SCORES: 5,
    GEM_COLORS: ['#ff4a6a', '#4aff8a', '#4ac8ff'],
    BOSS_SHOT_COLORS: ['#9aff6a', '#6ae0ff', '#ffffff', '#ff8a2a', '#c8a8ff'],
    WORLDS: Levels.WORLDS
  });
})();
