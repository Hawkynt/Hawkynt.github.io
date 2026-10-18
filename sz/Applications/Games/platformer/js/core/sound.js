/*
 * Sound effects through the shared synthesizer, throttled per effect name.
 * Owns nothing shared.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});

  const sfxLast = {};
  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || 0) < 40)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  Object.assign(NS.module('sound'), {
    sfx
  });
})();
