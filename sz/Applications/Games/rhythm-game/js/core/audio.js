/* Sound through the shared SZ.GameAudio, kept small so it never fights the song: a soft tick per hit
   pitched by judgement, a dull thud for a miss, holds, Hush notes, star phrases, pickups, Surge,
   combo milestones, duel telegraphs, strikes and rage, a boss going down, the fail and the clear. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

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

  const PITCH = { perfect: 1.5, great: 1.25, good: 1 };
  function forEvent(e) {
    switch (e.type) {
      case 'hit': sfx('click', { pitch: PITCH[e.rank] || 1, volume: 0.25, gap: 20 }); break;
      case 'miss': sfx('thud', { pitch: 0.8, volume: 0.35, gap: 60 }); break;
      case 'hold-ok': sfx('pickup', { pitch: 1.2, volume: 0.3 }); break;
      case 'hold-break': sfx('drop', { pitch: 0.7, volume: 0.4 }); break;
      case 'hush': sfx('hurt', { volume: 0.5 }); break;
      case 'phrase': sfx('coin', { volume: 0.5 }); break;
      case 'phrase-broken': sfx('error', { volume: 0.2 }); break;
      case 'pickup': sfx('powerup', { pitch: 1.3, volume: 0.45 }); break;
      case 'surge-ready': sfx('select', { pitch: 1.5, volume: 0.5 }); break;
      case 'surge-on': sfx('powerup', { pitch: 0.8, volume: 0.7 }); sfx('whoosh', { volume: 0.6 }); break;
      case 'combo': sfx('levelup', { pitch: 1.2, volume: 0.35 }); break;
      case 'shielded': case 'net': sfx('zap', { pitch: 1.4, volume: 0.4 }); break;
      case 'telegraph': sfx('error', { pitch: 0.7, volume: 0.45 }); break;
      case 'attack': sfx('whoosh', { pitch: 0.6, volume: 0.7 }); break;
      case 'rage': sfx('explode', { pitch: 0.6, volume: 0.6 }); break;
      case 'boss-down': sfx('explode', { pitch: 0.8 }); sfx('win', { volume: 0.7 }); break;
      case 'rescue': sfx('levelup', { pitch: 0.8 }); break;
      case 'fail': sfx('lose'); break;
      case 'groove-low': sfx('error', { pitch: 1.2, volume: 0.3 }); break;
    }
  }

  Object.assign(NS.audio, { sfx, forEvent });
})();
