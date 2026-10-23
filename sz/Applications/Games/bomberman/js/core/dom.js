/* The canvas, the status bar elements, the three effect layers and the two sprite
   sheets — plus the canvas setup that maps the backing store to the device ratio. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom = NS.dom || {};

  /* ── DOM ── */
  D.canvas = document.getElementById('gameCanvas');
  D.ctx = D.canvas.getContext('2d');
  D.statusScore = document.getElementById('statusScore');
  D.statusLevel = document.getElementById('statusLevel');
  D.statusLives = document.getElementById('statusLives');
  D.statusState = document.getElementById('statusState');

  /* ── Effects ── */
  D.particles = new SZ.GameEffects.ParticleSystem();
  D.screenShake = new SZ.GameEffects.ScreenShake();
  D.floatingText = new SZ.GameEffects.FloatingText();

  /* ── Sprites ── */
  D.spriteSheet = new Image();
  D.spriteSheet.src = 'bomb_party_v4.png';
  D.explosionSheet = new Image();
  D.explosionSheet.src = 'BomberManEffect.png';
  D.spriteSheet.onload = () => ++S.spritesReady;
  D.explosionSheet.onload = () => ++S.spritesReady;
  D.spriteSheet.onerror = () => {};
  D.explosionSheet.onerror = () => {};

  /* ── Canvas Setup ── */
  D.setupCanvas = function setupCanvas() {
    S.dpr = window.devicePixelRatio || 1;
    D.canvas.width = C.COLS * C.TILE_SIZE * S.dpr;
    D.canvas.height = C.ROWS * C.TILE_SIZE * S.dpr;
    D.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  };
})();
