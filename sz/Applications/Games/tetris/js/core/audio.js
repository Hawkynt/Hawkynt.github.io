/* Sound through the shared SZ.GameAudio: named effects with a per-name rate limit and pitch
   variations for moves, rotations, locks, clears (rising with the combo), T-spins, quads,
   level-ups, guardian hits and power-ups. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

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

  /* the sound of one engine event */
  function forEvent(e) {
    switch (e.type) {
      case 'move': sfx('click', { volume: 0.35, gap: 20 }); break;
      case 'rotate': sfx('blip', { pitch: e.kick ? 1.15 : 1.3, volume: 0.35, gap: 20 }); break;
      case 'hold': sfx('select', { pitch: 0.9, volume: 0.5 }); break;
      case 'harddrop': sfx('thud', { volume: 0.5 + Math.min(0.4, e.rows * 0.03) }); break;
      case 'lock': if (e.tspin) sfx('zap', { volume: 0.6 }); else sfx('drop', { volume: 0.35, gap: 40 }); break;
      case 'clear':
        if (!e.lines) break;
        if (e.perfect) sfx('win');
        else if (e.lines === 4 || e.tspin === 'full') sfx('powerup', { pitch: e.b2b ? 1.2 : 1 });
        else sfx('lineClear', { pitch: 1 + Math.min(1, e.combo * 0.08) });
        break;
      case 'levelup': sfx('levelup'); break;
      case 'garbage': sfx('hit', { pitch: 0.7 }); break;
      case 'crystals': sfx('shoot', { pitch: 1.5, volume: 0.6 }); break;
      case 'mirror': sfx('whoosh', { pitch: 0.8 }); break;
      case 'topout': sfx('lose'); break;
      case 'cascade': sfx('explode', { pitch: 0.6, volume: 0.6 }); break;
      case 'laser': sfx('laser'); break;
      case 'bomb': sfx('explode'); break;
      case 'zen': sfx('whoosh', { volume: 0.5 }); break;
    }
  }

  Object.assign(NS.audio, { sfx, forEvent });
})();
