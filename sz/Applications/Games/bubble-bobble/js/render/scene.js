/* The frame composition: the twinkling gradient background, the brick-textured
   platforms, the fruit items, the power-ups, the glassy bubbles (with trapped-enemy
   miniature), the horned enemies, the player, the particle/floating-text effects, the
   HUD and status bar, the pause/game-over/ready overlays and the tutorial overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Rendering ── */
  function draw() {
    V.canvas.width = C.CANVAS_W;
    V.canvas.height = C.CANVAS_H;

    V.ctx.save();
    V.screenShake.apply(V.ctx);

    // Background — vertical gradient with twinkling sparkle stars
    {
      const bgGrad = V.ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
      bgGrad.addColorStop(0, '#06061e');
      bgGrad.addColorStop(1, '#141438');
      V.ctx.fillStyle = bgGrad;
      V.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      const now = Date.now() / 1000;
      for (const s of S.sparkles) {
        const alpha = Math.sin(now + s.seed) * 0.4 + 0.5;
        V.ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        V.ctx.fillRect(s.x, s.y, 2, 2);
      }
    }

    // Platforms — brick texture with gradient and edge highlight
    for (const p of S.platforms) {
      V.ctx.save();
      const pGrad = V.ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      pGrad.addColorStop(0, '#556');
      pGrad.addColorStop(1, '#334');
      V.ctx.fillStyle = pGrad;
      V.ctx.fillRect(p.x, p.y, p.w, p.h);

      // Brick pattern — staggered small rectangles
      V.ctx.fillStyle = 'rgba(120,120,160,0.25)';
      const brickW = 16;
      const brickH = Math.max(6, p.h / 2);
      for (let row = 0; row * brickH < p.h; ++row) {
        const offsetX = (row % 2 === 0) ? 0 : brickW / 2;
        for (let bx = 0; bx < p.w; bx += brickW) {
          const drawX = p.x + bx + offsetX;
          const drawY = p.y + row * brickH;
          if (drawX < p.x + p.w && drawY < p.y + p.h)
            V.ctx.fillRect(drawX + 1, drawY + 1, Math.min(brickW - 2, p.x + p.w - drawX - 1), Math.min(brickH - 1, p.y + p.h - drawY - 1));
        }
      }

      // Edge highlight — bright line on top
      V.ctx.strokeStyle = '#99a';
      V.ctx.lineWidth = 1;
      V.ctx.beginPath();
      V.ctx.moveTo(p.x, p.y + 0.5);
      V.ctx.lineTo(p.x + p.w, p.y + 0.5);
      V.ctx.stroke();

      // Border
      V.ctx.strokeStyle = '#668';
      V.ctx.lineWidth = 1;
      V.ctx.strokeRect(p.x, p.y, p.w, p.h);
      V.ctx.restore();
    }

    // Items (fruit drops) — 3D sphere with radial gradient and specular highlight
    for (const item of S.items) {
      V.ctx.save();
      const fCx = item.x + 7;
      const fCy = item.y + 7;
      const fGrad = V.ctx.createRadialGradient(fCx - 2, fCy - 2, 1, fCx, fCy, 8);
      fGrad.addColorStop(0, '#ffaa33');
      fGrad.addColorStop(0.7, '#ff6600');
      fGrad.addColorStop(1, '#aa3300');
      V.ctx.fillStyle = fGrad;
      V.ctx.beginPath();
      V.ctx.arc(fCx, fCy, 7, 0, Math.PI * 2);
      V.ctx.fill();

      // Specular highlight — small white dot upper-left
      V.ctx.fillStyle = 'rgba(255,255,255,0.7)';
      V.ctx.beginPath();
      V.ctx.arc(fCx - 3, fCy - 3, 2, 0, Math.PI * 2);
      V.ctx.fill();

      // Leaf / stem
      V.ctx.fillStyle = '#00aa00';
      V.ctx.fillRect(item.x + 5, item.y - 2, 4, 4);
      V.ctx.restore();
    }

    // Power-ups
    for (const pu of S.powerUps) {
      if (!pu.active) continue;
      V.ctx.save();
      V.ctx.shadowBlur = 8;
      V.ctx.shadowColor = '#ffd700';
      V.ctx.fillStyle = pu.type === 'speed' ? '#00ff88' : pu.type === 'range' ? '#ff8800' : '#ff4400';
      V.ctx.fillRect(pu.x, pu.y, pu.w, pu.h);
      V.ctx.restore();
    }

    // Bubbles — glass sphere with gradient, rainbow shimmer, wobble, and trapped enemy miniature
    for (const b of S.bubbles) {
      V.ctx.save();
      V.ctx.globalAlpha = 0.7;

      const bCx = b.x + 8;
      const bCy = b.y + 8;

      // Wobble deformation — oscillating ellipse
      const wobbleX = Math.sin(Date.now() / 300 + b.x) * 0.08;
      const wobbleY = Math.cos(Date.now() / 400 + b.y) * 0.08;
      V.ctx.translate(bCx, bCy);
      V.ctx.scale(1 + wobbleX, 1 + wobbleY);
      V.ctx.translate(-bCx, -bCy);

      // Bubble glow for trapped enemy
      if (b.trappedEnemy) {
        V.ctx.shadowBlur = 12;
        V.ctx.shadowColor = '#44aaff';
      }

      // Radial gradient fill — glass/sphere look
      const bubGrad = V.ctx.createRadialGradient(bCx, bCy, 1, bCx, bCy, 11);
      bubGrad.addColorStop(0, 'rgba(200,240,255,0.05)');
      bubGrad.addColorStop(0.6, 'rgba(100,200,255,0.12)');
      bubGrad.addColorStop(1, 'rgba(100,200,255,0.25)');
      V.ctx.fillStyle = bubGrad;
      V.ctx.beginPath();
      V.ctx.arc(bCx, bCy, 10, 0, Math.PI * 2);
      V.ctx.fill();

      // Stroke
      V.ctx.strokeStyle = '#88ddff';
      V.ctx.lineWidth = 2;
      V.ctx.stroke();

      // Rainbow shimmer highlight — hue cycles over time
      const hue = ((Date.now() / 1000) * 60 + b.x * 3) % 360;
      V.ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.45)`;
      V.ctx.beginPath();
      V.ctx.arc(bCx - 3, bCy - 3, 4, 0, Math.PI * 2);
      V.ctx.fill();

      // Second smaller highlight for pop effect
      V.ctx.fillStyle = 'rgba(255,255,255,0.5)';
      V.ctx.beginPath();
      V.ctx.arc(bCx + 2, bCy - 5, 2, 0, Math.PI * 2);
      V.ctx.fill();

      // Trapped enemy miniature inside bubble
      if (b.trappedEnemy) {
        V.ctx.fillStyle = 'rgba(220,60,60,0.7)';
        V.ctx.fillRect(bCx - 4, bCy - 3, 8, 7);
        V.ctx.fillStyle = '#fff';
        V.ctx.fillRect(bCx - 3, bCy - 2, 2, 2);
        V.ctx.fillRect(bCx + 1, bCy - 2, 2, 2);
        V.ctx.fillStyle = '#000';
        V.ctx.fillRect(bCx - 2, bCy - 1, 1, 1);
        V.ctx.fillRect(bCx + 2, bCy - 1, 1, 1);
      }

      V.ctx.restore();
    }

    // Enemies — rounded body with horns, angry eyebrows, and trapped dazed state
    for (const enemy of S.enemies) {
      if (!enemy.alive) continue;
      V.ctx.save();
      const eCx = enemy.x + enemy.w / 2;
      const eCy = enemy.y + enemy.h / 2;
      const eRad = enemy.w / 2;

      if (enemy.trapped) {
        V.ctx.shadowBlur = 12;
        V.ctx.shadowColor = '#44aaff';
      }

      // Rounded body
      V.ctx.fillStyle = enemy.trapped ? '#7788dd' : '#ee4444';
      V.ctx.beginPath();
      V.ctx.arc(eCx, eCy, eRad, 0, Math.PI * 2);
      V.ctx.fill();

      // Horns / antennae — two small triangles on top
      V.ctx.fillStyle = enemy.trapped ? '#6677cc' : '#cc2222';
      V.ctx.beginPath();
      V.ctx.moveTo(eCx - 5, eCy - eRad + 1);
      V.ctx.lineTo(eCx - 7, eCy - eRad - 6);
      V.ctx.lineTo(eCx - 2, eCy - eRad + 1);
      V.ctx.fill();
      V.ctx.beginPath();
      V.ctx.moveTo(eCx + 5, eCy - eRad + 1);
      V.ctx.lineTo(eCx + 7, eCy - eRad - 6);
      V.ctx.lineTo(eCx + 2, eCy - eRad + 1);
      V.ctx.fill();

      if (enemy.trapped) {
        // Dazed eyes — white sclera with spiral arcs instead of solid pupils
        V.ctx.fillStyle = '#fff';
        V.ctx.beginPath();
        V.ctx.arc(eCx - 4, eCy - 1, 3, 0, Math.PI * 2);
        V.ctx.arc(eCx + 4, eCy - 1, 3, 0, Math.PI * 2);
        V.ctx.fill();

        // Spiral daze in pupils
        V.ctx.strokeStyle = '#5566aa';
        V.ctx.lineWidth = 1;
        const spiralT = Date.now() / 300;
        for (const sx of [eCx - 4, eCx + 4]) {
          V.ctx.beginPath();
          V.ctx.arc(sx, eCy - 1, 2, spiralT, spiralT + Math.PI * 1.2);
          V.ctx.stroke();
          V.ctx.beginPath();
          V.ctx.arc(sx, eCy - 1, 1, spiralT + Math.PI, spiralT + Math.PI * 2);
          V.ctx.stroke();
        }
      } else {
        // Normal eyes
        V.ctx.fillStyle = '#fff';
        V.ctx.beginPath();
        V.ctx.arc(eCx - 4, eCy - 1, 3, 0, Math.PI * 2);
        V.ctx.arc(eCx + 4, eCy - 1, 3, 0, Math.PI * 2);
        V.ctx.fill();
        V.ctx.fillStyle = '#000';
        V.ctx.beginPath();
        V.ctx.arc(eCx - 4, eCy - 1, 1.5, 0, Math.PI * 2);
        V.ctx.arc(eCx + 4, eCy - 1, 1.5, 0, Math.PI * 2);
        V.ctx.fill();

        // Angry eyebrows — short diagonal lines above eyes
        V.ctx.strokeStyle = '#000';
        V.ctx.lineWidth = 1.5;
        V.ctx.beginPath();
        V.ctx.moveTo(eCx - 6, eCy - 5);
        V.ctx.lineTo(eCx - 2, eCy - 4);
        V.ctx.stroke();
        V.ctx.beginPath();
        V.ctx.moveTo(eCx + 6, eCy - 5);
        V.ctx.lineTo(eCx + 2, eCy - 4);
        V.ctx.stroke();
      }

      V.ctx.restore();
    }

    // Draw player
    if (S.player.alive && (S.player.invincible <= 0 || Math.floor(S.player.invincible * 10) % 2 === 0)) {
      NS.playerview.drawPlayer();
    }

    // Effects
    V.particles.draw(V.ctx);
    V.floatingText.draw(V.ctx);

    V.screenShake.restore(V.ctx);
    V.ctx.restore();

    // HUD
    V.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    V.ctx.fillRect(0, 0, C.CANVAS_W, 20);
    V.ctx.fillStyle = '#fff';
    V.ctx.font = '12px Consolas, monospace';
    V.ctx.fillText(`Level: ${S.currentLevel}  Score: ${S.score}  Lives: ${S.lives}`, 6, 14);

    // Status bar
    if (V.elScore) V.elScore.textContent = 'Score: ' + S.score;
    if (V.elLevel) V.elLevel.textContent = 'Level: ' + S.currentLevel;
    if (V.elLives) V.elLives.textContent = 'Lives: ' + S.lives;
    if (V.elState) V.elState.textContent = S.state === C.STATE_PAUSED ? 'Paused' : S.state === C.STATE_DEAD ? 'Game Over' : 'Playing';

    // Overlays
    if (S.state === C.STATE_PAUSED) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      V.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = 'bold 24px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2);
      V.ctx.textAlign = 'start';
    } else if (S.state === C.STATE_DEAD) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      V.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      V.ctx.fillStyle = '#ff4444';
      V.ctx.font = 'bold 28px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('GAME OVER', C.CANVAS_W / 2, C.CANVAS_H / 2 - 10);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = '16px sans-serif';
      V.ctx.fillText('Score: ' + S.score + '  |  Tap or press F2 for New Game', C.CANVAS_W / 2, C.CANVAS_H / 2 + 20);
      V.ctx.textAlign = 'start';
    } else if (S.state === C.STATE_READY) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      V.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      V.ctx.fillStyle = '#66ddff';
      V.ctx.font = 'bold 24px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('BUBBLE BOBBLE', C.CANVAS_W / 2, C.CANVAS_H / 2 - 15);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = '14px sans-serif';
      V.ctx.fillText('Press F2 or click New Game to start', C.CANVAS_W / 2, C.CANVAS_H / 2 + 15);
      V.ctx.textAlign = 'start';
    }

    if (S.showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    V.ctx.fillStyle = 'rgba(0,0,0,0.8)';
    V.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    const page = C.TUTORIAL_PAGES[S.tutorialPage] || C.TUTORIAL_PAGES[0];
    const cx = C.CANVAS_W / 2, pw = 380, ph = 220, px = cx - pw / 2, py = (C.CANVAS_H - ph) / 2;
    V.ctx.fillStyle = 'rgba(10,25,40,0.95)';
    V.ctx.fillRect(px, py, pw, ph);
    V.ctx.strokeStyle = '#6df';
    V.ctx.lineWidth = 2;
    V.ctx.strokeRect(px, py, pw, ph);
    V.ctx.fillStyle = '#666';
    V.ctx.font = '10px sans-serif';
    V.ctx.textAlign = 'center';
    V.ctx.fillText('Page ' + (S.tutorialPage + 1) + ' / ' + C.TUTORIAL_PAGES.length, cx, py + ph - 12);
    V.ctx.fillStyle = '#6df';
    V.ctx.font = 'bold 18px sans-serif';
    V.ctx.fillText(page.title, cx, py + 30);
    V.ctx.fillStyle = '#ccc';
    V.ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      V.ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    V.ctx.fillStyle = '#888';
    V.ctx.font = '11px sans-serif';
    if (S.tutorialPage < C.TUTORIAL_PAGES.length - 1)
      V.ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      V.ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
    V.ctx.textAlign = 'start';
  }

  Object.assign(NS.scene, { draw, drawTutorialOverlay });
})();
