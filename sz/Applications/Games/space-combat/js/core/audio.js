/* Sound effects through SZ.GameAudio, at most one per name every 45 ms, with optional distance
   attenuation from the camera. Owns the per-name timestamps. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;

  const last = {};

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

  /* A world-positioned sound: quieter the further it is from the view centre, silent off-screen */
  function sfxAt(name, x, y, opts) {
    const dx = x - G.cam.x, dy = y - G.cam.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1300) return;
    const v = (opts && opts.volume != null ? opts.volume : 1) * Math.max(0.15, 1 - d / 1300);
    sfx(name, { pitch: opts && opts.pitch, volume: v });
  }

  Object.assign(NS.audio, {
    sfx, sfxAt
  });
})();
