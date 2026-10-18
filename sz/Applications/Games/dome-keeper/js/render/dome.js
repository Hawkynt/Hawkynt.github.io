;(function() {
  'use strict';

  // Drawing the dome, its turret and its landing rig.
  // Owns: NS.domeArt
  // Reads: constants, dom, sprites, fxArt, panels, rules, upgrades, gameState, time, surfaceArt
  // Reads state of: dom, gameState

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { TWO_PI } = NS.constants;
  const { ctx } = NS.dom;
  const { SPRITE_OUTLINE } = NS.sprites;
  const { buildFxArt, drawGlow } = NS.fxArt;
  const { roundRectPath } = NS.panels;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { TURRET_BARREL_LENGTH } = NS.gameState;
  const { smoothstep } = NS.time;
  const { buildSurfaceArt } = NS.surfaceArt;

  // rig (landing / relocation): lift above the ground, unpack 0 (packed) .. 1, legs 0..1
  function drawDome(rig) {
    const art = buildFxArt();
    const sky = buildSurfaceArt();
    const pulse = Math.sin(G.domePulsePhase) * 0.5 + 0.5;
    const flashAlpha = rig ? 0 : G.domeHitFlash * 0.6;
    const hpRatio = Math.max(0, G.domeHP / G.maxDomeHP);
    const R = DOME_RADIUS;
    const shieldLevel = getEffectiveLevel('domeHP');
    const unpack = rig ? rig.unpack : 1;
    const glassK = smoothstep(0.2, 0.62, unpack);
    const lift = rig ? rig.lift : 0;

    // Light pool on the ground
    if (lift < 40)
      drawGlow('#4aa8ff', DOME_X, DOME_Y + 6, R * 1.7, (0.18 + pulse * 0.05) * (1 - lift / 40) * (0.3 + 0.7 * unpack));

    ctx.save();
    ctx.translate(0, -lift);
    if (rig && rig.squash) {
      ctx.translate(DOME_X, DOME_Y + 14);
      ctx.scale(1 + rig.squash, 1 - rig.squash);
      ctx.translate(-DOME_X, -DOME_Y - 14);
    }

    // Landing legs fold out of the base
    const legs = rig ? rig.legs : 0;
    if (legs > 0.01)
      for (const side of [-1, 1])
        for (const inner of [0, 1]) {
          const x0 = DOME_X + side * (inner ? R * 0.55 : R + 10), y0 = DOME_Y + 10;
          const x1 = x0 + side * (inner ? 8 : 22) * legs, y1 = y0 + 26 * legs;
          ctx.strokeStyle = SPRITE_OUTLINE;
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.strokeStyle = '#7a8aa8';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.fillRect(x1 - 10, y1 - 2, 20, 6);
          ctx.fillStyle = '#5a6a88';
          ctx.fillRect(x1 - 9, y1 - 1, 18, 4);
          ctx.lineCap = 'butt';
        }

    // The glass shell rises out of the base while unpacking
    if (glassK < 0.999) {
      ctx.save();
      ctx.translate(DOME_X, DOME_Y);
      ctx.scale(1, Math.max(0.001, glassK));
      ctx.translate(-DOME_X, -DOME_Y);
    }
    if (glassK > 0.01) {

    // Refraction: the sky behind the glass, slightly magnified and tinted
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, R - 1, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    const mag = 1.12;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(G.daylight > 0.5 ? sky.skyDay : sky.skyNight, DOME_X - R, DOME_Y - R, R * 2, R, DOME_X - R * mag, DOME_Y - R * mag - 6, R * 2 * mag, R * mag);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(20,60,120,0.25)';
    ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);

    // Console and keeper silhouette inside
    ctx.fillStyle = '#1c2a44';
    ctx.fillRect(DOME_X - 26, DOME_Y - 22, 52, 22);
    ctx.fillStyle = '#4af';
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.fillRect(DOME_X - 20, DOME_Y - 18, 14, 4);
    ctx.fillStyle = '#6f6';
    ctx.fillRect(DOME_X + 4, DOME_Y - 18, 6, 4);
    ctx.globalAlpha = 1;

    // Glass lattice and highlights
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.drawImage(art.glass, DOME_X - R - 4, DOME_Y - R - 4, R * 2 + 8, R + 8);
    ctx.globalAlpha = 1;

    // Shield shimmer: a bright band sweeping across the lattice
    const sweep = ((G.animTime * 0.35) % 1.6) - 0.3;
    const bx = DOME_X - R + sweep * R * 2;
    const sg = ctx.createLinearGradient(bx - 40, DOME_Y - R, bx + 40, DOME_Y);
    sg.addColorStop(0, 'rgba(160,230,255,0)');
    sg.addColorStop(0.5, `rgba(160,230,255,${0.12 + shieldLevel * 0.02})`);
    sg.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg;
    ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);
    ctx.globalCompositeOperation = 'source-over';

    // Damage cracks grow as HP drops
    const crackCount = Math.round((1 - hpRatio) * art.cracks.length);
    if (crackCount > 0) {
      ctx.lineJoin = 'round';
      for (let i = 0; i < crackCount; ++i) {
        const pts = art.cracks[i];
        ctx.beginPath();
        pts.forEach(([x, y], k) => k ? ctx.lineTo(DOME_X + x, DOME_Y + y + 1) : ctx.moveTo(DOME_X + x, DOME_Y + y + 1));
        ctx.strokeStyle = 'rgba(0,10,30,0.6)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        pts.forEach(([x, y], k) => k ? ctx.lineTo(DOME_X + x, DOME_Y + y) : ctx.moveTo(DOME_X + x, DOME_Y + y));
        ctx.strokeStyle = 'rgba(220,240,255,0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Hit flash overlay
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,80,80,${flashAlpha})`;
      ctx.fillRect(DOME_X - R, DOME_Y - R, R * 2, R);
    }
    ctx.restore();

    // Frame: meridian ribs and the outer rim (thicker with shield upgrades)
    ctx.save();
    ctx.strokeStyle = 'rgba(150,200,255,0.35)';
    ctx.lineWidth = 2;
    for (const k of [0.38, 0.72]) {
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y, R * k, R, 0, Math.PI, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(DOME_X, DOME_Y, R, R * 0.36, 0, Math.PI, 0);
    ctx.stroke();
    const rimW = 4 + shieldLevel * 1.5;
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, R, Math.PI, 0);
    ctx.lineWidth = rimW + 3;
    ctx.strokeStyle = '#0a1830';
    ctx.stroke();
    const rg = ctx.createLinearGradient(DOME_X - R, DOME_Y - R, DOME_X + R, DOME_Y);
    rg.addColorStop(0, '#9adcff');
    rg.addColorStop(0.5, '#3a8ae8');
    rg.addColorStop(1, '#1a4aa0');
    ctx.strokeStyle = rg;
    ctx.lineWidth = rimW;
    ctx.shadowColor = '#4af';
    ctx.shadowBlur = 14 + pulse * 8 + shieldLevel * 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    }
    if (glassK < 0.999) {
      ctx.restore();
      // Packed: an armoured lid closes over the base
      const lid = 1 - glassK;
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y - 4, R + 4, 26 * lid + 4, 0, Math.PI, 0);
      ctx.fill();
      const lg = ctx.createLinearGradient(0, DOME_Y - 30, 0, DOME_Y);
      lg.addColorStop(0, '#b8c8e0');
      lg.addColorStop(1, '#4a5878');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(DOME_X, DOME_Y - 4, R + 1, 26 * lid + 1, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,50,0.6)';
      ctx.lineWidth = 2;
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(DOME_X + k * R, DOME_Y - 4);
        ctx.lineTo(DOME_X + k * R * 0.8, DOME_Y - 4 - 24 * lid * Math.sqrt(1 - k * k));
        ctx.stroke();
      }
    }

    // Shield impact flashes
    for (const impact of (rig ? [] : G.shieldImpacts)) {
      const ia = impact.angle;
      const il = impact.life;
      ctx.save();
      ctx.beginPath();
      const arcSpan = 0.3 * il;
      ctx.arc(DOME_X, DOME_Y, R + 4, ia - arcSpan, ia + arcSpan);
      ctx.strokeStyle = `rgba(140,220,255,${il * 0.9})`;
      ctx.lineWidth = 8 * il;
      ctx.shadowBlur = 15 * il;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.restore();
      drawGlow('#6cf', DOME_X + Math.cos(ia) * (R + 4), DOME_Y + Math.sin(ia) * (R + 4), 40 * il, il * 0.8);
    }

    // Base ring the dome sits on
    const baseG = ctx.createLinearGradient(0, DOME_Y - 8, 0, DOME_Y + 14);
    baseG.addColorStop(0, '#8a9ab8');
    baseG.addColorStop(0.4, '#4a5878');
    baseG.addColorStop(1, '#1a2238');
    ctx.fillStyle = baseG;
    ctx.beginPath();
    ctx.moveTo(DOME_X - R - 14, DOME_Y - 6);
    ctx.lineTo(DOME_X + R + 14, DOME_Y - 6);
    ctx.lineTo(DOME_X + R + 24, DOME_Y + 14);
    ctx.lineTo(DOME_X - R - 24, DOME_Y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0a1020';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(DOME_X - R - 12, DOME_Y - 5, (R + 12) * 2, 1.5);
    for (let i = 0; i < 9; ++i) {
      const lx = DOME_X - R + 4 + i * (R * 2 - 8) / 8;
      const on = unpack > 0.78 + i * 0.022 && Math.sin(G.animTime * 3 - i * 0.7) > 0.3;
      ctx.fillStyle = on ? '#7fe0ff' : '#24405a';
      ctx.fillRect(lx - 3, DOME_Y + 3, 6, 4);
      if (on)
        drawGlow('#4cf', lx, DOME_Y + 5, 9, 0.6);
    }

    // Turret on the dome arc (slides out of the shell when unpacking)
    const turretK = smoothstep(0.6, 0.85, unpack);
    if (turretK <= 0.01) {
      ctx.restore();
      return;
    }
    const nozzleDrawR = R + 16 * turretK;
    const tbx = DOME_X + Math.cos(G.turretAngle) * nozzleDrawR;
    const tby = DOME_Y + Math.sin(G.turretAngle) * nozzleDrawR;
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(G.turretAngle);
    ctx.scale(turretK, turretK);
    // Mount
    ctx.fillStyle = '#1a2236';
    roundRectPath(-14, -11, 22, 22, 5);
    ctx.fill();
    const mg = ctx.createLinearGradient(0, -10, 0, 10);
    mg.addColorStop(0, '#b8cce8');
    mg.addColorStop(0.5, '#6a82a8');
    mg.addColorStop(1, '#2a3858');
    ctx.fillStyle = mg;
    roundRectPath(-12, -9, 18, 18, 4);
    ctx.fill();
    // Barrel
    const bg = ctx.createLinearGradient(0, -5, 0, 5);
    bg.addColorStop(0, '#d0dcf0');
    bg.addColorStop(0.45, '#7a8aa8');
    bg.addColorStop(1, '#2a3248');
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(2, -6, TURRET_BARREL_LENGTH, 12);
    ctx.fillStyle = bg;
    ctx.fillRect(3, -5, TURRET_BARREL_LENGTH - 2, 10);
    ctx.fillStyle = '#2a3450';
    for (let i = 0; i < 3; ++i)
      ctx.fillRect(12 + i * 7, -5, 2, 10);
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(TURRET_BARREL_LENGTH - 5, -6, 5, 12);
    ctx.restore();
    // Charge light: bright when ready to fire
    const ready = G.fireCooldown <= 0;
    const mx = tbx + Math.cos(G.turretAngle) * TURRET_BARREL_LENGTH;
    const my = tby + Math.sin(G.turretAngle) * TURRET_BARREL_LENGTH;
    if (turretK > 0.9)
      drawGlow('#ff6040', mx, my, ready ? 16 + pulse * 4 : 8, ready ? 0.8 : 0.35);
    ctx.fillStyle = '#d8e4ff';
    ctx.beginPath();
    ctx.arc(tbx, tby, 4, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  NS.domeArt = { drawDome };
})();
