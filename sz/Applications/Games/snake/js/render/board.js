/* The board renderer and the status bar: background grid, obstacles, food, field
   power-up, the overlay screens and the per-frame composition of everything. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { screenShake, particles, floatingText } = NS.effects;
  const { isTron, isZen, isMaze } = NS.rules;
  const { drawMazeBrickBackground, drawZenLeaves, drawMazeBrickObstacles, drawCoin } = NS.themes;
  const { drawSnake, drawAISnakes } = NS.snakeview;

  function updateDisplays() {
    D.statusScore.textContent = 'Score: ' + S.score;
    D.statusLength.textContent = 'Length: ' + S.snake.length;
    D.statusLevel.textContent = 'Level: ' + S.level;
  }

  function updateEffectDisplay() {
    if (!D.statusEffects)
      return;
    if (!S.activePowerups || S.activePowerups.length === 0) {
      D.statusEffects.style.display = 'none';
      return;
    }
    const now = performance.now();
    const parts = S.activePowerups.map(p => {
      if (p.expireTime === Infinity)
        return p.type.name;
      const remaining = Math.max(0, Math.ceil((p.expireTime - now) / 1000));
      return p.type.name + ' ' + remaining + 's';
    });
    D.statusEffects.textContent = parts.join(' | ');
    D.statusEffects.style.display = '';
  }

  /* ---- Drawing ---- */
  function drawGrid() {
    if (isMaze()) {
      drawMazeBrickBackground();
      return;
    }

    const tron = isTron();
    const zen = isZen();

    if (tron) {
      D.ctx.save();
      D.ctx.strokeStyle = 'rgba(0,100,255,0.08)';
      D.ctx.lineWidth = 0.5;
      D.ctx.shadowColor = 'rgba(0,100,255,0.4)';
      D.ctx.shadowBlur = 2;
      for (let x = 0; x <= S.cols; ++x) {
        if (x % 5 === 0) continue;
        D.ctx.beginPath();
        D.ctx.moveTo(x * C.CELL, 0);
        D.ctx.lineTo(x * C.CELL, S.canvasH);
        D.ctx.stroke();
      }
      for (let y = 0; y <= S.rows; ++y) {
        if (y % 5 === 0) continue;
        D.ctx.beginPath();
        D.ctx.moveTo(0, y * C.CELL);
        D.ctx.lineTo(S.canvasW, y * C.CELL);
        D.ctx.stroke();
      }

      D.ctx.strokeStyle = 'rgba(0,120,255,0.2)';
      D.ctx.lineWidth = 1;
      D.ctx.shadowColor = 'rgba(0,120,255,0.6)';
      D.ctx.shadowBlur = 6;
      for (let x = 0; x <= S.cols; x += 5) {
        D.ctx.beginPath();
        D.ctx.moveTo(x * C.CELL, 0);
        D.ctx.lineTo(x * C.CELL, S.canvasH);
        D.ctx.stroke();
      }
      for (let y = 0; y <= S.rows; y += 5) {
        D.ctx.beginPath();
        D.ctx.moveTo(0, y * C.CELL);
        D.ctx.lineTo(S.canvasW, y * C.CELL);
        D.ctx.stroke();
      }

      D.ctx.strokeStyle = 'rgba(0,140,255,0.3)';
      D.ctx.lineWidth = 1.5;
      D.ctx.shadowColor = 'rgba(0,140,255,0.7)';
      D.ctx.shadowBlur = 8;
      D.ctx.strokeRect(0.5, 0.5, S.canvasW - 1, S.canvasH - 1);
      D.ctx.restore();
      return;
    }

    const gridColor = zen ? C.ZEN_COLORS.grid : 'rgba(255,255,255,0.08)';
    D.ctx.strokeStyle = gridColor;
    D.ctx.lineWidth = 0.5;
    for (let x = 0; x <= S.cols; ++x) {
      D.ctx.beginPath();
      D.ctx.moveTo(x * C.CELL, 0);
      D.ctx.lineTo(x * C.CELL, S.canvasH);
      D.ctx.stroke();
    }
    for (let y = 0; y <= S.rows; ++y) {
      D.ctx.beginPath();
      D.ctx.moveTo(0, y * C.CELL);
      D.ctx.lineTo(S.canvasW, y * C.CELL);
      D.ctx.stroke();
    }

    D.ctx.strokeStyle = zen ? 'rgba(34,139,34,0.15)' : 'rgba(255,255,255,0.15)';
    D.ctx.lineWidth = 1;
    D.ctx.strokeRect(0.5, 0.5, S.canvasW - 1, S.canvasH - 1);
  }

  function drawFood(timestamp) {
    if (!S.food)
      return;
    const cx = S.food.x * C.CELL + C.CELL / 2;
    const cy = S.food.y * C.CELL + C.CELL / 2;
    const pulse = Math.sin(timestamp * 0.004) * 0.3 + 0.7;

    if (isTron()) {
      const half = C.CELL / 2 - 2;
      D.ctx.save();
      D.ctx.shadowColor = '#00e5ff';
      D.ctx.shadowBlur = 10 + pulse * 8;
      D.ctx.strokeStyle = '#00e5ff';
      D.ctx.lineWidth = 2;
      D.ctx.globalAlpha = 0.5 + pulse * 0.5;
      D.ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      D.ctx.globalAlpha = 0.15 + pulse * 0.15;
      D.ctx.fillStyle = '#00e5ff';
      D.ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      D.ctx.restore();
      return;
    }

    if (isMaze()) {
      drawCoin(cx, cy, timestamp);
      return;
    }

    SZ.GameEffects.drawGlow(D.ctx, function(c) {
      c.fillStyle = 'rgba(244, 67, 54, 0.6)';
      c.beginPath();
      c.arc(cx, cy, C.CELL / 2 + 2 + pulse * 3, 0, Math.PI * 2);
      c.fill();
    }, '#f44336', 10 + pulse * 5);

    D.ctx.fillStyle = '#e53935';
    D.ctx.beginPath();
    D.ctx.arc(cx, cy, C.CELL / 2 - 2, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    D.ctx.beginPath();
    D.ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.strokeStyle = '#5d4037';
    D.ctx.lineWidth = 1.5;
    D.ctx.beginPath();
    D.ctx.moveTo(cx, cy - C.CELL / 2 + 3);
    D.ctx.lineTo(cx + 2, cy - C.CELL / 2 - 1);
    D.ctx.stroke();

    D.ctx.fillStyle = '#4caf50';
    D.ctx.beginPath();
    D.ctx.ellipse(cx + 3, cy - C.CELL / 2, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
    D.ctx.fill();
  }

  function drawObstacles() {
    if (S.obstacles.size === 0)
      return;

    if (isMaze()) {
      drawMazeBrickObstacles();
      return;
    }

    for (const key of S.obstacles) {
      const parts = key.split(',');
      const x = +parts[0], y = +parts[1];
      const px = x * C.CELL, py = y * C.CELL;

      D.ctx.fillStyle = '#444';
      D.ctx.fillRect(px + 1, py + 1, C.CELL - 2, C.CELL - 2);

      D.ctx.strokeStyle = '#333';
      D.ctx.lineWidth = 1;
      D.ctx.strokeRect(px + 2, py + 2, C.CELL - 4, C.CELL - 4);

      D.ctx.fillStyle = 'rgba(255,255,255,0.08)';
      D.ctx.fillRect(px + 1, py + 1, C.CELL - 2, 1);
      D.ctx.fillRect(px + 1, py + 1, 1, C.CELL - 2);
    }
  }

  function drawPowerups(timestamp) {
    if (!S.fieldPowerup || !S.gameConfig.powerups)
      return;

    const age = timestamp - S.fieldPowerup.spawnTime;
    if (age >= C.POWERUP_BLINK_START && Math.floor(timestamp / 200) % 2 === 0)
      return;

    const cx = S.fieldPowerup.x * C.CELL + C.CELL / 2;
    const cy = S.fieldPowerup.y * C.CELL + C.CELL / 2;
    const type = S.fieldPowerup.type;
    const pulse = Math.sin(timestamp * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(D.ctx, function(c) {
      c.fillStyle = type.color;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.arc(cx, cy, C.CELL / 2 + 2 + pulse * 2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }, type.color, 8 + pulse * 4);

    D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    D.ctx.beginPath();
    D.ctx.arc(cx, cy, C.CELL / 2 - 1, 0, Math.PI * 2);
    D.ctx.fill();

    drawPowerupIcon(cx, cy, type, C.CELL / 2 - 3);
  }

  function drawPowerupIcon(cx, cy, type, size) {
    D.ctx.fillStyle = type.color;
    D.ctx.strokeStyle = type.color;
    D.ctx.lineWidth = 1.5;

    switch (type.icon) {
      case 'lightning':
        D.ctx.beginPath();
        D.ctx.moveTo(cx + 1, cy - size);
        D.ctx.lineTo(cx - 3, cy);
        D.ctx.lineTo(cx + 1, cy);
        D.ctx.lineTo(cx - 1, cy + size);
        D.ctx.lineTo(cx + 3, cy);
        D.ctx.lineTo(cx - 1, cy);
        D.ctx.closePath();
        D.ctx.fill();
        break;
      case 'clock':
        D.ctx.beginPath();
        D.ctx.arc(cx, cy, size - 1, 0, Math.PI * 2);
        D.ctx.stroke();
        D.ctx.beginPath();
        D.ctx.moveTo(cx, cy);
        D.ctx.lineTo(cx, cy - size + 3);
        D.ctx.stroke();
        D.ctx.beginPath();
        D.ctx.moveTo(cx, cy);
        D.ctx.lineTo(cx + size - 4, cy);
        D.ctx.stroke();
        break;
      case 'star': {
        const spikes = 5, outer = size, inner = size * 0.4;
        D.ctx.beginPath();
        for (let i = 0; i < spikes * 2; ++i) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (i * Math.PI / spikes) - Math.PI / 2;
          if (i === 0)
            D.ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
          else
            D.ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        D.ctx.closePath();
        D.ctx.fill();
        break;
      }
      case 'minus':
        D.ctx.lineWidth = 3;
        D.ctx.beginPath();
        D.ctx.moveTo(cx - size + 2, cy);
        D.ctx.lineTo(cx + size - 2, cy);
        D.ctx.stroke();
        D.ctx.lineWidth = 1.5;
        break;
      case 'diamond':
        D.ctx.beginPath();
        D.ctx.moveTo(cx, cy - size);
        D.ctx.lineTo(cx + size, cy);
        D.ctx.lineTo(cx, cy + size);
        D.ctx.lineTo(cx - size, cy);
        D.ctx.closePath();
        D.ctx.fill();
        break;
      case 'circle':
        D.ctx.lineWidth = 2;
        D.ctx.beginPath();
        D.ctx.arc(cx, cy, size - 1, 0, Math.PI * 2);
        D.ctx.stroke();
        D.ctx.lineWidth = 1.5;
        break;
    }
  }

  function drawOverlay(text, subtext) {
    const tron = isTron();
    const zen = isZen();
    const maze = isMaze();

    if (maze)
      D.ctx.fillStyle = 'rgba(26,18,8,0.85)';
    else if (tron)
      D.ctx.fillStyle = 'rgba(2,2,8,0.8)';
    else if (zen)
      D.ctx.fillStyle = 'rgba(10,26,10,0.8)';
    else
      D.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    D.ctx.fillRect(0, 0, S.canvasW, S.canvasH);

    if (maze)
      D.ctx.fillStyle = C.MAZE_COLORS.coin;
    else if (tron)
      D.ctx.fillStyle = '#00e5ff';
    else if (zen)
      D.ctx.fillStyle = '#81c784';
    else
      D.ctx.fillStyle = '#fff';

    D.ctx.font = 'bold 24px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';

    if (tron) {
      D.ctx.shadowColor = '#00e5ff';
      D.ctx.shadowBlur = 20;
    } else if (maze) {
      D.ctx.shadowColor = C.MAZE_COLORS.coin;
      D.ctx.shadowBlur = 15;
    }

    D.ctx.fillText(text, S.canvasW / 2, S.canvasH / 2 - 12);

    if (subtext) {
      if (maze)
        D.ctx.fillStyle = '#8d6e4f';
      else if (tron)
        D.ctx.fillStyle = '#0097a7';
      else if (zen)
        D.ctx.fillStyle = '#4caf50';
      else
        D.ctx.fillStyle = '#ccc';
      D.ctx.font = '12px sans-serif';
      D.ctx.fillText(subtext, S.canvasW / 2, S.canvasH / 2 + 16);
    }

    D.ctx.shadowBlur = 0;
  }

  function render(timestamp) {
    D.ctx.save();
    if (isTron())
      D.ctx.fillStyle = C.TRON_COLORS.bg;
    else if (isZen())
      D.ctx.fillStyle = C.ZEN_COLORS.bg;
    else if (isMaze())
      D.ctx.fillStyle = C.MAZE_COLORS.bg;
    else
      D.ctx.fillStyle = '#111';
    D.ctx.fillRect(0, 0, S.canvasW, S.canvasH);

    screenShake.apply(D.ctx);
    drawZenLeaves();
    drawGrid();
    drawObstacles();
    drawFood(timestamp || 0);
    drawPowerups(timestamp || 0);
    drawAISnakes(timestamp);
    drawSnake(timestamp);

    particles.draw(D.ctx);
    floatingText.draw(D.ctx);
    screenShake.restore(D.ctx);
    D.ctx.restore();

    const overlayTitle = isTron() ? 'TRON' : isMaze() ? 'DUNGEON' : isZen() ? 'ZEN' : 'SNAKE';
    if (S.waitingToStart)
      drawOverlay(overlayTitle, 'Tap or press Space for New Game');
    else if (S.gamePaused)
      drawOverlay('PAUSED', 'Press P to resume');
    else if (S.gameOverFlag)
      drawOverlay('GAME OVER', 'Score: ' + S.score + '  --  Tap or press Space for New Game');
  }

  Object.assign(NS.board, { updateDisplays, updateEffectDisplay, drawGrid, drawFood, drawObstacles,
    drawPowerups, drawPowerupIcon, drawOverlay, render });
})();
