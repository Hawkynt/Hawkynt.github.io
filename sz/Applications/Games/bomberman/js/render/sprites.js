/* The two sprite blits: a sheet piece scaled onto the tile grid and the
   horizontally mirrored variant used for left-facing characters. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const D = NS.dom;
  const R = NS.sprites = NS.sprites || {};

  R.drawSprite = function drawSprite(s, dx, dy, dw, dh) {
    D.ctx.drawImage(D.spriteSheet, s.x, s.y, C.SP, C.SP, dx, dy, dw || C.TILE_SIZE, dh || C.TILE_SIZE);
  };

  R.drawSpriteFlippedH = function drawSpriteFlippedH(s, dx, dy, dw, dh) {
    const w = dw || C.TILE_SIZE;
    const h = dh || C.TILE_SIZE;
    D.ctx.save();
    D.ctx.translate(dx + w, dy);
    D.ctx.scale(-1, 1);
    D.ctx.drawImage(D.spriteSheet, s.x, s.y, C.SP, C.SP, 0, 0, w, h);
    D.ctx.restore();
  };
})();
