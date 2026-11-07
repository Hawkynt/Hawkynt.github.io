/* Sound through SZ.GameAudio: named effects at most once per name every 40 ms, coins that climb
   a pentatonic scale while a chain lasts, and the ambience - slow chimes at low volume on the
   world's root note, fuller and calmer in Zen, sparse elsewhere. Owns the throttle stamps and
   the chime clock. Also the whoosh and sweep of a turn of the view. */
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

  /* a turn of the view: a whoosh and a sweep that climbs for up, falls for down */
  function turn(dir) {
    sfx('whoosh', { pitch: dir === 'up' ? 1.3 : dir === 'down' ? 0.55 : 0.8, volume: 1 });
    if (!SZ.GameAudio || !SZ.GameAudio.tone) return;
    const f = [392, 523, 659, 784];
    try {
      for (let i = 0; i < 4; ++i) {
        const k = dir === 'down' ? f[3 - i] : dir === 'up' ? f[i] : f[i % 2 ? 2 : 1];
        SZ.GameAudio.tone(k, 0.12, 'triangle', 0.05, 0.08 + i * 0.07);
      }
    } catch (_) {}
  }

  Object.assign(NS.audio, {
    sfx, coin, ambience, turn
  });
})();
