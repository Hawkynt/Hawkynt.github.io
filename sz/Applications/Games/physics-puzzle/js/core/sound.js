;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Sound: plays a synthesized effect through the shared game audio, at most
   * once per 45 ms per effect so a pile-up of contacts stays one sound.
   * Owns the per-effect throttle; reads nothing else.
   */

  const G = NS.G;
  const sfxLast = {};

  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || 0) < 45)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  G.sfx = sfx;

  NS.sound = { sfx: sfx };
})();
