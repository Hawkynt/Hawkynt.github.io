/*
 * Page singletons: the game canvas and its 2D context, the panel/text kit
 * (SZ.RacingUI), status-bar elements, the OS window API and the shared particle,
 * screen-shake and floating-text effects. Created once at load; holds no game state.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.RacingUI.create(ctx);
  const statusPosition = document.getElementById('statusPosition');
  const statusLap = document.getElementById('statusLap');
  const statusSpeed = document.getElementById('statusSpeed');
  const statusTime = document.getElementById('statusTime');
  const statusCredits = document.getElementById('statusCredits');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  Object.assign(NS.module('runtime'), {
    canvas, ctx, ui, statusPosition, statusLap, statusSpeed, statusTime, statusCredits, highScoresBody,
    User32, particles, screenShake, floatingText
  });
})();
