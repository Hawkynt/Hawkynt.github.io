/*
 * Drawing primitives shared by the world, the HUD and the menus: sprites, additive glows and icons.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const Spr = SZ.PlatformerSprites;
  const Fx = SZ.PlatformerFx;
  const ctx = G.ctx;

  function drawSprite(s, x, y, flip, sx, sy) {
    if (!flip && !sx) {
      ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
  }

  function glowSprite(color) {
    return Fx.sprite('glow', color);
  }

  function drawGlow(x, y, size, color, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(color), x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }

  function drawIcon(name, color, x, y, size) {
    const s = Spr.icon(name, color, size);
    ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  }

  Object.assign(NS.module('kit'), {
    drawSprite,
    glowSprite,
    drawGlow,
    drawIcon
  });
})();
