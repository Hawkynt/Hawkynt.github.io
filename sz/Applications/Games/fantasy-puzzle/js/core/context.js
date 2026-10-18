/* Long-lived page objects: the canvas and its 2D context, the drawing kit, status-bar elements, the
   particle systems and the throttled sound gate. Reads nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});

  /* ── Sound ──
     one gate for every effect: the same name never fires twice within
     SFX_THROTTLE_MS, so bursts of steps or a spreading blaze can't spam */
  const SFX_THROTTLE_MS = 40;
  const sfxLast = {};

  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || -Infinity) < SFX_THROTTLE_MS)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.PuzzleUI.create(ctx);
  const statusLevel = document.getElementById('statusLevel');
  const statusElement = document.getElementById('statusElement');
  const statusMoves = document.getElementById('statusMoves');
  const statusStars = document.getElementById('statusStars');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  const Fx = SZ.PuzzleFx;
  const fxBoard = Fx.create(400);   // board space: spells, footsteps, the realm's air
  const fxScreen = Fx.create(300);  // view space: fireworks, confetti, star bursts

  /* menus share one particle system for the realm's air and the orbiting orbs */
  const fxMenu = Fx.create(260);

  NS.context = { sfx, canvas, ctx, ui, statusLevel, statusElement, statusMoves, statusStars, highScoresBody,
    User32, particles, screenShake, floatingText, Fx, fxBoard, fxScreen, fxMenu };
})();
