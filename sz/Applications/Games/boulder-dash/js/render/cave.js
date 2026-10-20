/* The canvas renderer: the cave tiles (wall brickwork, dirt texture, boulders with
   fall/slide offsets, faceted gems, the exit), the fading dig animations, enemies,
   the player, the HUD strip, the status bar and the state overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { lerp, easeOut } = NS.rules;
  const { drawTutorialOverlay } = NS.tutorial;

  function draw() {
    V.canvas.width = C.COLS * C.TILE_SIZE;
    V.canvas.height = C.ROWS * C.TILE_SIZE;

    V.ctx.save();
    V.screenShake.apply(V.ctx);

    // Draw grid
    for (let r = 0; r < C.ROWS; ++r) {
      for (let c = 0; c < C.COLS; ++c) {
        const x = c * C.TILE_SIZE;
        const y = r * C.TILE_SIZE;
        const cell = S.grid[r]?.[c];

        // Cave background with subtle per-cell depth variation
        const shade = 17 + ((r * 7 + c * 13) % 6) - 3;
        V.ctx.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
        V.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);

        // Solid-fill tiles that fully cover the cell (wall, dirt)
        if (cell === C.WALL || cell === C.DIRT) {
          V.ctx.fillStyle = C.COLORS[cell];
          V.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);
        }

        if (cell === C.WALL) {
          V.ctx.save();
          // Brick/stone pattern
          V.ctx.strokeStyle = '#444';
          V.ctx.lineWidth = 0.5;
          // Horizontal mortar lines
          V.ctx.beginPath();
          V.ctx.moveTo(x, y + 8);
          V.ctx.lineTo(x + C.TILE_SIZE, y + 8);
          V.ctx.moveTo(x, y + 16);
          V.ctx.lineTo(x + C.TILE_SIZE, y + 16);
          V.ctx.stroke();
          // Vertical mortar lines (staggered per row)
          const offset = (r % 2) * (C.TILE_SIZE / 2);
          V.ctx.beginPath();
          V.ctx.moveTo(x + (C.TILE_SIZE / 2 + offset) % C.TILE_SIZE, y);
          V.ctx.lineTo(x + (C.TILE_SIZE / 2 + offset) % C.TILE_SIZE, y + 8);
          V.ctx.moveTo(x + offset % C.TILE_SIZE || C.TILE_SIZE, y + 8);
          V.ctx.lineTo(x + offset % C.TILE_SIZE || C.TILE_SIZE, y + 16);
          V.ctx.moveTo(x + (C.TILE_SIZE / 2 + offset) % C.TILE_SIZE, y + 16);
          V.ctx.lineTo(x + (C.TILE_SIZE / 2 + offset) % C.TILE_SIZE, y + C.TILE_SIZE);
          V.ctx.stroke();
          // Depth shading: lighter top edge, darker bottom edge
          V.ctx.strokeStyle = '#777';
          V.ctx.lineWidth = 1;
          V.ctx.beginPath();
          V.ctx.moveTo(x, y + 0.5);
          V.ctx.lineTo(x + C.TILE_SIZE, y + 0.5);
          V.ctx.stroke();
          V.ctx.strokeStyle = '#333';
          V.ctx.beginPath();
          V.ctx.moveTo(x, y + C.TILE_SIZE - 0.5);
          V.ctx.lineTo(x + C.TILE_SIZE, y + C.TILE_SIZE - 0.5);
          V.ctx.stroke();
          V.ctx.restore();
        } else if (cell === C.DIRT) {
          V.ctx.save();
          // Scattered darker clumps for texture variation
          const seed = (r * 17 + c * 31) % 7;
          V.ctx.fillStyle = '#6b3510';
          V.ctx.fillRect(x + 2 + seed, y + 3, 2, 2);
          V.ctx.fillRect(x + C.TILE_SIZE - 5 - (seed % 3), y + C.TILE_SIZE - 5, 2, 2);
          V.ctx.fillRect(x + 10 + (seed % 4), y + 8, 2, 2);
          V.ctx.fillStyle = '#5a2d0c';
          V.ctx.fillRect(x + 7, y + 14 + (seed % 3), 2, 2);
          V.ctx.fillRect(x + 16 - seed, y + 4, 2, 2);
          // Thin root-like lines
          V.ctx.strokeStyle = '#5a2d0c';
          V.ctx.lineWidth = 0.5;
          V.ctx.beginPath();
          V.ctx.moveTo(x + 4 + seed, y + 10);
          V.ctx.lineTo(x + 12 + (seed % 3), y + 14);
          V.ctx.moveTo(x + 14, y + 6 + seed);
          V.ctx.lineTo(x + 20, y + 10 + (seed % 4));
          V.ctx.stroke();
          // Darker edge on sides adjacent to empty cells
          V.ctx.strokeStyle = '#4a2008';
          V.ctx.lineWidth = 1.5;
          V.ctx.beginPath();
          if (c > 0 && S.grid[r][c - 1] === C.EMPTY) {
            V.ctx.moveTo(x + 0.5, y);
            V.ctx.lineTo(x + 0.5, y + C.TILE_SIZE);
          }
          if (c < C.COLS - 1 && S.grid[r][c + 1] === C.EMPTY) {
            V.ctx.moveTo(x + C.TILE_SIZE - 0.5, y);
            V.ctx.lineTo(x + C.TILE_SIZE - 0.5, y + C.TILE_SIZE);
          }
          if (r > 0 && S.grid[r - 1][c] === C.EMPTY) {
            V.ctx.moveTo(x, y + 0.5);
            V.ctx.lineTo(x + C.TILE_SIZE, y + 0.5);
          }
          if (r < C.ROWS - 1 && S.grid[r + 1][c] === C.EMPTY) {
            V.ctx.moveTo(x, y + C.TILE_SIZE - 0.5);
            V.ctx.lineTo(x + C.TILE_SIZE, y + C.TILE_SIZE - 0.5);
          }
          V.ctx.stroke();
          V.ctx.restore();
        } else if (cell === C.BOULDER) {
          // 3D boulder look with smooth fall/slide offsets
          const key = r * C.COLS + c;
          let ox = 0, oy = 0;
          if (S.fallingBoulders.has(key)) {
            const fb = S.fallingBoulders.get(key);
            oy = -(1 - easeOut(fb.fallProgress)) * C.TILE_SIZE;
          }
          if (S.slidingBoulders.has(key)) {
            const sb = S.slidingBoulders.get(key);
            ox = (sb.fromCol - c) * C.TILE_SIZE * (1 - easeOut(sb.slideProgress));
          }
          V.ctx.save();
          const bcx = x + C.HALF_TILE + ox;
          const bcy = y + C.HALF_TILE + oy;
          const bRadius = C.HALF_TILE - 2;
          // Drop shadow
          V.ctx.fillStyle = 'rgba(0,0,0,0.35)';
          V.ctx.beginPath();
          V.ctx.ellipse(bcx + 1, bcy + bRadius + 2, bRadius - 1, 3, 0, 0, Math.PI * 2);
          V.ctx.fill();
          // Main boulder with radial gradient: #bbb top-left to #666 bottom-right
          const bGrad = V.ctx.createRadialGradient(bcx - 3, bcy - 3, 1, bcx, bcy, bRadius);
          bGrad.addColorStop(0, '#bbb');
          bGrad.addColorStop(1, '#666');
          V.ctx.fillStyle = bGrad;
          V.ctx.beginPath();
          V.ctx.arc(bcx, bcy, bRadius, 0, Math.PI * 2);
          V.ctx.fill();
          // Surface cracks: 2-3 thin dark lines seeded per position
          const crackSeed = (r * 7 + c * 13) % 5;
          V.ctx.strokeStyle = 'rgba(40,30,20,0.5)';
          V.ctx.lineWidth = 0.5;
          V.ctx.beginPath();
          V.ctx.moveTo(bcx - 4 + crackSeed, bcy - 2);
          V.ctx.lineTo(bcx + 1, bcy + 3 + (crackSeed % 3));
          V.ctx.moveTo(bcx + 2, bcy - 5 + crackSeed);
          V.ctx.lineTo(bcx + 5 - (crackSeed % 2), bcy + 1);
          if (crackSeed > 2) {
            V.ctx.moveTo(bcx - 3, bcy + 2);
            V.ctx.lineTo(bcx + 2, bcy + 5);
          }
          V.ctx.stroke();
          V.ctx.restore();
        } else if (cell === C.GEM) {
          V.ctx.save();
          const gcx = x + C.HALF_TILE;
          const gcy = y + C.HALF_TILE;
          const gTop = y + 3;
          const gBot = y + C.TILE_SIZE - 3;
          const gLft = x + 3;
          const gRgt = x + C.TILE_SIZE - 3;
          // Glow
          V.ctx.shadowBlur = 12;
          V.ctx.shadowColor = '#00e5ff';
          // Rainbow refraction: each facet triangle gets a slightly different hue
          const facetColors = ['#00e5ff', '#40ffb0', '#a080ff', '#ff80d0'];
          // Top facet
          V.ctx.fillStyle = facetColors[0];
          V.ctx.beginPath();
          V.ctx.moveTo(gcx, gTop);
          V.ctx.lineTo(gRgt, gcy);
          V.ctx.lineTo(gcx, gcy);
          V.ctx.closePath();
          V.ctx.fill();
          // Right facet
          V.ctx.fillStyle = facetColors[1];
          V.ctx.beginPath();
          V.ctx.moveTo(gRgt, gcy);
          V.ctx.lineTo(gcx, gBot);
          V.ctx.lineTo(gcx, gcy);
          V.ctx.closePath();
          V.ctx.fill();
          // Bottom facet
          V.ctx.fillStyle = facetColors[2];
          V.ctx.beginPath();
          V.ctx.moveTo(gcx, gBot);
          V.ctx.lineTo(gLft, gcy);
          V.ctx.lineTo(gcx, gcy);
          V.ctx.closePath();
          V.ctx.fill();
          // Left facet
          V.ctx.fillStyle = facetColors[3];
          V.ctx.beginPath();
          V.ctx.moveTo(gLft, gcy);
          V.ctx.lineTo(gcx, gTop);
          V.ctx.lineTo(gcx, gcy);
          V.ctx.closePath();
          V.ctx.fill();
          // Internal facet lines from center to each vertex midpoint
          V.ctx.shadowBlur = 0;
          V.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          V.ctx.lineWidth = 0.5;
          V.ctx.beginPath();
          V.ctx.moveTo(gcx, gcy);
          V.ctx.lineTo((gcx + gRgt) / 2, (gTop + gcy) / 2);
          V.ctx.moveTo(gcx, gcy);
          V.ctx.lineTo((gcx + gRgt) / 2, (gBot + gcy) / 2);
          V.ctx.moveTo(gcx, gcy);
          V.ctx.lineTo((gcx + gLft) / 2, (gBot + gcy) / 2);
          V.ctx.moveTo(gcx, gcy);
          V.ctx.lineTo((gcx + gLft) / 2, (gTop + gcy) / 2);
          V.ctx.stroke();
          // Sparkle animation: rotating highlight dot orbiting the gem
          const sparkAngle = Date.now() * 0.003 + (r * 5 + c * 11);
          const sparkR = 7;
          const sparkX = gcx + Math.cos(sparkAngle) * sparkR;
          const sparkY = gcy + Math.sin(sparkAngle) * sparkR;
          V.ctx.fillStyle = 'rgba(255,255,255,0.9)';
          V.ctx.beginPath();
          V.ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
          V.ctx.fill();
          V.ctx.restore();
        } else if (cell === C.EXIT) {
          V.ctx.save();
          if (S.exitOpen) {
            // Pulsing glow animation
            const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
            V.ctx.shadowBlur = 10 + pulse * 15;
            V.ctx.shadowColor = '#ffd700';
            V.ctx.fillStyle = '#ffd700';
          } else {
            V.ctx.shadowBlur = 0;
            V.ctx.fillStyle = '#555';
          }
          V.ctx.fillRect(x + 4, y + 2, C.TILE_SIZE - 8, C.TILE_SIZE - 4);
          V.ctx.fillStyle = '#333';
          V.ctx.fillRect(x + C.TILE_SIZE - 10, y + C.HALF_TILE - 2, 3, 4);
          // Sparkle particles around open exit
          if (S.exitOpen) {
            V.ctx.shadowBlur = 0;
            const now = Date.now();
            for (let s = 0; s < 4; ++s) {
              const angle = now * 0.002 + s * (Math.PI / 2);
              const dist = 10 + Math.sin(now * 0.004 + s) * 3;
              const sx = x + C.HALF_TILE + Math.cos(angle) * dist;
              const sy = y + C.HALF_TILE + Math.sin(angle) * dist;
              const alpha = 0.5 + Math.sin(now * 0.006 + s * 2) * 0.4;
              V.ctx.fillStyle = `rgba(255,215,0,${alpha})`;
              V.ctx.beginPath();
              V.ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
              V.ctx.fill();
            }
          }
          V.ctx.restore();
        }
      }
    }

    // Draw fading cells (dirt dig / gem collect animations)
    for (const fc of S.fadingCells) {
      const fx = fc.col * C.TILE_SIZE;
      const fy = fc.row * C.TILE_SIZE;
      V.ctx.save();
      V.ctx.globalAlpha = fc.alpha;
      if (fc.type === C.DIRT) {
        const s = fc.alpha;
        const cx = fx + C.TILE_SIZE / 2;
        const cy = fy + C.TILE_SIZE / 2;
        V.ctx.fillStyle = '#8B4513';
        V.ctx.fillRect(cx - C.TILE_SIZE * s / 2, cy - C.TILE_SIZE * s / 2, C.TILE_SIZE * s, C.TILE_SIZE * s);
      } else if (fc.type === C.GEM) {
        const s = 1 + (1 - fc.alpha) * 0.5;
        const cx = fx + C.TILE_SIZE / 2;
        const cy = fy + C.TILE_SIZE / 2;
        const half = (C.TILE_SIZE / 2 - 3) * s;
        V.ctx.fillStyle = '#00e5ff';
        V.ctx.beginPath();
        V.ctx.moveTo(cx, cy - half);
        V.ctx.lineTo(cx + half, cy);
        V.ctx.lineTo(cx, cy + half);
        V.ctx.lineTo(cx - half, cy);
        V.ctx.closePath();
        V.ctx.fill();
      }
      V.ctx.restore();
    }

    // Draw enemies
    for (const enemy of S.enemies) {
      if (!enemy.alive) continue;
      const ex = lerp(enemy.col, enemy.targetCol, easeOut(enemy.moveProgress)) * C.TILE_SIZE;
      const ey = lerp(enemy.row, enemy.targetRow, easeOut(enemy.moveProgress)) * C.TILE_SIZE;
      V.ctx.save();
      const ecx = ex + C.HALF_TILE;
      const ecy = ey + C.HALF_TILE;
      // Body wobble animation
      const wobble = Math.sin(Date.now() * 0.008) * 1.5;
      // Legs: 2 tiny arcs at the bottom
      V.ctx.fillStyle = '#cc2222';
      V.ctx.beginPath();
      V.ctx.arc(ecx - 4, ecy + 8, 3, 0, Math.PI);
      V.ctx.fill();
      V.ctx.beginPath();
      V.ctx.arc(ecx + 4, ecy + 8, 3, 0, Math.PI);
      V.ctx.fill();
      // Main body (slightly wobbling)
      V.ctx.fillStyle = '#ff4444';
      V.ctx.beginPath();
      V.ctx.arc(ecx + wobble * 0.3, ecy, C.HALF_TILE - 3, 0, Math.PI * 2);
      V.ctx.fill();
      // Antennae: 2 short lines with dots on top of head
      V.ctx.strokeStyle = '#ff6666';
      V.ctx.lineWidth = 1;
      V.ctx.beginPath();
      V.ctx.moveTo(ecx - 3 + wobble * 0.2, ecy - 8);
      V.ctx.lineTo(ecx - 6 + wobble * 0.5, ecy - 13);
      V.ctx.moveTo(ecx + 3 + wobble * 0.2, ecy - 8);
      V.ctx.lineTo(ecx + 6 + wobble * 0.5, ecy - 13);
      V.ctx.stroke();
      // Antenna tips
      V.ctx.fillStyle = '#ffaaaa';
      V.ctx.beginPath();
      V.ctx.arc(ecx - 6 + wobble * 0.5, ecy - 13, 1.5, 0, Math.PI * 2);
      V.ctx.arc(ecx + 6 + wobble * 0.5, ecy - 13, 1.5, 0, Math.PI * 2);
      V.ctx.fill();
      // Eyes
      V.ctx.fillStyle = '#fff';
      V.ctx.beginPath();
      V.ctx.arc(ecx - 4, ecy - 2, 3.5, 0, Math.PI * 2);
      V.ctx.arc(ecx + 4, ecy - 2, 3.5, 0, Math.PI * 2);
      V.ctx.fill();
      V.ctx.fillStyle = '#000';
      V.ctx.beginPath();
      V.ctx.arc(ecx - 3, ecy - 2, 1.8, 0, Math.PI * 2);
      V.ctx.arc(ecx + 5, ecy - 2, 1.8, 0, Math.PI * 2);
      V.ctx.fill();
      V.ctx.restore();
    }

    // Draw player
    if (S.player.alive) {
      const px = lerp(S.player.col, S.player.targetCol, easeOut(S.player.moveProgress)) * C.TILE_SIZE;
      const py = lerp(S.player.row, S.player.targetRow, easeOut(S.player.moveProgress)) * C.TILE_SIZE;
      V.ctx.save();
      const pcx = px + C.HALF_TILE;
      const pcy = py + C.HALF_TILE;
      // Slightly oval body shape
      V.ctx.fillStyle = '#4ec0ca';
      V.ctx.beginPath();
      V.ctx.ellipse(pcx, pcy + 1, C.HALF_TILE - 2, C.HALF_TILE - 1, 0, 0, Math.PI * 2);
      V.ctx.fill();
      // Hardhat: colored arc on top of head
      V.ctx.fillStyle = '#f0c020';
      V.ctx.beginPath();
      V.ctx.ellipse(pcx, pcy - 4, 9, 5, 0, Math.PI, Math.PI * 2);
      V.ctx.fill();
      // Hardhat brim
      V.ctx.strokeStyle = '#d4a010';
      V.ctx.lineWidth = 1.5;
      V.ctx.beginPath();
      V.ctx.moveTo(pcx - 10, pcy - 4);
      V.ctx.lineTo(pcx + 10, pcy - 4);
      V.ctx.stroke();
      // Eyes: slightly larger whites, more defined pupils
      V.ctx.fillStyle = '#fff';
      V.ctx.beginPath();
      V.ctx.arc(pcx - 4, pcy - 1, 3.5, 0, Math.PI * 2);
      V.ctx.arc(pcx + 4, pcy - 1, 3.5, 0, Math.PI * 2);
      V.ctx.fill();
      V.ctx.fillStyle = '#111';
      V.ctx.beginPath();
      V.ctx.arc(pcx - 3, pcy - 1, 2, 0, Math.PI * 2);
      V.ctx.arc(pcx + 5, pcy - 1, 2, 0, Math.PI * 2);
      V.ctx.fill();
      // Pupil highlights
      V.ctx.fillStyle = '#fff';
      V.ctx.beginPath();
      V.ctx.arc(pcx - 3.5, pcy - 2, 0.7, 0, Math.PI * 2);
      V.ctx.arc(pcx + 4.5, pcy - 2, 0.7, 0, Math.PI * 2);
      V.ctx.fill();
      // Small pickaxe held to the right
      V.ctx.strokeStyle = '#8B6914';
      V.ctx.lineWidth = 1.5;
      V.ctx.beginPath();
      V.ctx.moveTo(pcx + 8, pcy + 2);
      V.ctx.lineTo(pcx + 14, pcy - 6);
      V.ctx.stroke();
      // Pickaxe head
      V.ctx.strokeStyle = '#aaa';
      V.ctx.lineWidth = 2;
      V.ctx.beginPath();
      V.ctx.moveTo(pcx + 12, pcy - 7);
      V.ctx.lineTo(pcx + 16, pcy - 5);
      V.ctx.stroke();
      V.ctx.restore();
    }

    // Draw effects
    V.particles.draw(V.ctx);
    V.floatingText.draw(V.ctx);

    V.screenShake.restore(V.ctx);
    V.ctx.restore();

    // HUD overlay
    V.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    V.ctx.fillRect(0, 0, V.canvas.width, 22);
    V.ctx.fillStyle = '#fff';
    V.ctx.font = '12px Consolas, monospace';
    V.ctx.fillText(`Level: ${S.currentLevel}  Score: ${S.score}  Gems: ${S.gemsCollected}/${S.gemsRequired}  Time: ${Math.ceil(S.timeLeft)}  Lives: ${S.lives}`, 6, 15);

    // Status bar
    if (V.elScore) V.elScore.textContent = 'Score: ' + S.score;
    if (V.elLevel) V.elLevel.textContent = 'Level: ' + S.currentLevel;
    if (V.elLives) V.elLives.textContent = 'Lives: ' + S.lives;
    if (V.elGems) V.elGems.textContent = 'Gems: ' + S.gemsCollected + '/' + S.gemsRequired;
    if (V.elTime) V.elTime.textContent = 'Time: ' + Math.ceil(S.timeLeft);
    if (V.elState) V.elState.textContent = S.state === C.STATE_PAUSED ? 'Paused' : S.state === C.STATE_DEAD ? 'Game Over' : 'Playing';

    // Overlay text
    if (S.state === C.STATE_PAUSED) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      V.ctx.fillRect(0, 0, V.canvas.width, V.canvas.height);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = 'bold 24px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('PAUSED', V.canvas.width / 2, V.canvas.height / 2);
      V.ctx.textAlign = 'start';
    } else if (S.state === C.STATE_DEAD) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      V.ctx.fillRect(0, 0, V.canvas.width, V.canvas.height);
      V.ctx.fillStyle = '#ff4444';
      V.ctx.font = 'bold 28px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('GAME OVER', V.canvas.width / 2, V.canvas.height / 2 - 10);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = '16px sans-serif';
      V.ctx.fillText('Score: ' + S.score + '  |  Tap or press F2 for New Game', V.canvas.width / 2, V.canvas.height / 2 + 20);
      V.ctx.textAlign = 'start';
    } else if (S.state === C.STATE_READY) {
      V.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      V.ctx.fillRect(0, 0, V.canvas.width, V.canvas.height);
      V.ctx.fillStyle = '#ffd700';
      V.ctx.font = 'bold 24px sans-serif';
      V.ctx.textAlign = 'center';
      V.ctx.fillText('BOULDER DASH', V.canvas.width / 2, V.canvas.height / 2 - 15);
      V.ctx.fillStyle = '#fff';
      V.ctx.font = '14px sans-serif';
      V.ctx.fillText('Press F2 or click New Game to start', V.canvas.width / 2, V.canvas.height / 2 + 15);
      V.ctx.textAlign = 'start';
    }

    if (S.showTutorial)
      drawTutorialOverlay();
  }

  Object.assign(NS.cave, { draw });
})();
