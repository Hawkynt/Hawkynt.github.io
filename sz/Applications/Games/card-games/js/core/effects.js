/* Shared visual effects singletons and the generic sound layer derived from what
   the variants show (floating-text and shake sounds are intercepted here). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const S = NS.state;
  const E = NS.effects = NS.effects || {};

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS (shared by all inline-rendered variants)
     ══════════════════════════════════════════════════════════════════ */

  E.particles = new SZ.GameEffects.ParticleSystem();
  E.screenShake = new SZ.GameEffects.ScreenShake();
  E.floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     SOUND (generic: derived from what the variants show)
     ══════════════════════════════════════════════════════════════════ */

  E.sound = (name, opts) => SZ.GameAudio.play(name, opts);

  function outcomeSound(name) {
    const now = performance.now();
    if (now - S.lastOutcomeSound < 2000) return;
    S.lastOutcomeSound = now;
    E.sound(name);
  }

  function colorMood(color) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color || '');
    if (!m) return 0;
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (g > r + 40 && g >= b) return 1;
    if (r > g + 40 && r > b + 40) return -1;
    return 0;
  }

  // Big green/red banners are wins/losses, small refusals are invalid moves
  function soundForText(text, opts) {
    const t = String(text);
    const big = (opts?.size || 0) >= 22;
    const mood = colorMood(opts?.color);
    if (/cannot|can't|invalid|must |not allowed|illegal|would bust|no (more )?moves/i.test(t)) {
      E.sound('error', { volume: 0.6 });
      return;
    }
    if (big && mood !== 0 || /\byou (win|won)\b|\bwins?!?$|game over/i.test(t)) {
      const good = mood > 0 || (mood === 0 && /\byou (win|won)\b/i.test(t));
      outcomeSound(good ? 'win' : 'lose');
    }
  }

  const addFloatingText = E.floatingText.add.bind(E.floatingText);
  E.floatingText.add = function(x, y, text, opts) {
    soundForText(text, opts);
    return addFloatingText(x, y, text, opts);
  };

  const triggerShake = E.screenShake.trigger.bind(E.screenShake);
  E.screenShake.trigger = function(...args) {
    E.sound('thud', { volume: 0.6 });
    return triggerShake(...args);
  };

  E.outcomeSound = outcomeSound;
})();
