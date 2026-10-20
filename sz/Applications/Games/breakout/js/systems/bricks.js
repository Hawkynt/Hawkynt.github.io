/* Bricks: building the layout from the level data and the hit handling with combo
   scoring, brick-type effects and power-up drops. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const FX = NS.effects;

  /* ---- Level Loading ---- */
  function loadLevel(levelNum) {
    const def = SZ.BreakoutLevels.getLevel(levelNum);
    const srcCols = def.grid[0] ? def.grid[0].length : 10;
    const grid = [];

    /* Map source grid columns to target BRICK_COLS */
    for (let r = 0; r < def.grid.length; ++r)
      for (let tc = 0; tc < S.BRICK_COLS; ++tc) {
        const sc = tc % srcCols;
        const cell = def.grid[r][sc];
        if (cell === 0)
          continue;

        const brick = {
          x: S.BRICK_OFFSET_LEFT + tc * (C.BRICK_WIDTH + C.BRICK_PADDING),
          y: C.BRICK_OFFSET_TOP + r * (C.BRICK_HEIGHT + C.BRICK_PADDING),
          width: C.BRICK_WIDTH,
          height: C.BRICK_HEIGHT,
          alive: true,
          type: 'normal',
          hp: 1,
          entryDelay: r * 60 + tc * 15,
          entryProgress: 0,
          glareOffset: Math.random() * 3000
        };

        if (cell === 'G') {
          brick.type = 'glass';
          brick.color = '#aaddff';
          brick.score = 30;
        } else if (cell === 'S') {
          brick.type = 'steel';
          brick.color = '#999';
          brick.score = 60;
          brick.hp = 2;
        } else if (cell === 'X') {
          brick.type = 'indestructible';
          brick.color = '#444';
          brick.score = 0;
        } else {
          const idx = (typeof cell === 'number' ? cell - 1 : r) % C.BRICK_COLORS.length;
          brick.color = C.BRICK_COLORS[idx];
          brick.score = C.BRICK_SCORES[idx];
        }

        grid.push(brick);
      }
    return grid;
  }

  function hitBrick(brick, ball) {
    if (brick.type === 'indestructible') {
      FX.particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 4, { color: '#888' });
      SZ.GameAudio.play('click', { pitch: 0.6 });
      return;
    }

    --brick.hp;
    if (brick.hp <= 0) {
      brick.alive = false;
      S.score += brick.score;

      ++S.comboCount;
      S.comboTimer = 60;
      if (S.comboCount >= 2)
        FX.floatingText.add(brick.x + brick.width / 2, brick.y, 'x' + S.comboCount + '!', {
          color: S.comboCount >= 5 ? '#f44' : S.comboCount >= 3 ? '#ff0' : '#4ff',
          font: 'bold ' + Math.min(14 + S.comboCount * 2, 28) + 'px sans-serif',
          decay: 0.025,
          vy: -1.2
        });

      S.score += Math.max(0, (S.comboCount - 1)) * 10;
      SZ.GameAudio.play(brick.type === 'glass' ? 'zap' : 'blip', { pitch: Math.min(1 + (S.comboCount - 1) * 0.08, 2) });

      if (brick.type === 'glass') {
        FX.particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 20, {
          color: '#cef', speed: 4, gravity: 0.04, life: 0.6, size: 2, shape: 'square'
        });
        FX.particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 8, { color: '#fff' });
      } else if (brick.type === 'steel') {
        FX.particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 18, {
          color: '#ccc', speed: 3.5, gravity: 0.06, life: 0.6, size: 3
        });
        FX.particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 6, { color: '#ff0' });
      } else {
        FX.particles.burst(brick.x + brick.width / 2, brick.y + brick.height / 2, 22, {
          color: brick.color, speed: 3.5, gravity: 0.05, life: 0.7, size: 3
        });
      }

      NS.powerups.maybeSpawnPowerUp(brick);
    } else {
      FX.particles.sparkle(brick.x + brick.width / 2, brick.y + brick.height / 2, 5, { color: '#ff0' });
      FX.screenShake.trigger(2, 100);
      SZ.GameAudio.play('hit', { pitch: 1.4, volume: 0.7 });
    }
    NS.game.updateStatus();
  }

  Object.assign(NS.bricks, { loadLevel, hitBrick });
})();
