/* Sound effects through SZ.GameAudio, at most one per name every 45 ms; quieter in Zen mode,
   where kills also play notes of a pentatonic scale so a chain of shattered rocks becomes a
   melody. Owns the per-name timestamps and the Zen note cursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;

  const last = {};
  /* a major pentatonic over two octaves, as pitch factors */
  const SCALE = [1, 1.125, 1.26, 1.5, 1.68, 2, 2.25, 2.52, 3];
  let note = 0;
  let walk = 1;

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function zen() {
    return G.run && G.run.mode === 'zen';
  }

  function sfx(name, opts) {
    if (!SZ.GameAudio) return;
    const t = now();
    if (last[name] !== undefined && t - last[name] < 45) return;
    last[name] = t;
    let o = opts;
    if (zen() && G.screen === 'playing') {
      o = { pitch: opts && opts.pitch, volume: (opts && opts.volume != null ? opts.volume : 1) * 0.35 };
    }
    SZ.GameAudio.play(name, o);
  }

  /* a soft melodic tone for Zen kills: a random walk along the scale */
  function zenNote(size) {
    if (!SZ.GameAudio) return;
    note += walk;
    if (note >= SCALE.length - 1 || note <= 0 || Math.random() < 0.25) walk = -walk;
    note = Math.max(0, Math.min(SCALE.length - 1, note));
    const base = size >= 3 ? 0.5 : size === 2 ? 0.75 : 1;
    SZ.GameAudio.play('blip', { pitch: SCALE[note] * base, volume: 0.22 });
  }

  Object.assign(NS.audio, {
    sfx, zenNote
  });
})();
