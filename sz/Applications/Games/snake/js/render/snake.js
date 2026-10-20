/* Drawing the snakes: the interpolated round-segment body with eyes, the Tron light
   cycle and rider head, and the theme-specific player trail variants. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { lerpPos, isBlinking, dirAngle, isTron, isMaze, hasActiveEffect } = NS.rules;
  const { drawEmberTrail, drawTorchFlame } = NS.themes;

  function drawSnakeBody(body, prevBody, dir, headColor, bodyColor, t, ghostAlpha, timestamp) {
    if (body.length === 0)
      return;

    const blinking = isBlinking(timestamp || 0);

    for (let i = body.length - 1; i >= 0; --i) {
      const prev = prevBody && i < prevBody.length ? prevBody[i] : null;
      const { x: cx, y: cy } = lerpPos(body[i], prev, t);
      const frac = i / body.length;

      if (i === 0) {
        if (ghostAlpha < 1)
          D.ctx.globalAlpha = ghostAlpha;
        D.ctx.fillStyle = headColor;
        D.ctx.beginPath();
        D.ctx.arc(cx, cy, C.CELL / 2 - 1, 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.globalAlpha = 1;

        const dx = dir.x, dy = dir.y;
        const perpX = -dy, perpY = dx;

        if (blinking) {
          D.ctx.strokeStyle = '#fff';
          D.ctx.lineWidth = 1.5;
          const eyeR = 2.5;
          D.ctx.beginPath();
          D.ctx.moveTo(cx + dx * 3 + perpX * 3 - eyeR, cy + dy * 3 + perpY * 3);
          D.ctx.lineTo(cx + dx * 3 + perpX * 3 + eyeR, cy + dy * 3 + perpY * 3);
          D.ctx.stroke();
          D.ctx.beginPath();
          D.ctx.moveTo(cx + dx * 3 - perpX * 3 - eyeR, cy + dy * 3 - perpY * 3);
          D.ctx.lineTo(cx + dx * 3 - perpX * 3 + eyeR, cy + dy * 3 - perpY * 3);
          D.ctx.stroke();
        } else {
          D.ctx.fillStyle = '#fff';
          D.ctx.beginPath();
          D.ctx.arc(cx + dx * 3 + perpX * 3, cy + dy * 3 + perpY * 3, 2.5, 0, Math.PI * 2);
          D.ctx.fill();
          D.ctx.beginPath();
          D.ctx.arc(cx + dx * 3 - perpX * 3, cy + dy * 3 - perpY * 3, 2.5, 0, Math.PI * 2);
          D.ctx.fill();

          D.ctx.fillStyle = '#000';
          D.ctx.beginPath();
          D.ctx.arc(cx + dx * 4.5 + perpX * 3, cy + dy * 4.5 + perpY * 3, 1.2, 0, Math.PI * 2);
          D.ctx.fill();
          D.ctx.beginPath();
          D.ctx.arc(cx + dx * 4.5 - perpX * 3, cy + dy * 4.5 - perpY * 3, 1.2, 0, Math.PI * 2);
          D.ctx.fill();
        }
      } else {
        if (ghostAlpha < 1)
          D.ctx.globalAlpha = ghostAlpha * (1 - frac * 0.3);
        else
          D.ctx.globalAlpha = 1 - frac * 0.3;

        const r = parseInt(bodyColor.slice(1, 3), 16);
        const g = parseInt(bodyColor.slice(3, 5), 16);
        const b = parseInt(bodyColor.slice(5, 7), 16);
        const dr = Math.round(r + frac * 10);
        const dg = Math.round(g - frac * 40);
        const db = Math.round(b + frac * 10);
        D.ctx.fillStyle = 'rgb(' + dr + ',' + dg + ',' + db + ')';

        const radius = C.CELL / 2 - 1.5 - frac * 1.5;
        D.ctx.beginPath();
        D.ctx.arc(cx, cy, Math.max(radius, 3), 0, Math.PI * 2);
        D.ctx.fill();

        D.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        D.ctx.beginPath();
        D.ctx.arc(cx - 1, cy - 1, Math.max(radius * 0.5, 1.5), 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.globalAlpha = 1;
      }
    }
  }

  function drawTronRider(cx, cy, d, color) {
    D.ctx.save();
    D.ctx.translate(cx, cy);
    D.ctx.rotate(dirAngle(d));

    D.ctx.shadowColor = color;
    D.ctx.shadowBlur = 16;

    D.ctx.fillStyle = color;
    D.ctx.beginPath();
    D.ctx.moveTo(0, -8);
    D.ctx.lineTo(-3, -4);
    D.ctx.lineTo(-3, 2);
    D.ctx.quadraticCurveTo(-2, 7, 0, 7);
    D.ctx.quadraticCurveTo(2, 7, 3, 2);
    D.ctx.lineTo(3, -4);
    D.ctx.closePath();
    D.ctx.fill();

    D.ctx.strokeStyle = color;
    D.ctx.lineWidth = 3;
    D.ctx.lineCap = 'round';
    D.ctx.beginPath();
    D.ctx.moveTo(-3, -1);
    D.ctx.lineTo(-6, -1);
    D.ctx.stroke();
    D.ctx.beginPath();
    D.ctx.moveTo(3, -1);
    D.ctx.lineTo(6, -1);
    D.ctx.stroke();

    D.ctx.shadowBlur = 0;
    D.ctx.fillStyle = '#fff';
    D.ctx.beginPath();
    D.ctx.arc(0, -3, 2, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.restore();
  }

  function drawTronTrail(body, dir, color, prevHead, t) {
    if (body.length === 0)
      return;

    const headPos = prevHead
      ? lerpPos(body[0], prevHead, t)
      : { x: body[0].x * C.CELL + C.CELL / 2, y: body[0].y * C.CELL + C.CELL / 2 };

    D.ctx.save();
    D.ctx.strokeStyle = color;
    D.ctx.lineWidth = C.TRON_COLORS.width;
    D.ctx.lineCap = 'round';
    D.ctx.lineJoin = 'round';
    D.ctx.shadowColor = color;
    D.ctx.shadowBlur = 12;
    D.ctx.globalAlpha = 0.7;

    D.ctx.beginPath();
    let started = false;
    for (let i = body.length - 1; i >= 0; --i) {
      let px, py;
      if (i === 0) {
        px = headPos.x;
        py = headPos.y;
      } else {
        px = body[i].x * C.CELL + C.CELL / 2;
        py = body[i].y * C.CELL + C.CELL / 2;
      }

      if (!started) {
        D.ctx.moveTo(px, py);
        started = true;
      } else {
        const prevSeg = i < body.length - 1 ? body[i + 1] : null;
        if (prevSeg && (Math.abs(body[i].x - prevSeg.x) > 1 || Math.abs(body[i].y - prevSeg.y) > 1)) {
          D.ctx.stroke();
          D.ctx.beginPath();
          D.ctx.moveTo(px, py);
        } else
          D.ctx.lineTo(px, py);
      }
    }
    D.ctx.stroke();
    D.ctx.globalAlpha = 1;
    D.ctx.shadowBlur = 0;
    D.ctx.restore();

    drawTronRider(headPos.x, headPos.y, dir, color);
  }

  function drawSnake(timestamp) {
    if (S.snake.length === 0)
      return;
    const t = S.gameActive && !S.gameOverFlag ? S.lerpT : 1;

    const prevHead = S.prevSnake && S.prevSnake.length > 0 ? S.prevSnake[0] : null;
    const headPos = lerpPos(S.snake[0], prevHead, t);

    if (isTron()) {
      drawTronTrail(S.snake, S.direction, C.TRON_COLORS.player, prevHead, t);
      if (hasActiveEffect('shield')) {
        D.ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
        D.ctx.lineWidth = 2;
        D.ctx.beginPath();
        D.ctx.arc(headPos.x, headPos.y, C.CELL / 2 + 2, 0, Math.PI * 2);
        D.ctx.stroke();
      }
      return;
    }

    if (isMaze()) {
      drawEmberTrail(S.snake, S.prevSnake, t, timestamp);
      drawTorchFlame(headPos.x, headPos.y, S.direction, timestamp);
      if (hasActiveEffect('shield')) {
        D.ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
        D.ctx.lineWidth = 2;
        D.ctx.beginPath();
        D.ctx.arc(headPos.x, headPos.y, C.CELL / 2 + 2, 0, Math.PI * 2);
        D.ctx.stroke();
      }
      return;
    }

    const ghostAlpha = hasActiveEffect('ghost') ? 0.5 : 1;

    drawSnakeBody(S.snake, S.prevSnake, S.direction, '#4caf50', '#2d8f30', t, ghostAlpha, timestamp);

    if (hasActiveEffect('shield')) {
      D.ctx.strokeStyle = 'rgba(68, 138, 255, 0.6)';
      D.ctx.lineWidth = 2;
      D.ctx.beginPath();
      D.ctx.arc(headPos.x, headPos.y, C.CELL / 2 + 2, 0, Math.PI * 2);
      D.ctx.stroke();
    }
  }

  function drawAISnakes(timestamp) {
    const t = S.gameActive && !S.gameOverFlag ? S.lerpT : 1;
    for (const ai of S.aiSnakes) {
      if (!ai.alive)
        continue;
      const aiPrevHead = ai.prevBody && ai.prevBody.length > 0 ? ai.prevBody[0] : null;
      if (isTron()) {
        const color = C.TRON_COLORS.ai[ai.colorIdx] || C.TRON_COLORS.ai[0];
        drawTronTrail(ai.body, ai.dir, color, aiPrevHead, t);
      } else {
        const col = C.AI_COLORS[ai.colorIdx];
        drawSnakeBody(ai.body, ai.prevBody, ai.dir, col.head, col.body, t, 1, timestamp);
      }
    }
  }

  Object.assign(NS.snakeview, { drawSnakeBody, drawTronRider, drawTronTrail, drawSnake, drawAISnakes });
})();
