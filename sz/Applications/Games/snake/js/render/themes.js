/* The theme decorations: the drifting Zen leaves and the Maze Runner brick dungeon,
   torch flame, ember trail and spinning coin. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { lerpPos } = NS.rules;

  /* ---- Zen Leaves ---- */
  function initZenLeaves() {
    S.zenLeaves = [];
    for (let i = 0; i < 18; ++i)
      S.zenLeaves.push({
        x: Math.random() * S.canvasW,
        y: Math.random() * S.canvasH,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.2 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        size: 4 + Math.random() * 5,
        colorIdx: Math.floor(Math.random() * C.ZEN_COLORS.leafColors.length),
        opacity: 0.3 + Math.random() * 0.4,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.001 + Math.random() * 0.002
      });
  }

  function updateZenLeaves(timestamp) {
    if (!S.zenLeaves) return;
    for (const leaf of S.zenLeaves) {
      leaf.x += leaf.vx + Math.sin(timestamp * leaf.wobbleSpeed + leaf.wobblePhase) * 0.3;
      leaf.y += leaf.vy;
      leaf.rotation += leaf.rotSpeed;

      if (leaf.y > S.canvasH + 10) {
        leaf.y = -10;
        leaf.x = Math.random() * S.canvasW;
      }
      if (leaf.x < -10) leaf.x = S.canvasW + 10;
      else if (leaf.x > S.canvasW + 10) leaf.x = -10;
    }
  }

  function drawZenLeaves() {
    if (!S.zenLeaves) return;
    for (const leaf of S.zenLeaves) {
      D.ctx.save();
      D.ctx.translate(leaf.x, leaf.y);
      D.ctx.rotate(leaf.rotation);
      D.ctx.globalAlpha = leaf.opacity;

      const color = C.ZEN_COLORS.leafColors[leaf.colorIdx];
      D.ctx.fillStyle = color;
      D.ctx.beginPath();
      D.ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, Math.PI * 2);
      D.ctx.fill();

      D.ctx.strokeStyle = color;
      D.ctx.globalAlpha = leaf.opacity * 0.5;
      D.ctx.lineWidth = 0.5;
      D.ctx.beginPath();
      D.ctx.moveTo(-leaf.size, 0);
      D.ctx.lineTo(leaf.size, 0);
      D.ctx.stroke();

      D.ctx.strokeStyle = color;
      D.ctx.lineWidth = 0.8;
      D.ctx.globalAlpha = leaf.opacity * 0.7;
      D.ctx.beginPath();
      D.ctx.moveTo(0, 0);
      D.ctx.lineTo(leaf.size + 2, -1.5);
      D.ctx.stroke();

      D.ctx.restore();
    }
    D.ctx.globalAlpha = 1;
  }

  /* ---- Maze Brick ---- */
  function buildMazeBrickCanvas() {
    S.mazeBrickCanvas = document.createElement('canvas');
    S.mazeBrickCanvas.width = S.canvasW;
    S.mazeBrickCanvas.height = S.canvasH;
    const mc = S.mazeBrickCanvas.getContext('2d');

    mc.fillStyle = C.MAZE_COLORS.mortar;
    mc.fillRect(0, 0, S.canvasW, S.canvasH);

    const brickW = C.CELL;
    const brickH = C.CELL / 2;
    const mortarSize = 1;

    for (let row = 0; row * brickH < S.canvasH; ++row) {
      const offsetX = (row % 2 === 1) ? brickW / 2 : 0;
      for (let col = -1; col * brickW < S.canvasW + brickW; ++col) {
        const bx = col * brickW + offsetX;
        const by = row * brickH;
        const seed = (row * 137 + col * 59) & 0xff;
        const shade = (seed % 30) - 15;
        const r = Math.max(0, Math.min(255, parseInt(C.MAZE_COLORS.brick.slice(1, 3), 16) + shade));
        const g = Math.max(0, Math.min(255, parseInt(C.MAZE_COLORS.brick.slice(3, 5), 16) + shade));
        const b = Math.max(0, Math.min(255, parseInt(C.MAZE_COLORS.brick.slice(5, 7), 16) + shade));
        mc.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        mc.fillRect(bx + mortarSize, by + mortarSize, brickW - mortarSize * 2, brickH - mortarSize * 2);

        mc.fillStyle = 'rgba(255,255,255,0.06)';
        mc.fillRect(bx + mortarSize, by + mortarSize, brickW - mortarSize * 2, 1);
        mc.fillRect(bx + mortarSize, by + mortarSize, 1, brickH - mortarSize * 2);

        mc.fillStyle = 'rgba(0,0,0,0.1)';
        mc.fillRect(bx + mortarSize, by + brickH - mortarSize - 1, brickW - mortarSize * 2, 1);
        mc.fillRect(bx + brickW - mortarSize - 1, by + mortarSize, 1, brickH - mortarSize * 2);
      }
    }
  }

  function drawMazeBrickBackground() {
    if (S.mazeBrickCanvas)
      D.ctx.drawImage(S.mazeBrickCanvas, 0, 0);
  }

  function drawMazeBrickObstacles() {
    if (S.obstacles.size === 0) return;
    for (const key of S.obstacles) {
      const parts = key.split(',');
      const x = +parts[0], y = +parts[1];
      const px = x * C.CELL, py = y * C.CELL;

      D.ctx.fillStyle = C.MAZE_COLORS.darkBrick;
      D.ctx.fillRect(px, py, C.CELL, C.CELL);

      D.ctx.fillStyle = 'rgba(255,255,255,0.08)';
      D.ctx.fillRect(px, py, C.CELL, 1);
      D.ctx.fillRect(px, py, 1, C.CELL);

      D.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      D.ctx.fillRect(px, py + C.CELL - 1, C.CELL, 1);
      D.ctx.fillRect(px + C.CELL - 1, py, 1, C.CELL);

      D.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      D.ctx.lineWidth = 0.5;
      D.ctx.strokeRect(px + 2, py + 2, C.CELL - 4, C.CELL - 4);
    }
  }

  function drawTorchFlame(cx, cy, dir, timestamp) {
    D.ctx.save();
    const t = timestamp * 0.006;
    for (let i = 0; i < C.MAZE_COLORS.flame.length; ++i) {
      const phase = t + i * 1.3;
      const scaleX = (0.6 - i * 0.1) + Math.sin(phase) * 0.15;
      const scaleY = (0.8 - i * 0.12) + Math.cos(phase * 1.3) * 0.12;
      const rx = (C.CELL / 2 - 1) * scaleX;
      const ry = (C.CELL / 2 - 1) * scaleY;
      const offsetX = Math.sin(phase * 0.7) * 1.5;
      const offsetY = Math.cos(phase * 0.9) * 1.5;
      D.ctx.fillStyle = C.MAZE_COLORS.flame[i];
      D.ctx.globalAlpha = 0.8 - i * 0.15;
      D.ctx.beginPath();
      D.ctx.ellipse(cx + offsetX, cy + offsetY, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      D.ctx.fill();
    }

    D.ctx.globalAlpha = 0.3;
    D.ctx.fillStyle = '#fff8e1';
    const coreR = 2 + Math.sin(t * 1.7) * 0.5;
    D.ctx.beginPath();
    D.ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.restore();
  }

  function drawEmberTrail(body, prevBody, t, timestamp) {
    if (body.length === 0) return;
    for (let i = body.length - 1; i >= 1; --i) {
      const prev = prevBody && i < prevBody.length ? prevBody[i] : null;
      const { x: cx, y: cy } = lerpPos(body[i], prev, t);
      const frac = i / body.length;
      const emberIdx = Math.min(Math.floor(frac * C.MAZE_COLORS.ember.length), C.MAZE_COLORS.ember.length - 1);
      const color = C.MAZE_COLORS.ember[emberIdx];
      const radius = C.CELL / 2 - 2 - frac * 2;

      D.ctx.globalAlpha = 1 - frac * 0.5;
      D.ctx.fillStyle = color;
      D.ctx.beginPath();
      D.ctx.arc(cx, cy, Math.max(radius, 2), 0, Math.PI * 2);
      D.ctx.fill();

      if (i <= 3) {
        D.ctx.globalAlpha = (0.3 - i * 0.08);
        D.ctx.fillStyle = '#ff9100';
        D.ctx.beginPath();
        D.ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
        D.ctx.fill();
      }
    }
    D.ctx.globalAlpha = 1;
  }

  function drawCoin(cx, cy, timestamp) {
    const t = timestamp * 0.003;
    const scaleX = Math.abs(Math.cos(t));
    const pulse = Math.sin(t * 2) * 0.1 + 0.9;
    const r = (C.CELL / 2 - 2) * pulse;

    D.ctx.save();
    D.ctx.fillStyle = C.MAZE_COLORS.coin;
    D.ctx.beginPath();
    D.ctx.ellipse(cx, cy, Math.max(r * scaleX, 1), r, 0, 0, Math.PI * 2);
    D.ctx.fill();

    if (scaleX > 0.3) {
      D.ctx.strokeStyle = 'rgba(184,134,11,0.6)';
      D.ctx.lineWidth = 1;
      D.ctx.beginPath();
      D.ctx.ellipse(cx, cy, Math.max((r - 2) * scaleX, 0.5), r - 2, 0, 0, Math.PI * 2);
      D.ctx.stroke();

      if (scaleX > 0.5) {
        D.ctx.fillStyle = 'rgba(184,134,11,0.8)';
        D.ctx.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif';
        D.ctx.textAlign = 'center';
        D.ctx.textBaseline = 'middle';
        D.ctx.fillText('$', cx, cy + 1);
      }
    }

    const glintAngle = t * 1.5;
    const glintX = cx + Math.cos(glintAngle) * r * 0.4 * scaleX;
    const glintY = cy + Math.sin(glintAngle) * r * 0.4;
    D.ctx.fillStyle = C.MAZE_COLORS.coinHighlight;
    D.ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3;
    D.ctx.beginPath();
    D.ctx.arc(glintX, glintY, 1.5, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.restore();
  }

  Object.assign(NS.themes, { initZenLeaves, updateZenLeaves, drawZenLeaves, buildMazeBrickCanvas,
    drawMazeBrickBackground, drawMazeBrickObstacles, drawTorchFlame, drawEmberTrail, drawCoin });
})();
