/* Sound through the shared SZ.GameAudio: named effects with a per-name rate limit, the brick
   chime rising with the combo, bounces, power-ups good and bad, lasers, bombs, guardian hits and
   shots, lost balls and cleared walls. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const PENTA = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5, 3, 3.33];

  const last = {};
  function sfx(name, opts) {
    const A = SZ.GameAudio;
    if (!A) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const gap = opts && opts.gap != null ? opts.gap : 30;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    try {
      A.play(name, { pitch: (opts && opts.pitch) || 1, volume: opts && opts.volume != null ? opts.volume : 1 });
    } catch (_) {}
  }

  function forEvent(e) {
    switch (e.type) {
      case 'paddle': sfx('bounce', { pitch: 0.9 + Math.abs(e.off) * 0.3, volume: 0.6 }); break;
      case 'wall': sfx('click', { volume: 0.25, gap: 40 }); break;
      case 'clink': sfx('hit', { pitch: 1.6, volume: 0.35, gap: 40 }); break;
      case 'hit': sfx('hit', { pitch: 1.2, volume: 0.45, gap: 25 }); break;
      case 'break': sfx('blip', { pitch: 0.7 * PENTA[Math.min(PENTA.length - 1, e.combo % 20 >> 1)], volume: 0.4, gap: 15 }); break;
      case 'bomb': sfx('explode', { volume: 0.6, gap: 60 }); break;
      case 'power': sfx(NS.constants.POWER_BY_ID[e.id].good ? 'powerup' : 'error', { volume: 0.7 }); break;
      case 'laser': sfx('laser', { volume: 0.4, gap: 50 }); break;
      case 'lost': sfx('hurt', { volume: 0.6 }); break;
      case 'life': sfx('lose', { pitch: 1.4, volume: 0.6 }); break;
      case 'over': sfx('lose'); break;
      case 'barrier': sfx('zap', { volume: 0.6 }); break;
      case 'catch': sfx('select', { pitch: 0.8, volume: 0.5 }); break;
      case 'launch': sfx('jump', { pitch: 1.4, volume: 0.4 }); break;
      case 'bosshit': sfx('thud', { volume: 0.7 }); break;
      case 'bossshoot': sfx('shoot', { pitch: 0.7, volume: 0.45 }); break;
      case 'stung': sfx('hurt', { pitch: 0.7 }); break;
      case 'rage': sfx('explode', { pitch: 0.5 }); break;
      case 'bossdown': sfx('explode', { pitch: 0.4 }); break;
      case 'cleared': sfx('win'); break;
      case 'regen': sfx('pickup', { pitch: 0.6, volume: 0.25, gap: 80 }); break;
    }
  }

  Object.assign(NS.audio, { sfx, forEvent });
})();
