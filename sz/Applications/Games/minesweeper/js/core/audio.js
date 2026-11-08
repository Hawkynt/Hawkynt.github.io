/* Sound through the shared SZ.GameAudio: opening (a soft click, a rising sweep for a big clearing),
   flags and question marks, chords, the blast and the chain of mines after it, shields, gems,
   chests and powers, cleared fields, guardian wind-ups and strikes, rage, the fuse, the rival's win
   and the stun of a mine in a race. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
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
      case 'open':
        if (e.cells.length >= 20) sfx('whoosh', { pitch: 1 + Math.min(0.6, e.cells.length / 200), volume: 0.6 });
        else sfx('click', { pitch: 1.1 + Math.min(0.5, e.cells.length * 0.04), volume: 0.45, gap: 15 });
        break;
      case 'flag': sfx(e.f === 1 ? 'select' : 'click', { pitch: e.f === 1 ? 1.4 : e.f === 2 ? 1.8 : 0.9, volume: 0.5 }); break;
      case 'chord': sfx('pickup', { pitch: 1.3, volume: 0.45 }); break;
      case 'boom': sfx('explode'); break;
      case 'lose': sfx('smallExplode', { pitch: 0.7, volume: 0.6 }); break;
      case 'shield': sfx('zap', { pitch: 1.2 }); break;
      case 'gem': sfx('coin', { pitch: PENTA[4], volume: 0.7 }); break;
      case 'chest': sfx('powerup', { pitch: 0.9, volume: 0.6 }); break;
      case 'usepower': sfx('powerup', { pitch: 1.3 }); break;
      case 'win': sfx('win'); break;
      case 'windup': sfx('error', { pitch: 0.7, volume: 0.6 }); break;
      case 'strike': sfx(e.kind === 'frost' ? 'zap' : e.kind === 'smoke' ? 'whoosh' : 'thud', { pitch: 0.7, volume: 0.8 }); break;
      case 'rage': sfx('explode', { pitch: 0.5 }); break;
      case 'fuse': sfx('explode', { pitch: 0.35 }); break;
      case 'penalty': sfx('hurt'); break;
      case 'stun': sfx(e.who === 'you' ? 'explode' : 'smallExplode', { pitch: e.who === 'you' ? 0.9 : 1.3, volume: e.who === 'you' ? 1 : 0.4 }); break;
      case 'nextboss': sfx('levelup', { pitch: 0.7 }); break;
    }
  }

  Object.assign(NS.audio, { sfx, forEvent });
})();
