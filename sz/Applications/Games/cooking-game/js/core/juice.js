;(function() {
  'use strict';

  /* The particle system, the screen shake and the rate-limited sound gate
     every module plays effects through. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});

  const fx = SZ.KitchenFX.create();
  const screenShake = new SZ.GameEffects.ScreenShake();

  /* ── sound gate ──
     Every effect goes through sfx: the same name never fires more than
     once per 40 ms, so chopping, coin showers and station calls stay a
     rhythm instead of a wall of noise. The shared mute switch in
     SZ.GameAudio keeps working behind it. */
  const SFX_GAP_MS = 40;
  const sfxLast = new Map();

  function sfx(name, opts) {
    const now = performance.now();
    const last = sfxLast.get(name);
    if (last !== undefined && now - last < SFX_GAP_MS)
      return;
    sfxLast.set(name, now);
    SZ.GameAudio.play(name, opts);
  }

  NS.juice = { fx, screenShake, sfx };

})();
