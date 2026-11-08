/* Sound through the shared SZ.GameAudio: blows, jumps, bounces, traps, pops climbing a scale
   with the chain, fruit, candy, the elemental bubbles, hurry-up, deaths, guardians and cleared
   rooms. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const PENTA = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5];

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
      case 'blow': sfx('bounce', { pitch: 1.6, volume: 0.4 }); break;
      case 'jump': sfx('jump', { volume: 0.35 }); break;
      case 'bounce': sfx('bounce', { pitch: 1.2, volume: 0.5 }); break;
      case 'trap': sfx('select', { pitch: 1.3, volume: 0.6 }); break;
      case 'dent': sfx('hit', { pitch: 1.3, volume: 0.5 }); break;
      case 'pop': sfx('pickup', { pitch: PENTA[Math.min(PENTA.length - 1, e.n - 1)], volume: 0.7, gap: 10 }); break;
      case 'popempty': sfx('click', { pitch: 1.4, volume: 0.3 }); break;
      case 'fizz': sfx('click', { pitch: 0.8, volume: 0.15, gap: 60 }); break;
      case 'chain': sfx('powerup', { pitch: 1 + e.n * 0.05 }); break;
      case 'fruit': sfx('coin', { volume: 0.5, gap: 20 }); break;
      case 'power': sfx('powerup', { volume: 0.7 }); break;
      case 'escape': sfx('error', { volume: 0.5 }); break;
      case 'popelem': sfx(e.elem === 'bolt' ? 'zap' : e.elem === 'water' ? 'whoosh' : e.elem === 'fire' ? 'explode' : 'levelup', { volume: 0.7 }); break;
      case 'zap': sfx('smallExplode', { volume: 0.5, gap: 30 }); break;
      case 'hurry': sfx('error', { pitch: 1.5 }); break;
      case 'shade': sfx('lose', { pitch: 0.6 }); break;
      case 'die': sfx('hurt'); break;
      case 'shieldpop': sfx('zap'); break;
      case 'over': sfx('lose'); break;
      case 'extralife': sfx('win'); break;
      case 'enemyshot': sfx('shoot', { pitch: 1.2, volume: 0.4 }); break;
      case 'bosshit': sfx('thud', { volume: 0.7 }); break;
      case 'bossshoot': sfx('shoot', { pitch: 0.7, volume: 0.45 }); break;
      case 'rage': sfx('explode', { pitch: 0.5 }); break;
      case 'bossdown': sfx('explode', { pitch: 0.4 }); break;
      case 'cleared': sfx('win'); break;
    }
  }

  Object.assign(NS.audio, { sfx, forEvent });
})();
