/* The canvas and its context, the remembered field size, the shared effect
   singletons and the status bar elements. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  try {
    const saved = localStorage.getItem(C.FIELD_STORAGE_KEY);
    if (saved && C.FIELD_SIZES[saved]) S.fieldSizeKey = saved;
  } catch (_) {}

  const { ParticleSystem, ScreenShake, FloatingText } = SZ.GameEffects;
  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const floatingText = new FloatingText();

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');
  const statusLevelLabel = document.getElementById('statusLevelLabel');
  const statusMode = document.getElementById('statusMode');

  NS.dom = NS.dom || {
    canvas, ctx, dpr,
    particles, shake, floatingText,
    statusScore, statusLives, statusLevel, statusLevelLabel, statusMode
  };
})();
