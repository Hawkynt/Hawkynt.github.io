;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});
  const A = NS.art || (NS.art = {});

  /*
   * The actors on top of the field: the ball in its five skins, targets
   * with their halo, spinning stars and the launcher with its barrel.
   * Reads the sprite kit and the material fills; owns no state.
   */

  const TWO_PI = A.TWO_PI, DEG = A.DEG, rgba = A.rgba, shade = A.shade, sprite = A.sprite, blit = A.blit, drawGlow = A.drawGlow,
    woodFill = A.woodFill, bevel = A.bevel;

  /* ══════════════════════════════════════════════════════════════════
     BALL, TARGET, STAR, LAUNCHER
     ══════════════════════════════════════════════════════════════════ */

  function ballBase(skin, r) {
    return sprite('ball' + skin.id + r, r * 2, r * 2, 3, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.arc(r + 1.5, r + 2, r, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(r * 0.65, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, skin.id === 'marble' ? 'rgba(255,255,255,0.95)' : '#ffffff');
      rg.addColorStop(0.35, skin.base);
      rg.addColorStop(1, skin.dark);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.4, 0, TWO_PI);
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(10,10,20,0.75)';
      g.stroke();
    });
  }

  function ballDetail(skin, r) {
    return sprite('balld' + skin.id + r, r * 2, r * 2, 3, (g) => {
      g.save();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TWO_PI);
      g.clip();
      if (skin.id === 'marble') {
        g.strokeStyle = 'rgba(255,90,140,0.75)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(r * 0.2, r * 1.2);
        g.bezierCurveTo(r * 0.8, r * 0.2, r * 1.2, r * 1.8, r * 1.8, r * 0.8);
        g.stroke();
        g.strokeStyle = 'rgba(80,200,255,0.7)';
        g.beginPath();
        g.moveTo(r * 0.4, r * 1.7);
        g.bezierCurveTo(r, r * 1.1, r * 1.2, r * 0.4, r * 1.6, r * 0.3);
        g.stroke();
      } else if (skin.id === 'plasma') {
        g.strokeStyle = 'rgba(255,255,255,0.8)';
        g.lineWidth = 1.4;
        for (let k = 0; k < 3; ++k) {
          g.beginPath();
          g.moveTo(r, r);
          const a = k * 2.1;
          g.lineTo(r + Math.cos(a) * r * 0.5, r + Math.sin(a) * r * 0.5 + 2);
          g.lineTo(r + Math.cos(a + 0.3) * r, r + Math.sin(a + 0.3) * r);
          g.stroke();
        }
      } else {
        /* a seam band so rolling shows */
        g.strokeStyle = rgba(skin.dark, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(r, r, r * 0.35, r, 0, 0, TWO_PI);
        g.stroke();
      }
      g.restore();
    });
  }

  function ballShine(r) {
    return sprite('ballshine' + r, r * 2, r * 2, 3, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(r * 0.66, r * 0.5, r * 0.32, r * 0.2, -0.6, 0, TWO_PI);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.arc(r * 1.3, r * 1.4, r * 0.18, 0, TWO_PI);
      g.fill();
    });
  }

  function drawBall(ctx, x, y, a, skin, r, t) {
    const R = r || 13;
    if (skin.id === 'plasma' || skin.id === 'gold')
      drawGlow(ctx, x, y, R * (skin.id === 'plasma' ? 5 : 3.4), skin.glow, skin.id === 'plasma' ? 0.55 + 0.15 * Math.sin(t * 12) : 0.3);
    blit(ctx, ballBase(skin, R), x, y, 0);
    blit(ctx, ballDetail(skin, R), x, y, a);
    blit(ctx, ballShine(R), x, y, 0);
  }

  function targetSprite(color, lit) {
    return sprite('target' + color + (lit ? 'L' : ''), 60, 60, 8, (g) => {
      g.translate(30, 30);
      /* a brass gong-like bullseye */
      const rings = lit ? ['#fff4c0', '#ffd84a', '#ffffff', '#ffb02a', '#fff8e0'] : [shade(color, -0.55), color, '#f4f0e8', color, '#ffffff'];
      const radii = [29, 24, 18, 12, 6];
      for (let i = 0; i < rings.length; ++i) {
        const rg = g.createRadialGradient(-radii[i] * 0.3, -radii[i] * 0.3, 0, 0, 0, radii[i]);
        rg.addColorStop(0, shade(rings[i], 0.35));
        rg.addColorStop(1, shade(rings[i], -0.15));
        g.fillStyle = rg;
        g.beginPath();
        g.arc(0, 0, radii[i], 0, TWO_PI);
        g.fill();
      }
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(20,10,4,0.85)';
      g.beginPath();
      g.arc(0, 0, 29, 0, TWO_PI);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.ellipse(-9, -12, 10, 5, -0.5, 0, TWO_PI);
      g.fill();
    });
  }

  function haloSprite(color) {
    return sprite('halo' + color, 120, 120, 0, (g) => {
      g.translate(60, 60);
      for (let k = 0; k < 3; ++k) {
        g.strokeStyle = rgba(color, [0.15, 0.35, 0.8][k]);
        g.lineWidth = [10, 5, 2][k];
        g.beginPath();
        g.arc(0, 0, 50, 0, TWO_PI);
        g.stroke();
      }
    });
  }

  function drawTarget(ctx, x, y, lit, t, color) {
    const c = color || '#ff5a5a';
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    drawGlow(ctx, x, y, lit ? 200 : 120 + 30 * pulse, lit ? '#ffd84a' : c, lit ? 0.7 : 0.35 + 0.15 * pulse);
    const halo = haloSprite(lit ? '#ffe066' : c);
    const hs = 66 + (lit ? 12 : 10 * pulse);
    ctx.save();
    ctx.globalAlpha *= lit ? 0.9 : 0.5 + 0.4 * (1 - pulse);
    ctx.drawImage(halo.c, x - hs / 2, y - hs / 2, hs, hs);
    ctx.restore();
    const s = targetSprite(c, lit);
    const sc = lit ? 1 + 0.05 * Math.sin(t * 10) : 1;
    ctx.drawImage(s.c, x - s.ax * sc, y - s.ay * sc, s.w * sc, s.h * sc);
  }

  function starSprite() {
    return sprite('star', 36, 36, 4, (g) => {
      g.translate(18, 18);
      g.beginPath();
      for (let k = 0; k < 10; ++k) {
        const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7.5 : 17;
        if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      const rg = g.createRadialGradient(-4, -6, 0, 0, 0, 18);
      rg.addColorStop(0, '#fffbe0');
      rg.addColorStop(0.45, '#ffd84a');
      rg.addColorStop(1, '#c87a10');
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = '#6a3a04';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(3, -4);
      g.lineTo(-3, -4);
      g.closePath();
      g.fill();
    });
  }

  function drawStar(ctx, x, y, t, phase) {
    const bob = Math.sin(t * 2.4 + (phase || 0)) * 4;
    drawGlow(ctx, x, y + bob, 70 + 10 * Math.sin(t * 5 + (phase || 0)), '#ffd84a', 0.45);
    const s = starSprite();
    const sx = Math.cos(t * 2 + (phase || 0));
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(0.35 + 0.65 * Math.abs(sx), 1);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
  }

  function launcherBase(world) {
    return sprite('lbase' + world, 84, 48, 8, (g, W, H, rand) => {
      /* a wooden carriage with two wheels */
      woodFill(g, 6, 14, W - 12, 18, world === 3 ? 3 : 0, rand, false);
      bevel(g, 6, 14, W - 12, 18, 1);
      for (const x of [20, W - 20]) {
        g.fillStyle = '#2a1a0c';
        g.beginPath();
        g.arc(x, 34, 13, 0, TWO_PI);
        g.fill();
        const rg = g.createRadialGradient(x - 3, 31, 0, x, 34, 12);
        rg.addColorStop(0, '#d8b080');
        rg.addColorStop(1, '#6a4020');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, 34, 11, 0, TWO_PI);
        g.fill();
        g.strokeStyle = '#3a2410';
        g.lineWidth = 1.6;
        for (let k = 0; k < 6; ++k) {
          const a = k / 6 * Math.PI;
          g.beginPath();
          g.moveTo(x - Math.cos(a) * 10, 34 - Math.sin(a) * 10);
          g.lineTo(x + Math.cos(a) * 10, 34 + Math.sin(a) * 10);
          g.stroke();
        }
        g.fillStyle = '#c8a050';
        g.beginPath();
        g.arc(x, 34, 3, 0, TWO_PI);
        g.fill();
      }
      /* the pivot bracket */
      g.fillStyle = '#5a5e68';
      g.beginPath();
      g.moveTo(W / 2 - 14, 16);
      g.lineTo(W / 2 - 6, 0);
      g.lineTo(W / 2 + 6, 0);
      g.lineTo(W / 2 + 14, 16);
      g.closePath();
      g.fill();
      g.strokeStyle = '#14161a';
      g.lineWidth = 1.2;
      g.stroke();
    });
  }

  function barrelSprite() {
    return sprite('barrel', 64, 26, 4, (g, W, H) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, '#fff0c0');
      lg.addColorStop(0.25, '#e0a848');
      lg.addColorStop(0.7, '#9a6418');
      lg.addColorStop(1, '#4a2a08');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 3);
      g.lineTo(W - 8, 1);
      g.lineTo(W, 0);
      g.lineTo(W, H);
      g.lineTo(W - 8, H - 1);
      g.lineTo(0, H - 3);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2a1404';
      g.lineWidth = 1.4;
      g.stroke();
      /* bands */
      for (const x of [14, 34, W - 6]) {
        g.fillStyle = 'rgba(40,20,4,0.6)';
        g.fillRect(x, 1, 4, H - 2);
        g.fillStyle = 'rgba(255,240,200,0.5)';
        g.fillRect(x, 1, 1.2, H - 2);
      }
      g.fillStyle = '#1a0c02';
      g.beginPath();
      g.ellipse(W - 1, H / 2, 2.5, H / 2 - 3, 0, 0, TWO_PI);
      g.fill();
    });
  }

  /* angle in degrees, power 0..1; the launcher pivot sits at (x, y) */
  function drawLauncher(ctx, x, y, angleDeg, power, t, world, recoil) {
    const base = launcherBase(world || 0);
    const a = -angleDeg * DEG;
    const r = recoil || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.translate(-r * 10, 0);
    const b = barrelSprite();
    ctx.drawImage(b.c, -16 - b.ax + 32, -b.ay, b.w, b.h);
    if (power > 0.01) {
      /* power coils glow along the barrel */
      for (let k = 0; k < 4; ++k) {
        const on = power * 4 - k;
        if (on <= 0)
          break;
        const col = power > 0.85 ? '#ff6a3a' : power > 0.5 ? '#ffd84a' : '#7ae8ff';
        drawGlow(ctx, 0 + k * 12, 0, 26, col, Math.min(1, on) * (0.7 + 0.3 * Math.sin(t * 20 + k)));
      }
    }
    ctx.restore();
    ctx.drawImage(base.c, x - base.ax, y - 8 - 6, base.w, base.h);
  }

  A.ballBase = ballBase; A.ballDetail = ballDetail; A.ballShine = ballShine; A.drawBall = drawBall; A.targetSprite = targetSprite;
  A.haloSprite = haloSprite; A.drawTarget = drawTarget; A.starSprite = starSprite; A.drawStar = drawStar; A.launcherBase = launcherBase;
  A.barrelSprite = barrelSprite; A.drawLauncher = drawLauncher;
})();
