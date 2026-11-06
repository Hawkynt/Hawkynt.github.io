/* Sound through SZ.GameAudio: named effects with a per-name rate limit (fast clicking must not
   stack a hundred blips), a global volume scale for the Zen Kitchen and a soft ambient chime. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const last = {};
  let scale = 1;

  function sfx(name, opts) {
    if (!SZ.GameAudio) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const gap = opts && opts.gap != null ? opts.gap : 45;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    const o = { pitch: opts && opts.pitch || 1, volume: (opts && opts.volume != null ? opts.volume : 1) * scale };
    try {
      SZ.GameAudio.play(name, o);
    } catch (_) {}
  }

  function setScale(v) {
    scale = v;
  }

  /* a pentatonic chime for calm moments */
  const PENTA = [1, 1.125, 1.25, 1.5, 1.667, 2];
  function chime(i, volume) {
    sfx('blip', { pitch: 0.5 * PENTA[i % PENTA.length] * (i >= PENTA.length ? 2 : 1), volume: volume || 0.15, gap: 0 });
  }

  Object.assign(NS.audio, { sfx, setScale, chime });
})();
