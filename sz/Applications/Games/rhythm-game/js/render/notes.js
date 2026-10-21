/* The falling notes with their comet-tail gradients and neon bodies, and the
   combo counter with its elastic bounce, milestone colors and multiplier line. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { laneX, getMultiplier } = NS.rules;

  function drawNotes() {
    const ctx = D.ctx;

    // Draw trail particles behind notes (rendered under the notes)
    D.trailParticles.draw(ctx);

    for (const note of S.activeNotes) {
      if (note.hit || note.missed) continue;
      const elapsed = S.songTime - note.time;
      const y = C.HIT_ZONE_Y + elapsed * C.NOTE_SPEED;
      if (y < -C.NOTE_RADIUS * 2 || y > C.CANVAS_H + C.NOTE_RADIUS) continue;

      const x = laneX(note.lane);
      const neonColor = C.NEON_COLORS[note.lane];
      const neonGlow = C.NEON_GLOW_COLORS[note.lane];

      // Gradient trail streak above note (comet tail effect)
      const trailLen = 40 + S.bgPulseIntensity * 20;
      const trailGrad = ctx.createLinearGradient(x, y - trailLen, x, y);
      trailGrad.addColorStop(0, 'rgba(0,0,0,0)');
      trailGrad.addColorStop(0.5, neonGlow + '33');
      trailGrad.addColorStop(1, neonColor + 'aa');
      ctx.save();
      ctx.fillStyle = trailGrad;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - C.NOTE_RADIUS * 0.5, y);
      ctx.lineTo(x - C.NOTE_RADIUS * 0.15, y - trailLen);
      ctx.lineTo(x + C.NOTE_RADIUS * 0.15, y - trailLen);
      ctx.lineTo(x + C.NOTE_RADIUS * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Neon outer glow
      ctx.save();
      ctx.shadowColor = neonGlow;
      ctx.shadowBlur = 12 + S.bgPulseIntensity * 8;

      // Note body with neon color
      ctx.fillStyle = neonColor;
      ctx.beginPath();
      ctx.arc(x, y, C.NOTE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Double-draw for stronger glow
      ctx.beginPath();
      ctx.arc(x, y, C.NOTE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner bright core
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, C.NOTE_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Note highlight (specular)
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(x - 4, y - 5, C.NOTE_RADIUS * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawComboDisplay() {
    const ctx = D.ctx;
    if (S.combo > 1) {
      ctx.save();
      ctx.textAlign = 'right';

      // Elastic bounce + pulse scale effect
      const bounceElastic = S.comboBounce > 0
        ? Math.sin(S.comboBounce * Math.PI * 3) * S.comboBounce * 0.25
        : 0;
      const pulseScale = 1 + S.comboPulse * 0.4 + bounceElastic;
      const comboX = C.CANVAS_W - 30;
      const comboY = 42;
      ctx.translate(comboX, comboY);
      ctx.scale(pulseScale, pulseScale);

      // Color shifts at milestones — neon style
      const comboColor = S.combo >= 50 ? '#ff44ff' : S.combo >= 30 ? '#ffaa00' : S.combo >= 10 ? '#ffee00' : '#ffffff';
      const glowColor = S.combo >= 50 ? '#ff00ff' : S.combo >= 30 ? '#ff8800' : S.combo >= 10 ? '#ffdd00' : '#aaaaff';

      // Neon glow — always on, stronger at high combos
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12 + S.comboGlowIntensity * 25 + S.comboPulse * 10;

      // Outline stroke for punch
      ctx.font = 'bold 26px sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(`${S.combo} Combo`, 0, 0);

      // Fill with neon color
      ctx.fillStyle = comboColor;
      ctx.fillText(`${S.combo} Combo`, 0, 0);

      // Bright white core re-draw for extra neon pop
      ctx.globalAlpha = 0.3 + S.comboPulse * 0.3;
      ctx.fillStyle = '#fff';
      ctx.fillText(`${S.combo} Combo`, 0, 0);
      ctx.globalAlpha = 1;

      ctx.restore();

      const mult = getMultiplier();
      if (mult > 1) {
        ctx.save();
        ctx.textAlign = 'right';
        const multColor = mult >= 4 ? '#ff44ff' : mult >= 3 ? '#ffaa00' : '#ffee00';
        ctx.fillStyle = multColor;
        ctx.font = 'bold 18px sans-serif';
        ctx.shadowColor = multColor;
        ctx.shadowBlur = 10 + S.comboPulse * 8;
        // Slight scale on multiplier too
        const multScale = 1 + S.comboPulse * 0.2;
        ctx.translate(C.CANVAS_W - 30, 66);
        ctx.scale(multScale, multScale);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(`x${mult}`, 0, 0);
        ctx.fillText(`x${mult}`, 0, 0);
        ctx.restore();
      }
    }
  }

  Object.assign(NS.notes, { drawNotes, drawComboDisplay });
})();
