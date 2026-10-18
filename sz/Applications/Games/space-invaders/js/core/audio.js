/* Sound effects through SZ.GameAudio, at most one per name every 40 ms.
   Owns the per-name timestamps; reads nothing else. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});

  const sfx = SZ.GameAudio;

  /* One sound per name per 40 ms: bursts of hits stay a rhythm, never a buzz */
  const sfxLast = {};
  function playSfx(name, opts) {
    const now = performance.now();
    const last = sfxLast[name];
    if (last !== undefined && now - last < 40)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  Object.assign(NS.audio, {
    playSfx, sfx
  });
})();
