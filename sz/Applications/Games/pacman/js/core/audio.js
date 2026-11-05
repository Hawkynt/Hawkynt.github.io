/* Sound effects through SZ.GameAudio at most one per name every 45 ms, the alternating waka of
   eating dots, and Zen's ambience: soft pentatonic chimes at a low volume, scheduled from the
   simulation clock. Owns the per-name timestamps and the chime clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  const last = {};
  let waka = 0;
  let chimeT = 0, chimeStep = 0;
  const PENTA = [1, 1.125, 1.25, 1.5, 1.6875, 2, 2.25, 2.5];

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function sfx(name, opts) {
    if (!SZ.GameAudio) return;
    const t = now();
    if (last[name] !== undefined && t - last[name] < 45) return;
    last[name] = t;
    SZ.GameAudio.play(name, opts);
  }

  /* the two-tone chomp, quieter in Zen */
  function chomp(zen) {
    waka ^= 1;
    sfx('blip', { pitch: waka ? 0.42 : 0.36, volume: zen ? 0.25 : 0.45 });
  }

  /* gentle chimes for Zen, a phrase every few seconds */
  function ambience(dt, seed) {
    chimeT -= dt;
    if (chimeT > 0) return;
    ++chimeStep;
    const k = (seed + chimeStep * 3) % PENTA.length;
    const phrase = chimeStep % 4 === 0;
    chimeT = phrase ? 3.2 : 1.1;
    if (SZ.GameAudio && SZ.GameAudio.tone) {
      SZ.GameAudio.tone(392 * PENTA[k], 1.2, 'sine', 0.025, 0);
      if (phrase) SZ.GameAudio.tone(196 * PENTA[(k + 2) % PENTA.length], 2.4, 'triangle', 0.018, 0.2);
    }
  }

  Object.assign(NS.audio, {
    sfx, chomp, ambience
  });
})();
