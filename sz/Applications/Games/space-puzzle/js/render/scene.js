/* The level's scene pieces: gravity wells with their ripple rings, spirals and
   orbiting debris, irregular rotating asteroids, the pulsing repair goal, the
   probe's glow trail, the ship itself and the aim indicator while dragging. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  /* Gravity wells — distortion ripple effect with glow, spirals, and orbital debris */
  function drawWells() {
    const ctx = D.ctx;
    const now = Date.now() / 1000;
    for (const well of S.wells) {
      const wellRadius = Math.sqrt(well.mass) * C.WELL_VISUAL_SCALE;
      const wellRotation = Date.now() / 2000;

      // Gravitational lensing hint — faint dashed circle at full influence radius
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#8866ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(well.x, well.y, wellRadius * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Gravity well distortion rings
      for (let r = 3; r >= 1; --r) {
        const rr = wellRadius * r * 0.8 + Math.sin(now * 3 + r) * 3;
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.05 * r;
        ctx.strokeStyle = '#6644cc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(well.x, well.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Animated spiral inside well radius
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#9977ee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s < 60; ++s) {
        const t = s / 60;
        const spiralAngle = wellRotation + t * Math.PI * 4;
        const spiralR = t * wellRadius * 0.9;
        const sx = well.x + Math.cos(spiralAngle) * spiralR;
        const sy = well.y + Math.sin(spiralAngle) * spiralR;
        if (s === 0)
          ctx.moveTo(sx, sy);
        else
          ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      // Orbital debris — 3 small dots orbiting at different speeds/radii
      ctx.save();
      for (let d = 0; d < 3; ++d) {
        const orbitSpeed = 1500 + d * 700;
        const orbitRadius = wellRadius * (0.4 + d * 0.25);
        const orbitAngle = Date.now() / orbitSpeed + d * 2.1;
        const dx = well.x + Math.cos(orbitAngle) * orbitRadius;
        const dy = well.y + Math.sin(orbitAngle) * orbitRadius;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#aa88ff';
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Well core glow — stronger event horizon gradient
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#8866ff';
      const grad = ctx.createRadialGradient(well.x, well.y, 1, well.x, well.y, wellRadius * 0.6);
      grad.addColorStop(0, 'rgba(180,140,255,0.95)');
      grad.addColorStop(0.2, 'rgba(136,102,255,0.7)');
      grad.addColorStop(0.5, 'rgba(100,60,200,0.3)');
      grad.addColorStop(1, 'rgba(68,34,136,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(well.x, well.y, wellRadius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // Well center dot
      ctx.fillStyle = '#ddbbff';
      ctx.beginPath();
      ctx.arc(well.x, well.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* Asteroids — irregular polygon with rotation, shadow, texture, and craters */
  function drawAsteroids() {
    const ctx = D.ctx;
    for (const ast of S.asteroids) {
      ctx.save();
      const astSeed = ast.x * 7 + ast.y * 13;
      const astRotation = Date.now() / 3000 + astSeed * 0.1;
      const vertexCount = 8;

      // Build irregular polygon vertices
      const vertices = [];
      for (let vi = 0; vi < vertexCount; ++vi) {
        const jitter = ((astSeed + vi * 31) % 17) / 17 * 0.4;
        const vr = ast.r * (0.8 + jitter);
        const va = (vi / vertexCount) * Math.PI * 2;
        vertices.push({ x: Math.cos(va) * vr, y: Math.sin(va) * vr });
      }

      ctx.translate(ast.x, ast.y);
      ctx.rotate(astRotation);

      // Shadow — darker half to suggest lighting direction
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let vi = 1; vi < vertexCount; ++vi)
        ctx.lineTo(vertices[vi].x, vertices[vi].y);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, -ast.r * 1.5, ast.r * 1.5, ast.r * 3);
      ctx.restore();

      // Main asteroid body — irregular polygon
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#886644';
      ctx.fillStyle = '#665544';
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let vi = 1; vi < vertexCount; ++vi)
        ctx.lineTo(vertices[vi].x, vertices[vi].y);
      ctx.closePath();
      ctx.fill();

      // Surface texture — noise-like dots with slightly different shade
      ctx.shadowBlur = 0;
      const textureDots = [
        { ox: -0.15, oy: 0.25, sr: 0.08, color: '#776655' },
        { ox: 0.3, oy: -0.15, sr: 0.06, color: '#554433' },
        { ox: -0.25, oy: -0.3, sr: 0.07, color: '#7a6b5a' },
        { ox: 0.1, oy: 0.35, sr: 0.05, color: '#605040' }
      ];
      for (const td of textureDots) {
        ctx.fillStyle = td.color;
        ctx.beginPath();
        ctx.arc(td.ox * ast.r, td.oy * ast.r, ast.r * td.sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crater details (kept from original, adjusted for rotated context)
      ctx.fillStyle = '#554433';
      ctx.beginPath();
      ctx.arc(-ast.r * 0.3, -ast.r * 0.2, ast.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ast.r * 0.2, ast.r * 0.3, ast.r * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /* Goal zone — pulsing target with rotating ring, beacon pulse, and inner glow */
  function drawGoal() {
    const ctx = D.ctx;
    const now = Date.now() / 1000;
    ctx.save();
    const goalPulse = 0.5 + 0.5 * Math.sin(now * 4);
    const goalGlowIntensity = 0.3 + 0.2 * Math.sin(Date.now() / 800);

    // Inner glow gradient — pulses in intensity
    const goalGrad = ctx.createRadialGradient(S.goal.x, S.goal.y, 0, S.goal.x, S.goal.y, C.GOAL_RADIUS);
    goalGrad.addColorStop(0, `rgba(0, 255, 136, ${goalGlowIntensity})`);
    goalGrad.addColorStop(0.6, `rgba(0, 200, 100, ${goalGlowIntensity * 0.4})`);
    goalGrad.addColorStop(1, 'rgba(0, 150, 80, 0)');
    ctx.fillStyle = goalGrad;
    ctx.beginPath();
    ctx.arc(S.goal.x, S.goal.y, C.GOAL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Beacon pulse — expanding circle that fades every 2 seconds
    const beaconPhase = (Date.now() % 2000) / 2000;
    const beaconRadius = C.GOAL_RADIUS + beaconPhase * C.GOAL_RADIUS * 1.5;
    const beaconAlpha = (1 - beaconPhase) * 0.5;
    ctx.globalAlpha = beaconAlpha;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(S.goal.x, S.goal.y, beaconRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Rotating outer ring — dashed pattern that slowly rotates
    ctx.save();
    ctx.translate(S.goal.x, S.goal.y);
    ctx.rotate(Date.now() / 2000);
    ctx.shadowBlur = 10 + goalPulse * 8;
    ctx.shadowColor = '#00ff88';
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + goalPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, C.GOAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Inner ring (static)
    ctx.shadowBlur = 10 + goalPulse * 8;
    ctx.shadowColor = '#00ff88';
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + goalPulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S.goal.x, S.goal.y, C.GOAL_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Goal label — spacecraft repair objective target
    ctx.fillStyle = '#00ff88';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REPAIR', S.goal.x, S.goal.y + C.GOAL_RADIUS + 14);
    ctx.textAlign = 'start';
    ctx.restore();
  }

  /* Trail — object glow trail with engine glow dots */
  function drawTrail() {
    const ctx = D.ctx;
    if (S.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < S.trail.length; ++i) {
        const alpha = (i / S.trail.length) * 0.6;
        ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.lineWidth = 2 + (i / S.trail.length) * 2;
        ctx.beginPath();
        ctx.moveTo(S.trail[i - 1].x, S.trail[i - 1].y);
        ctx.lineTo(S.trail[i].x, S.trail[i].y);
        ctx.stroke();
      }
      // Engine trail glowing dots — 6 dots at evenly spaced trail positions
      const dotCount = 6;
      for (let d = 0; d < dotCount; ++d) {
        const idx = Math.floor((d / dotCount) * S.trail.length);
        if (idx >= S.trail.length) continue;
        const t = S.trail[idx];
        const dotAlpha = (1 - d / dotCount) * 0.7;
        const dotRadius = (1 - d / dotCount) * 3 + 1;
        ctx.globalAlpha = dotAlpha;
        ctx.fillStyle = '#88ddff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /* Launched object — ship/arrow shape facing velocity direction */
  function drawShip() {
    const ctx = D.ctx;
    if (S.obj.active || S.state === C.STATE_LAUNCHED) {
      ctx.save();
      const shipAngle = Math.atan2(S.obj.vy, S.obj.vx);
      ctx.translate(S.obj.x, S.obj.y);
      ctx.rotate(shipAngle);
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#44aaff';
      // Ship body — arrowhead triangle
      ctx.fillStyle = '#66ccff';
      ctx.beginPath();
      ctx.moveTo(C.OBJECT_RADIUS, 0);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.7, -C.OBJECT_RADIUS * 0.6);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.3, 0);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.7, C.OBJECT_RADIUS * 0.6);
      ctx.closePath();
      ctx.fill();
      // Ship cockpit highlight
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(C.OBJECT_RADIUS * 0.3, 0, C.OBJECT_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Engine glow at the back
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff8844';
      ctx.fillStyle = 'rgba(255,150,50,0.7)';
      ctx.beginPath();
      ctx.arc(-C.OBJECT_RADIUS * 0.5, 0, C.OBJECT_RADIUS * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (S.state === C.STATE_PLAYING || S.state === C.STATE_AIMING) {
      // Probe at start position — ship shape pointing upward
      ctx.save();
      ctx.translate(S.startPos.x, S.startPos.y);
      ctx.rotate(-Math.PI / 2); // point upward
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#44aaff';
      // Ship body — arrowhead triangle
      ctx.fillStyle = '#66ccff';
      ctx.beginPath();
      ctx.moveTo(C.OBJECT_RADIUS, 0);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.7, -C.OBJECT_RADIUS * 0.6);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.3, 0);
      ctx.lineTo(-C.OBJECT_RADIUS * 0.7, C.OBJECT_RADIUS * 0.6);
      ctx.closePath();
      ctx.fill();
      // Ship cockpit highlight
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(C.OBJECT_RADIUS * 0.3, 0, C.OBJECT_RADIUS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* Aim direction indicator — arrow line while isDragging */
  function drawAim() {
    const ctx = D.ctx;
    if (S.isDragging && (S.state === C.STATE_PLAYING || S.state === C.STATE_AIMING)) {
      const launchDx = S.dragStartX - S.dragEndX;
      const launchDy = S.dragStartY - S.dragEndY;
      const launchDist = Math.sqrt(launchDx * launchDx + launchDy * launchDy);
      if (launchDist > 5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(S.startPos.x, S.startPos.y);
        const arrowLen = Math.min(launchDist * C.LAUNCH_SPEED_SCALE * 0.3, 120);
        const nx = launchDx / launchDist;
        const ny = launchDy / launchDist;
        ctx.lineTo(S.startPos.x + nx * arrowLen, S.startPos.y + ny * arrowLen);
        ctx.stroke();
        // Arrow head
        ctx.setLineDash([]);
        const headX = S.startPos.x + nx * arrowLen;
        const headY = S.startPos.y + ny * arrowLen;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - nx * 8 - ny * 5, headY - ny * 8 + nx * 5);
        ctx.lineTo(headX - nx * 8 + ny * 5, headY - ny * 8 - nx * 5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.fill();
        ctx.restore();
      }
    }
  }

  Object.assign(NS.scene, { drawWells, drawAsteroids, drawGoal, drawTrail, drawShip, drawAim });
})();
