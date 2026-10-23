/* The whole frame: terrain and grass details, power-ups, bombs, fire, enemies,
   the player, the effect layers and the READY / PAUSED / GAME OVER overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const SC = NS.scene = NS.scene || {};

  /* ── Draw ── */
  SC.draw = function draw() {
    D.ctx.save();
    const w = C.COLS * C.TILE_SIZE;
    const h = C.ROWS * C.TILE_SIZE;
    D.ctx.fillStyle = '#1a1a2e';
    D.ctx.fillRect(0, 0, w, h);

    D.screenShake.apply(D.ctx);
    D.ctx.imageSmoothingEnabled = false;

    // Draw grid
    for (let r = 0; r < C.ROWS; ++r) {
      for (let c = 0; c < C.COLS; ++c) {
        const x = c * C.TILE_SIZE;
        const y = r * C.TILE_SIZE;
        const cell = S.grid[r][c];

        if (S.spritesReady < 1) {
          if (cell === C.WALL) {
            D.ctx.fillStyle = '#555';
            D.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);
            D.ctx.fillStyle = '#666';
            D.ctx.fillRect(x + 2, y + 2, C.TILE_SIZE - 4, C.TILE_SIZE - 4);
          } else if (cell === C.DESTRUCTIBLE) {
            D.ctx.fillStyle = '#a0522d';
            D.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);
            D.ctx.fillStyle = '#cd853f';
            D.ctx.fillRect(x + 3, y + 3, C.TILE_SIZE - 6, C.TILE_SIZE - 6);
            D.ctx.strokeStyle = '#8b4513';
            D.ctx.lineWidth = 1;
            D.ctx.strokeRect(x + 3, y + 3, C.TILE_SIZE - 6, C.TILE_SIZE - 6);
            D.ctx.beginPath();
            D.ctx.moveTo(x + C.TILE_SIZE / 2, y + 3);
            D.ctx.lineTo(x + C.TILE_SIZE / 2, y + C.TILE_SIZE - 3);
            D.ctx.stroke();
            D.ctx.beginPath();
            D.ctx.moveTo(x + 3, y + C.TILE_SIZE / 2);
            D.ctx.lineTo(x + C.TILE_SIZE - 3, y + C.TILE_SIZE / 2);
            D.ctx.stroke();
          } else {
            D.ctx.fillStyle = '#2d3436';
            D.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);
            D.ctx.fillStyle = '#353b48';
            D.ctx.fillRect(x + 1, y + 1, C.TILE_SIZE - 2, C.TILE_SIZE - 2);
          }
          continue;
        }

        // Sprite-based rendering
        if (cell === C.WALL) {
          NS.sprites.drawSprite(C.S_WALL, x, y);
        } else {
          NS.sprites.drawSprite(C.S_GRASS, x, y);
          if ((r + c) % 2 === 0) {
            D.ctx.fillStyle = 'rgba(0,0,0,0.06)';
            D.ctx.fillRect(x, y, C.TILE_SIZE, C.TILE_SIZE);
          }
          if (cell === C.EMPTY) {
            const details = S.grassSeed[r * C.COLS + c];
            if (details) {
              D.ctx.fillStyle = 'rgba(0,80,0,0.15)';
              for (const dot of details)
                D.ctx.fillRect(x + dot.x, y + dot.y, dot.s, dot.s);
            }
          } else if (cell === C.DESTRUCTIBLE) {
            NS.sprites.drawSprite(C.S_BOX, x, y);
          }
        }
        D.ctx.fillStyle = 'rgba(0,0,0,0.1)';
        D.ctx.fillRect(x, y + C.TILE_SIZE - 1, C.TILE_SIZE, 1);
        D.ctx.fillRect(x + C.TILE_SIZE - 1, y, 1, C.TILE_SIZE);
      }
    }

    // Draw power-ups with power-up sparkle effect
    for (const pu of S.powerUps) {
      const px = pu.col * C.TILE_SIZE + C.TILE_SIZE / 2;
      const py = pu.row * C.TILE_SIZE + C.TILE_SIZE / 2;
      const entry = T.powerUpEntry(pu.type);
      D.ctx.save();
      D.ctx.shadowColor = '#ffd700';
      D.ctx.shadowBlur = 8 + 4 * Math.sin(Date.now() / 200);
      D.ctx.fillStyle = entry.color;
      D.ctx.beginPath();
      D.ctx.arc(px, py, C.TILE_SIZE / 3, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.restore();
      // Icon letter
      D.ctx.fillStyle = '#fff';
      D.ctx.font = 'bold 14px sans-serif';
      D.ctx.textAlign = 'center';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillText(entry.letter, px, py);
    }

    // Draw bombs (with slide interpolation)
    for (const bomb of S.bombs) {
      let bx = bomb.col * C.TILE_SIZE + C.TILE_SIZE / 2;
      let by = bomb.row * C.TILE_SIZE + C.TILE_SIZE / 2;
      if (bomb.sliding && bomb.slideProgress > 0) {
        bx += bomb.slideDx * bomb.slideProgress * C.TILE_SIZE;
        by += bomb.slideDy * bomb.slideProgress * C.TILE_SIZE;
      }
      const pulse = 1 + 0.08 * Math.sin(bomb.fuse * 8);
      if (S.spritesReady >= 1) {
        // Drop shadow
        D.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        D.ctx.beginPath();
        D.ctx.ellipse(bx, by + C.TILE_SIZE * 0.3, C.TILE_SIZE * 0.25, C.TILE_SIZE * 0.08, 0, 0, Math.PI * 2);
        D.ctx.fill();
        // Bomb sprite (frame based on fuse)
        const frameIdx = Math.min(5, Math.floor((1 - bomb.fuse / C.BOMB_TIME) * 5.99));
        const sz = C.TILE_SIZE * pulse;
        NS.sprites.drawSprite(C.S_BOMB[frameIdx], bx - sz / 2, by - sz / 2, sz, sz);
        // Fuse spark with glow
        D.ctx.save();
        D.ctx.shadowColor = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        D.ctx.shadowBlur = 6;
        D.ctx.fillStyle = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        D.ctx.beginPath();
        D.ctx.arc(bx, by - C.TILE_SIZE * 0.35 * pulse, 3, 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.restore();
      } else {
        D.ctx.save();
        D.ctx.shadowColor = '#000';
        D.ctx.shadowBlur = 4;
        D.ctx.fillStyle = '#222';
        D.ctx.beginPath();
        D.ctx.arc(bx, by, C.TILE_SIZE / 3 * pulse, 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.restore();
        D.ctx.fillStyle = bomb.fuse > 0.5 ? '#ff0' : '#f00';
        D.ctx.beginPath();
        D.ctx.arc(bx, by - C.TILE_SIZE / 3, 3, 0, Math.PI * 2);
        D.ctx.fill();
      }
    }

    // Draw fire cells
    for (const fire of S.fireCells) {
      const progress = fire.timer / C.FIRE_DURATION;
      const fx = fire.col * C.TILE_SIZE;
      const fy = fire.row * C.TILE_SIZE;
      const fcx = fx + C.TILE_SIZE / 2;
      const fcy = fy + C.TILE_SIZE / 2;

      D.ctx.save();
      D.ctx.globalAlpha = Math.min(1, progress * 2);
      D.ctx.shadowColor = '#ff4500';
      D.ctx.shadowBlur = 20 * progress;

      if (S.spritesReady >= 2 && fire.isCenter) {
        // Center burst from explosion sheet
        const frameIdx = Math.min(C.EXPL_COLS - 1, Math.floor((1 - progress) * C.EXPL_COLS));
        const es = C.TILE_SIZE + 8;
        D.ctx.drawImage(D.explosionSheet, frameIdx * C.EXPL_FW, 0, C.EXPL_FW, C.EXPL_FH,
          fcx - es / 2, fcy - es / 2, es, es);
      } else if (S.spritesReady >= 1 && fire.dirX !== undefined) {
        // Arm/end from main sprite sheet (horizontal pieces rotated for vertical)
        const isH = fire.dirX !== 0;
        if (isH) {
          const s = fire.isEnd
            ? (fire.dirX > 0 ? C.S_FIRE_END_R : C.S_FIRE_END_L)
            : C.S_FIRE_H;
          NS.sprites.drawSprite(s, fx, fy);
        } else {
          // Vertical: rotate horizontal pieces 90° CW
          const s = fire.isEnd ? C.S_FIRE_END_R : C.S_FIRE_H;
          D.ctx.translate(fcx, fcy);
          D.ctx.rotate(fire.dirY > 0 ? Math.PI / 2 : -Math.PI / 2);
          D.ctx.drawImage(D.spriteSheet, s.x, s.y, C.SP, C.SP, -C.TILE_SIZE / 2, -C.TILE_SIZE / 2, C.TILE_SIZE, C.TILE_SIZE);
        }
      } else {
        // Fallback: animated gradient
        const radius = (C.TILE_SIZE / 2 - 2) * Math.min(1, progress * 1.5);
        const pulseGlow = 0.7 + 0.3 * Math.sin(fire.timer * 12);
        D.ctx.globalAlpha = Math.min(1, progress * 1.8) * pulseGlow;
        const grad = D.ctx.createRadialGradient(fcx, fcy, 0, fcx, fcy, radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.25, '#ffee58');
        grad.addColorStop(0.5, '#ff9800');
        grad.addColorStop(0.8, '#ff4500');
        grad.addColorStop(1, 'rgba(255,0,0,0)');
        D.ctx.fillStyle = grad;
        D.ctx.beginPath();
        D.ctx.arc(fcx, fcy, radius, 0, Math.PI * 2);
        D.ctx.fill();
      }
      D.ctx.restore();
    }

    // Draw enemies
    for (const e of S.enemies) {
      if (!e.alive)
        continue;

      const typeDef = T.getEnemyTypeDef(e.type);
      const er = C.TILE_SIZE / 3;

      D.ctx.save();

      // Ghost phasing: reduced alpha + pulsing glow
      if (e.type === 'ghost' && e.phasing) {
        D.ctx.globalAlpha = 0.3 + 0.1 * Math.sin(Date.now() / 150);
        D.ctx.shadowColor = '#a29bfe';
        D.ctx.shadowBlur = 12 + 4 * Math.sin(Date.now() / 200);
      } else {
        D.ctx.shadowColor = typeDef.color;
        D.ctx.shadowBlur = 6;
      }

      if (S.spritesReady >= 1 && e.hitTimer <= 0) {
        // Character shadow
        D.ctx.save();
        D.ctx.shadowBlur = 0;
        D.ctx.fillStyle = 'rgba(0,0,0,0.25)';
        D.ctx.beginPath();
        D.ctx.ellipse(e.x, e.y + C.TILE_SIZE * 0.35, C.TILE_SIZE * 0.28, C.TILE_SIZE * 0.1, 0, 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.restore();
        // Sprite (different character row per enemy type)
        // Facing 2 (left) uses the right-facing sprite horizontally flipped
        const eAllFrames = C.S_ENEMY_ROWS[e.type] || C.S_ENEMY_ROWS.normal;
        const eDirFrames = eAllFrames[e.facing];
        const s = e.moveProgress > 0 ? eDirFrames.walk[e.walkFrame] : eDirFrames.stand;
        if (e.facing === 2)
          NS.sprites.drawSpriteFlippedH(s, e.x - C.TILE_SIZE / 2, e.y - C.TILE_SIZE / 2);
        else
          NS.sprites.drawSprite(s, e.x - C.TILE_SIZE / 2, e.y - C.TILE_SIZE / 2);
      } else {
        // Hit flash or fallback
        D.ctx.fillStyle = (e.hitTimer > 0) ? '#fff' : typeDef.color;
        D.ctx.beginPath();
        D.ctx.arc(e.x, e.y, er, 0, Math.PI * 2);
        D.ctx.fill();
        // Eyes
        D.ctx.fillStyle = '#fff';
        D.ctx.beginPath();
        D.ctx.arc(e.x - 4, e.y - 3, 3, 0, Math.PI * 2);
        D.ctx.arc(e.x + 4, e.y - 3, 3, 0, Math.PI * 2);
        D.ctx.fill();
        D.ctx.fillStyle = '#000';
        D.ctx.beginPath();
        D.ctx.arc(e.x - 3, e.y - 3, 1.5, 0, Math.PI * 2);
        D.ctx.arc(e.x + 5, e.y - 3, 1.5, 0, Math.PI * 2);
        D.ctx.fill();
      }

      // Climber visual: 4 small leg dots
      if (e.type === 'climber') {
        D.ctx.fillStyle = '#1a9c56';
        for (const d of C.DIRS) {
          D.ctx.beginPath();
          D.ctx.arc(e.x + d.dx * (er + 3), e.y + d.dy * (er + 3), 2.5, 0, Math.PI * 2);
          D.ctx.fill();
        }
      }

      // Chaser visual: angry eyebrows
      if (e.type === 'chaser') {
        D.ctx.strokeStyle = '#000';
        D.ctx.lineWidth = 1.5;
        D.ctx.beginPath();
        D.ctx.moveTo(e.x - 7, e.y - 8);
        D.ctx.lineTo(e.x - 2, e.y - 6);
        D.ctx.moveTo(e.x + 7, e.y - 8);
        D.ctx.lineTo(e.x + 2, e.y - 6);
        D.ctx.stroke();
      }

      // Tank HP pips
      if (e.type === 'tank' && e.maxHp > 1) {
        const pipY = e.y + er + 5;
        const pipSpacing = 6;
        const startX = e.x - (e.maxHp - 1) * pipSpacing / 2;
        for (let p = 0; p < e.maxHp; ++p) {
          D.ctx.fillStyle = p < e.hp ? '#fff' : '#444';
          D.ctx.beginPath();
          D.ctx.arc(startX + p * pipSpacing, pipY, 2, 0, Math.PI * 2);
          D.ctx.fill();
        }
      }

      D.ctx.restore();
    }

    // Draw player
    D.ctx.save();
    D.ctx.shadowColor = '#4ec0ca';
    D.ctx.shadowBlur = 8;
    if (S.spritesReady >= 1) {
      // Character shadow
      D.ctx.save();
      D.ctx.shadowBlur = 0;
      D.ctx.fillStyle = 'rgba(0,0,0,0.25)';
      D.ctx.beginPath();
      D.ctx.ellipse(S.player.x, S.player.y + C.TILE_SIZE * 0.35, C.TILE_SIZE * 0.28, C.TILE_SIZE * 0.1, 0, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.restore();
      // Player sprite — facing 2 (left) uses the right-facing sprite flipped
      const pFrames = C.S_PLAYER[S.player.facing];
      const s = S.player.moveProgress > 0 ? pFrames.walk[S.player.walkFrame] : pFrames.stand;
      if (S.player.facing === 2)
        NS.sprites.drawSpriteFlippedH(s, S.player.x - C.TILE_SIZE / 2, S.player.y - C.TILE_SIZE / 2);
      else
        NS.sprites.drawSprite(s, S.player.x - C.TILE_SIZE / 2, S.player.y - C.TILE_SIZE / 2);
    } else {
      D.ctx.fillStyle = '#4ec0ca';
      D.ctx.beginPath();
      D.ctx.arc(S.player.x, S.player.y, C.TILE_SIZE / 3, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.fillStyle = '#fff';
      D.ctx.beginPath();
      D.ctx.arc(S.player.x - 4, S.player.y - 3, 3, 0, Math.PI * 2);
      D.ctx.arc(S.player.x + 4, S.player.y - 3, 3, 0, Math.PI * 2);
      D.ctx.fill();
      D.ctx.fillStyle = '#000';
      D.ctx.beginPath();
      D.ctx.arc(S.player.x - 3, S.player.y - 3, 1.5, 0, Math.PI * 2);
      D.ctx.arc(S.player.x + 5, S.player.y - 3, 1.5, 0, Math.PI * 2);
      D.ctx.fill();
    }
    D.ctx.restore();

    // Particles + floating text
    D.particles.draw(D.ctx);
    D.floatingText.draw(D.ctx);

    D.screenShake.restore(D.ctx);

    // HUD overlay
    if (S.state === C.STATE_READY) {
      D.ctx.save();
      D.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      D.ctx.fillRect(0, 0, w, h);
      D.ctx.font = 'bold 28px sans-serif';
      D.ctx.textAlign = 'center';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillStyle = '#fff';
      D.ctx.fillText('BOMBERMAN', w / 2, h * 0.35);
      D.ctx.font = '16px sans-serif';
      D.ctx.fillText('Tap or press Space to Start', w / 2, h * 0.5);
      D.ctx.fillText('Arrows/WASD: Move | Space: Bomb', w / 2, h * 0.6);
      D.ctx.restore();
    }

    if (S.state === C.STATE_PAUSED) {
      D.ctx.save();
      D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      D.ctx.fillRect(0, 0, w, h);
      D.ctx.font = 'bold 32px sans-serif';
      D.ctx.textAlign = 'center';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillStyle = '#fff';
      D.ctx.fillText('PAUSED', w / 2, h / 2);
      D.ctx.restore();
    }

    if (S.state === C.STATE_DEAD) {
      D.ctx.save();
      D.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      D.ctx.fillRect(0, 0, w, h);
      D.ctx.font = 'bold 32px sans-serif';
      D.ctx.textAlign = 'center';
      D.ctx.fillStyle = '#f44';
      D.ctx.fillText('GAME OVER', w / 2, h * 0.35);
      D.ctx.font = '18px sans-serif';
      D.ctx.fillStyle = '#fff';
      D.ctx.fillText('Score: ' + S.score, w / 2, h * 0.45);
      D.ctx.fillText('Level: ' + S.currentLevel, w / 2, h * 0.5);
      D.ctx.font = '14px sans-serif';
      D.ctx.fillText('Tap or press Space to Restart', w / 2, h * 0.6);
      D.ctx.restore();
    }

    D.ctx.restore();

    if (S.showTutorial)
      NS.tutorial.drawTutorialOverlay();
  };
})();
