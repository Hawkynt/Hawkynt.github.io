;(function() {
  'use strict';

  // Combat overlays: weak points, charge ring, parry, tells and combo.
  // Owns: NS.combatArt
  // Reads: constants, dom, sprites, fxArt, textLayout, panels, rules, weapon
  // Reads state of: gameState, weapon, bombs

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { TWO_PI, VIEW_SURFACE, STATE_PLAYING } = NS.constants;
  const { ctx, particles } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText } = NS.textLayout;
  const { UI, drawMeter, drawChip } = NS.panels;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { COMBO_TIMEOUT, CHARGE_TIME, PERFECT_FROM, PARRY_WINDOW, PARRY_COOLDOWN, weakPoint, comboMult } = NS.weapon;

  /* ======================================================================
     DRAWING -- COMBAT SKILL (weak points, charge ring, parry, tells, combo)
     ====================================================================== */

  // Monster under the cursor (or the one a charge is aimed at)
  function hoveredEnemy() {
    if (G.mouseAimX < 0 || G.state !== STATE_PLAYING) return null;
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
      if (e.hidden) continue;
      const d = Math.hypot(G.mouseAimX - e.x, G.mouseAimY - e.y);
      const r = (e.size || 16) + (G.charge ? 60 : 14);
      if (d < r && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function drawWeakPointReticle(e) {
    const w = weakPoint(e);
    const pulse = 0.6 + Math.sin(G.animTime * 10) * 0.4;
    ctx.save();
    drawGlow('#ffd040', w.x, w.y, w.r * 2.4, 0.45 * pulse);
    ctx.strokeStyle = `rgba(255,220,90,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, TWO_PI);
    ctx.stroke();
    const g = w.r + 7;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(w.x + dx * (w.r - 3), w.y + dy * (w.r - 3));
      ctx.lineTo(w.x + dx * g, w.y + dy * g);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Shown under the HUD: weak points, boss tells, the parry shield and parried shots
  function drawCombatOverlays() {
    // Boss and diver tells
    for (const e of G.enemies) {
      if (e.hidden) continue;
      let tell = 0;
      if (e.type === 'behemoth' && e.stomp !== undefined && e.stomp < 0.9 && Math.abs(e.x - DOME_X) < 360) {
        tell = 1 - e.stomp / 0.9;
        drawGlow('#ff7040', e.x, DOME_Y + 4, 60 + tell * 50, 0.35 + tell * 0.4);
      }
      if (e.type === 'queen' && e.lanceAim) {
        tell = 1 - Math.max(0, e.lance) / 1.1;
        ctx.save();
        ctx.setLineDash([12, 10]);
        ctx.lineDashOffset = -G.animTime * 60;
        ctx.strokeStyle = `rgba(255,90,220,${0.35 + tell * 0.55})`;
        ctx.lineWidth = 2 + tell * 4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.size * 0.3);
        ctx.lineTo(e.lanceAim.tx, e.lanceAim.ty);
        ctx.stroke();
        ctx.restore();
        drawGlow('#ff70e0', e.lanceAim.tx, e.lanceAim.ty, 26 + tell * 20, 0.5 + tell * 0.4);
      }
      if (e.type === 'diver' && e.phase === 'dive')
        tell = 1;
      if (tell > 0) {
        const y = e.y - (e.size || 20) * (e.boss ? 2.2 : 1.6) - 26;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText('!', e.x, y + Math.sin(G.animTime * 18) * 2, 30, 22 + tell * 10, { weight: 'bold', color: tell > 0.7 ? '#ff5a3a' : '#ffd040', outline: 'rgba(0,0,0,0.85)' });
      }
    }
    // Weak point of the monster under the cursor
    const he = G.currentView === VIEW_SURFACE && !G.bombThrowMode ? hoveredEnemy() : null;
    if (he)
      drawWeakPointReticle(he);
    // Parry shield
    if (G.parryT > 0) {
      const k = G.parryT / PARRY_WINDOW;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 18, Math.PI, 0);
      ctx.strokeStyle = `rgba(150,230,255,${0.9 * k})`;
      ctx.lineWidth = 10 * k + 3;
      ctx.shadowColor = '#8ae8ff';
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.restore();
    }
    // Parried shots flying back
    for (const r of G.reflected) {
      const x = r.x0 + (r.tx - r.x0) * r.t, y = r.y0 + (r.ty - r.y0) * r.t - Math.sin(r.t * Math.PI) * 40;
      drawGlow(r.kind === 'lance' ? '#ff70e0' : '#8ae8ff', x, y, 28, 0.9);
      ctx.fillStyle = '#f0ffff';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TWO_PI);
      ctx.fill();
      if (Math.random() < 0.6)
        particles.trail(x, y, { vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), color: '#9ae8ff', life: 0.25, size: 2 });
    }
  }

  // Timing ring while charging: the outer ring closes in, release when it meets the gold circle
  function drawChargeRing() {
    if (!G.charge || G.currentView !== VIEW_SURFACE || G.charge.t < 0.15) return;
    const k = G.charge.t / CHARGE_TIME;
    let x, y;
    if (G.mouseAimX >= 0 && G.mouseAimY < DOME_Y + 45) {
      x = G.mouseAimX;
      y = G.mouseAimY;
    } else {
      x = DOME_X + Math.cos(G.turretAngle) * 320;
      y = DOME_Y + Math.sin(G.turretAngle) * 320;
    }
    const inWindow = k >= PERFECT_FROM && k <= 1;
    const R0 = 70, Rt = 20;
    const r = Math.max(8, R0 - (R0 - Rt) * Math.min(1.2, k));
    ctx.save();
    // Gold target circle
    ctx.strokeStyle = inWindow ? '#fff2a0' : 'rgba(255,215,90,0.75)';
    ctx.lineWidth = inWindow ? 5 : 3;
    if (inWindow) {
      ctx.shadowColor = UI.gold;
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.arc(x, y, Rt, 0, TWO_PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Closing ring
    ctx.strokeStyle = k > 1 ? 'rgba(255,90,70,0.9)' : (inWindow ? '#ffffff' : 'rgba(150,220,255,0.85)');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.stroke();
    // Charge arc around the turret
    const tx = DOME_X + Math.cos(G.turretAngle) * (DOME_RADIUS + 16), ty = DOME_Y + Math.sin(G.turretAngle) * (DOME_RADIUS + 16);
    drawGlow(inWindow ? '#ffe060' : '#ffb070', tx, ty, 20 + Math.min(1, k) * 30, 0.4 + Math.min(1, k) * 0.5);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(inWindow ? 'RELEASE!' : (k > 1 ? 'Too late…' : 'Charging'), x, y + R0 + 12, 160, 16, { weight: 'bold', color: inWindow ? UI.gold : (k > 1 ? '#ff8a7a' : '#bfe0ff'), outline: 'rgba(0,0,0,0.8)' });
  }

  // Combo meter right of the dome bar, parry readiness left of it
  function drawCombatHUD(barX, barY, barW, barH) {
    // Parry
    const px = barX - 26, py = barY + barH / 2;
    const ready = G.parryCd <= 0;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,26,0.85)';
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    ctx.strokeStyle = ready ? '#8ae8ff' : 'rgba(138,232,255,0.5)';
    ctx.beginPath();
    ctx.arc(px, py, 18, -Math.PI / 2, -Math.PI / 2 + TWO_PI * (1 - G.parryCd / PARRY_COOLDOWN));
    ctx.stroke();
    ctx.restore();
    drawSprite('shield', px, py, 20, ready ? 1 : 0.45);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    fitText('Parry [E]', px - 24, py + 1, 90, 13, { weight: 'bold', color: ready ? '#bff0ff' : UI.textMute });
    // Combo
    if (G.combo >= 2) {
      const cx = barX + barW + 12;
      const w = drawChip(`Combo x${G.combo}  ·  ${comboMult().toFixed(2)}x`, cx, barY, barH, { px: 15, maxW: 190, bg: 'rgba(255,120,255,0.16)', border: 'rgba(255,160,255,0.6)', color: '#ffc8ff' });
      drawMeter(cx + 6, barY + barH + 3, w - 12, 4, G.comboTimer / COMBO_TIMEOUT, '#ff9aff', { track: 'rgba(0,0,0,0.5)' });
    }
  }

  NS.combatArt = { drawCombatOverlays, drawChargeRing, drawCombatHUD };
})();
