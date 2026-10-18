;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});
  const { SCALE, OUT, HERO_FRAMES, ENEMY_FRAMES, BOSS_FRAMES, ITEM_FRAMES, BOSS_KINDS, make, shade, vgrad, ballGrad, ellipse, circle, rr, fillOut, gloss, limb, star, cacheSize, hero, enemy, boss, paintCoin, paintGem, heartPath, ITEM_DEF, item } = Kit;

  /*
   * Sprites: the UI icons (painted in a 32-unit box, scaled to the requested size), and the
   * public SZ.PlatformerSprites API.
   */

  const ICONS = {
    boot(g, c) {
      g.beginPath();
      g.moveTo(-6, -13); g.lineTo(5, -13); g.lineTo(5, 2); g.lineTo(13, 5); g.quadraticCurveTo(15, 12, 9, 12);
      g.lineTo(-8, 12); g.lineTo(-8, -2);
      g.closePath();
      fillOut(g, vgrad(g, -13, 12, shade(c, 0.35), shade(c, -0.35)), 1.8);
      rr(g, -8, -15, 15, 4, 2); fillOut(g, shade(c, 0.5), 1.2);
      g.beginPath();
      g.moveTo(-13, -4); g.lineTo(-9, -6); g.moveTo(-14, 2); g.lineTo(-9, 1); g.moveTo(-13, 8); g.lineTo(-9, 7);
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
    },
    heart(g, c) {
      heartPath(g, 0, 1, 13);
      fillOut(g, vgrad(g, -13, 13, shade(c, 0.45), shade(c, -0.4), c), 1.8);
      gloss(g, -5, -5, 4, 2.6, 0.7);
    },
    heartEmpty(g) {
      heartPath(g, 0, 1, 13);
      fillOut(g, 'rgba(30,20,40,0.65)', 1.8);
      heartPath(g, 0, 1, 9.5);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.stroke();
    },
    coin(g) { paintCoin(g, 0); },
    gem(g, c) {
      const idx = c === '#7affa0' || c === 'emerald' ? 1 : c === '#8ad8ff' || c === 'sapphire' ? 2 : 0;
      g.save();
      g.scale(0.95, 0.95);
      paintGem(g, 2, idx);
      g.restore();
    },
    flame(g, c) {
      g.beginPath();
      g.moveTo(0, -15);
      g.bezierCurveTo(8, -6, 13, 0, 11, 6);
      g.bezierCurveTo(9, 13, -9, 13, -11, 6);
      g.bezierCurveTo(-12, 0, -6, -3, -4, -9);
      g.bezierCurveTo(-2, -4, 0, -4, 0, -15);
      g.closePath();
      fillOut(g, vgrad(g, -15, 13, '#ffe080', shade(c, -0.3), c), 1.8);
      g.beginPath();
      g.moveTo(0, -2);
      g.bezierCurveTo(5, 3, 6, 6, 4, 9);
      g.bezierCurveTo(1, 11, -4, 10, -5, 7);
      g.bezierCurveTo(-5, 3, -1, 2, 0, -2);
      g.fillStyle = '#fff6c8';
      g.fill();
    },
    star(g, c) {
      star(g, 0, 1, 14.5, 0.48);
      fillOut(g, vgrad(g, -14, 14, shade(c, 0.6), shade(c, -0.35), c), 1.8);
      gloss(g, -4, -4, 3.5, 2, 0.6);
    },
    clock(g, c) {
      circle(g, 0, 1, 13);
      fillOut(g, ballGrad(g, 0, 1, 13, c), 1.8);
      circle(g, 0, 1, 9.5);
      g.fillStyle = '#fbf6e8';
      g.fill();
      g.beginPath();
      g.moveTo(0, 1); g.lineTo(0, -6); g.moveTo(0, 1); g.lineTo(5, 3);
      g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
      rr(g, -3, -15, 6, 4, 1.5); fillOut(g, c, 1.2);
    },
    skull(g, c) {
      g.beginPath();
      g.arc(0, -2, 12, Math.PI * 0.9, Math.PI * 2.1);
      g.lineTo(7, 9); g.lineTo(-7, 9);
      g.closePath();
      fillOut(g, vgrad(g, -14, 10, '#ffffff', shade(c, -0.2)), 1.8);
      ellipse(g, -4.5, -1, 3.2, 3.6); g.fillStyle = OUT; g.fill();
      ellipse(g, 4.5, -1, 3.2, 3.6); g.fill();
      g.beginPath(); g.moveTo(0, 3); g.lineTo(-1.6, 6); g.lineTo(1.6, 6); g.fill();
      g.beginPath();
      g.moveTo(-3, 9); g.lineTo(-3, 13); g.moveTo(0, 9); g.lineTo(0, 13); g.moveTo(3, 9); g.lineTo(3, 13);
      g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
    },
    lock(g, c) {
      g.beginPath();
      g.arc(0, -4, 7, Math.PI, 0);
      g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 3.5; g.strokeStyle = '#c8cce0'; g.stroke();
      rr(g, -11, -4, 22, 17, 4);
      fillOut(g, vgrad(g, -4, 13, shade(c, 0.4), shade(c, -0.35)), 1.8);
      circle(g, 0, 3, 2.6); g.fillStyle = OUT; g.fill();
      g.fillRect(-1, 3, 2, 6);
    },
    shield(g, c) {
      g.beginPath();
      g.moveTo(0, -14); g.lineTo(12, -9); g.quadraticCurveTo(12, 8, 0, 15); g.quadraticCurveTo(-12, 8, -12, -9);
      g.closePath();
      fillOut(g, vgrad(g, -14, 15, shade(c, 0.45), shade(c, -0.4), c), 1.8);
      g.beginPath();
      g.moveTo(0, -10); g.lineTo(0, 11);
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    },
    magnet(g, c) {
      g.beginPath();
      g.arc(0, -1, 10, Math.PI, 0);
      g.lineTo(10, 10); g.lineTo(4, 10); g.lineTo(4, -1);
      g.arc(0, -1, 4, 0, Math.PI, true);
      g.lineTo(-4, 10); g.lineTo(-10, 10);
      g.closePath();
      fillOut(g, vgrad(g, -11, 10, shade(c, 0.4), shade(c, -0.35)), 1.8);
      g.fillStyle = '#e8ecf4';
      g.fillRect(-10, 6, 6, 4);
      g.fillRect(4, 6, 6, 4);
    },
    trophy(g, c) {
      g.beginPath();
      g.moveTo(-10, -13); g.lineTo(10, -13); g.quadraticCurveTo(10, 4, 0, 5); g.quadraticCurveTo(-10, 4, -10, -13);
      g.closePath();
      fillOut(g, vgrad(g, -13, 5, shade(c, 0.55), shade(c, -0.35), c), 1.8);
      g.beginPath();
      g.arc(-11, -6, 5, Math.PI * 0.5, Math.PI * 1.5);
      g.moveTo(11, -11);
      g.arc(11, -6, 5, -Math.PI * 0.5, Math.PI * 0.5);
      g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      rr(g, -2.5, 5, 5, 5, 1); fillOut(g, shade(c, -0.2), 1.2);
      rr(g, -8, 10, 16, 5, 2); fillOut(g, shade(c, -0.1), 1.4);
      gloss(g, -5, -8, 2.6, 4, 0.6);
    },
    flag(g, c) {
      limb(g, -9, 14, -9, -14, 2.4, '#c8a878');
      g.beginPath();
      g.moveTo(-8, -13); g.quadraticCurveTo(0, -16, 12, -10); g.quadraticCurveTo(4, -5, 12, 1); g.quadraticCurveTo(0, -3, -8, 0);
      g.closePath();
      fillOut(g, vgrad(g, -14, 1, shade(c, 0.35), shade(c, -0.3)), 1.6);
    },
    bolt(g, c) {
      g.beginPath();
      g.moveTo(6, -15); g.lineTo(-11, 3); g.lineTo(-1, 3); g.lineTo(-6, 15); g.lineTo(11, -4); g.lineTo(2, -4);
      g.closePath();
      fillOut(g, vgrad(g, -15, 15, shade(c, 0.6), shade(c, -0.3)), 1.8);
    },
    map(g, c) {
      g.beginPath();
      g.moveTo(-13, -10); g.lineTo(-5, -13); g.lineTo(5, -10); g.lineTo(13, -13); g.lineTo(13, 10); g.lineTo(5, 13); g.lineTo(-5, 10); g.lineTo(-13, 13);
      g.closePath();
      fillOut(g, vgrad(g, -13, 13, '#fbf0d0', '#d8c090'), 1.6);
      g.beginPath();
      g.moveTo(-5, -13); g.lineTo(-5, 10); g.moveTo(5, -10); g.lineTo(5, 13);
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
      g.beginPath();
      g.moveTo(-10, 6); g.quadraticCurveTo(-4, -4, 2, 2); g.quadraticCurveTo(6, 6, 8, -4);
      g.setLineDash([2, 2]);
      g.lineWidth = 1.4; g.strokeStyle = c; g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(6, -7); g.lineTo(10, -3); g.moveTo(10, -7); g.lineTo(6, -3);
      g.lineWidth = 1.8; g.strokeStyle = '#e83a3a'; g.stroke();
    }
  };

  function icon(name, color, size) {
    const n = ICONS[name] ? name : 'star';
    const c = color || '#ffd75a';
    const s = Math.max(4, size || 24);
    return make('icon|' + n + '|' + c + '|' + s, s, s, s / 2, s / 2, (g) => {
      g.scale(s / 34, s / 34);
      ICONS[n](g, c);
    });
  }

  SZ.PlatformerSprites = Object.freeze({
    SCALE, HERO_FRAMES, ENEMY_FRAMES, BOSS_FRAMES, ITEM_FRAMES, BOSS_KINDS,
    ICON_NAMES: Object.freeze(Object.keys(ICONS)),
    ITEM_KINDS: Object.freeze(Object.keys(ITEM_DEF)),
    hero, enemy, boss, item, icon, cacheSize
  });
})();
