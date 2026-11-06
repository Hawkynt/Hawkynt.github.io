/* Sound through SZ.GameAudio: named effects at most once per name every 40 ms, coins that climb
   a pentatonic scale while a chain lasts, and the ambience - slow chimes at low volume on the
   world's root note, fuller and calmer in Zen, sparse elsewhere. Owns the throttle stamps and
   the chime clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

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

  /* coin sounds climb a scale while the chain lasts */
  function coin(chain) {
    const k = PENTA[chain % PENTA.length] * (1 + Math.floor(chain / PENTA.length) * 0.25);
    sfx('coin', { pitch: Math.min(2.2, 0.85 * k), volume: 0.55 });
  }

  function ambience(dt, root, zen) {
    if (!SZ.GameAudio || !SZ.GameAudio.tone) return;
    chimeT -= dt;
    if (chimeT > 0) return;
    chimeT = zen ? 1.5 : 4.5;
    ++chimeStep;
    const f = root * PENTA[(chimeStep * 3 + (chimeStep >> 2)) % PENTA.length];
    try {
      SZ.GameAudio.tone(f, zen ? 1.3 : 0.6, 'sine', zen ? 0.03 : 0.012);
      if (zen && chimeStep % 2 === 0) SZ.GameAudio.tone(f / 2, 2, 'triangle', 0.018, 0.12);
    } catch (_) {}
  }

  Object.assign(NS.audio, {
    sfx, coin, ambience
  });
})();
