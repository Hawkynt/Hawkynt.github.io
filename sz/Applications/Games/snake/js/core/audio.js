/* Sound through SZ.GameAudio: named effects at most once per name every 40 ms, a rising pitch
   for fruit chains, and the soft ambience - slow pentatonic chimes at low volume on the board
   theme's root note, gentle in Zen, sparse elsewhere. Owns the throttle stamps and the chime
   clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  const last = {};
  const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
  let chimeT = 0, chimeStep = 0;

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function sfx(name, opts) {
    if (!SZ.GameAudio) return;
    const t = now();
    if (last[name] !== undefined && t - last[name] < 40) return;
    last[name] = t;
    SZ.GameAudio.play(name, opts);
  }

  /* fruit sounds climb a scale while the combo lasts */
  function fruit(combo) {
    const k = PENTA[combo % PENTA.length] * (1 + Math.floor(combo / PENTA.length) * 0.5);
    sfx('pickup', { pitch: Math.min(2.6, 0.8 * k), volume: 0.8 });
  }

  /* ambience: call every frame with the root note; zen plays fuller, other modes a sparse bell */
  function ambience(dt, root, zen) {
    if (!SZ.GameAudio || !SZ.GameAudio.tone) return;
    chimeT -= dt;
    if (chimeT > 0) return;
    chimeT = zen ? 1.4 : 4.2;
    ++chimeStep;
    const f = root * PENTA[(chimeStep * 3 + (chimeStep >> 2)) % PENTA.length];
    try {
      SZ.GameAudio.tone(f, zen ? 1.2 : 0.6, 'sine', zen ? 0.028 : 0.014);
      if (zen && chimeStep % 2 === 0) SZ.GameAudio.tone(f / 2, 1.8, 'triangle', 0.018, 0.1);
    } catch (_) {}
  }

  Object.assign(NS.audio, {
    sfx, fruit, ambience
  });
})();
