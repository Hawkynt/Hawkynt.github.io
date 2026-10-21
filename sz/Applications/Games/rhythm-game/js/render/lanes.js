/* The playfield chrome: beat-pulsing background, neon lane separators and tints,
   the lane labels, the glowing hit zone with its per-lane flash columns and
   circles, the combo glow line and the expanding glow rings. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { laneX } = NS.rules;

  function drawLaneBackground() {
    const ctx = D.ctx;

    // Dark background with beat pulse
    const pulseR = Math.round(10 + S.bgPulseIntensity * 30);
    const pulseG = Math.round(10 + S.bgPulseIntensity * 12);
    const pulseB = Math.round(26 + S.bgPulseIntensity * 50);
    ctx.fillStyle = `rgb(${pulseR},${pulseG},${pulseB})`;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Subtle radial vignette pulse from center on beats
    if (S.bgPulseIntensity > 0.02) {
      const grad = ctx.createRadialGradient(C.CANVAS_W / 2, C.HIT_ZONE_Y, 0, C.CANVAS_W / 2, C.HIT_ZONE_Y, C.CANVAS_W * 0.7);
      grad.addColorStop(0, `rgba(40,20,80,${S.bgPulseIntensity * 0.5})`);
      grad.addColorStop(0.5, `rgba(20,10,50,${S.bgPulseIntensity * 0.3})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    }

    // Neon lane separators with glow
    for (let i = 0; i <= C.LANE_COUNT; ++i) {
      const x = C.LANE_START_X + i * C.laneWidth;
      const laneIdx = Math.min(i, C.LANE_COUNT - 1);
      const neonColor = C.NEON_GLOW_COLORS[laneIdx];

      ctx.save();
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.15 + S.bgPulseIntensity * 0.15;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 6 + S.bgPulseIntensity * 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, C.CANVAS_H);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle neon lane tint — each lane gets a faint colored underlay
    for (let i = 0; i < C.LANE_COUNT; ++i) {
      const lx = C.LANE_START_X + i * C.laneWidth;
      ctx.save();
      ctx.globalAlpha = 0.03 + S.bgPulseIntensity * 0.04;
      ctx.fillStyle = C.NEON_COLORS[i];
      ctx.fillRect(lx, 0, C.laneWidth, C.CANVAS_H);
      ctx.restore();
    }

    // Lane labels at bottom with neon glow
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < C.LANE_COUNT; ++i) {
      ctx.save();
      ctx.fillStyle = C.NEON_COLORS[i];
      ctx.globalAlpha = 0.5 + S.bgPulseIntensity * 0.3;
      ctx.shadowColor = C.NEON_GLOW_COLORS[i];
      ctx.shadowBlur = 8;
      ctx.fillText(C.LANE_LABELS[i], laneX(i), C.CANVAS_H - 15);
      ctx.restore();
    }
  }

  function drawHitZone() {
    const ctx = D.ctx;

    // Hit zone line with neon glow
    ctx.save();
    ctx.strokeStyle = '#aaccff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 12 + S.bgPulseIntensity * 10;
    ctx.beginPath();
    ctx.moveTo(C.LANE_START_X, C.HIT_ZONE_Y);
    ctx.lineTo(C.LANE_START_X + C.LANE_COUNT * C.laneWidth, C.HIT_ZONE_Y);
    ctx.stroke();
    // Draw it twice for stronger glow
    ctx.stroke();
    ctx.restore();

    // Hit zone circles per lane (with neon flash effect)
    for (let i = 0; i < C.LANE_COUNT; ++i) {
      const x = laneX(i);
      const flash = S.laneFlash[i];
      const neonColor = C.NEON_COLORS[i];
      const neonGlow = C.NEON_GLOW_COLORS[i];

      // Lane flash — bright neon column flash on hit
      if (flash > 0) {
        ctx.save();
        // Neon column gradient
        const colGrad = ctx.createLinearGradient(0, C.HIT_ZONE_Y - 200, 0, C.HIT_ZONE_Y);
        colGrad.addColorStop(0, 'rgba(0,0,0,0)');
        colGrad.addColorStop(1, neonColor);
        ctx.globalAlpha = flash * 0.3;
        ctx.fillStyle = colGrad;
        ctx.fillRect(C.LANE_START_X + i * C.laneWidth, 0, C.laneWidth, C.CANVAS_H);
        ctx.restore();
      }

      // Neon glow circle at hit zone
      ctx.save();
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 2 + flash * 4;
      ctx.globalAlpha = 0.6 + flash * 0.4;
      ctx.shadowColor = neonGlow;
      ctx.shadowBlur = 10 + flash * 20;
      ctx.beginPath();
      ctx.arc(x, C.HIT_ZONE_Y, C.NOTE_RADIUS + flash * 5, 0, Math.PI * 2);
      ctx.stroke();
      // Double-draw for stronger neon
      ctx.stroke();
      ctx.restore();

      // Filled glow on flash
      if (flash > 0.2) {
        ctx.save();
        ctx.fillStyle = neonColor;
        ctx.globalAlpha = flash * 0.35;
        ctx.shadowColor = neonGlow;
        ctx.shadowBlur = 15 + flash * 15;
        ctx.beginPath();
        ctx.arc(x, C.HIT_ZONE_Y, C.NOTE_RADIUS + flash * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Combo glow on hit zone — neon intensifies with longer streaks
    if (S.comboGlowIntensity > 0) {
      ctx.save();
      const glowAlpha = S.comboGlowIntensity * 0.7;
      ctx.globalAlpha = glowAlpha;
      // Multi-color combo glow — shifts from yellow to magenta at high combos
      const comboHue = S.combo >= 50 ? '#ff44ff' : S.combo >= 30 ? '#ffaa00' : '#ffff00';
      ctx.shadowColor = comboHue;
      ctx.shadowBlur = 20 + S.comboGlowIntensity * 30;
      ctx.strokeStyle = comboHue;
      ctx.lineWidth = 3 + S.comboGlowIntensity * 2;
      ctx.beginPath();
      ctx.moveTo(C.LANE_START_X, C.HIT_ZONE_Y);
      ctx.lineTo(C.LANE_START_X + C.LANE_COUNT * C.laneWidth, C.HIT_ZONE_Y);
      ctx.stroke();
      ctx.stroke();
      ctx.restore();
    }

    // Draw expanding glow rings (from PERFECT / GREAT hits) — neon style
    for (const ring of S.glowRings) {
      ctx.save();
      ctx.globalAlpha = ring.life * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2 + ring.life * 4;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 15 + ring.life * 25;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      // Inner bright line
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = ring.life * 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  Object.assign(NS.lanes, { drawLaneBackground, drawHitZone });
})();
