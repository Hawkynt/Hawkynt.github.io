;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.collisions.checkDotEating = function checkDotEating() {
    const t = S.maze[S.pacman.tileY] && S.maze[S.pacman.tileY][S.pacman.tileX];
    if (t === C.T_DOT) {
      S.maze[S.pacman.tileY][S.pacman.tileX] = C.T_EMPTY;
      S.score += 10 * S.scoreMultiplier;
      ++S.dotsEaten;
      SZ.GameAudio.play('click', { pitch: S.dotsEaten % 2 ? 0.55 : 0.65, volume: 0.6 });

      /* Chain tracking */
      ++S.dotChainCount;
      S.dotChainTimer = C.DOT_CHAIN_WINDOW;

      const sparkleCount = Math.min(3 + Math.floor(S.dotChainCount / 5), 10);
      E.particles.sparkle(S.pacman.x, S.pacman.y, sparkleCount, { color: S.currentTheme.dotColor, speed: 1.5 });

      for (const thresh of C.DOT_CHAIN_THRESHOLDS) {
        if (S.dotChainCount === thresh) {
          SZ.GameAudio.play('coin');
          E.particles.confetti(S.pacman.x, S.pacman.y - 10, 15);
          E.floatingText.add(S.pacman.x, S.pacman.y - 15, S.dotChainCount + 'x CHAIN!', {
            color: '#FFD700', font: 'bold 14px sans-serif', decay: 0.012
          });
          break;
        }
      }

      NS.collisions.checkFruitAppearance();
      if (S.dotsEaten >= S.totalDots) {
        if (S.bossActive) {
          S.maze = NS.maze.cloneMaze();
          S.totalDots = NS.maze.countDots(S.maze);
          S.dotsEaten = 0;
          S.fruitShown = 0;
        } else {
          NS.flow.startLevelComplete();
        }
      }
    } else if (t === C.T_POWER) {
      S.maze[S.pacman.tileY][S.pacman.tileX] = C.T_EMPTY;
      S.score += 50 * S.scoreMultiplier;
      ++S.dotsEaten;
      NS.modes.enterFrightenedMode();
      SZ.GameAudio.play('powerup', { pitch: 0.8 });
      E.particles.sparkle(S.pacman.x, S.pacman.y, 6, { color: '#fff', speed: 2 });
      if (S.dotsEaten >= S.totalDots) {
        if (S.bossActive) {
          S.maze = NS.maze.cloneMaze();
          S.totalDots = NS.maze.countDots(S.maze);
          S.dotsEaten = 0;
          S.fruitShown = 0;
        } else {
          NS.flow.startLevelComplete();
        }
      }
    }
    NS.status.updateStatus();
  }

  NS.collisions.checkGhostCollisions = function checkGhostCollisions() {
    for (const g of S.ghosts) {
      if (g.inHouse)
        continue;

      const dist = NS.movement.distance(S.pacman.x, S.pacman.y, g.x, g.y);
      if (dist < C.TILE * 0.8) {
        if (g.mode === C.MODE_FRIGHTENED) {
          NS.collisions.eatGhost(g);
        } else if (g.mode !== C.MODE_EATEN) {
          NS.flow.startDying();
          return;
        }
      }
    }
  }

  NS.collisions.eatGhost = function eatGhost(ghost) {
    ghost.mode = C.MODE_EATEN;
    const pts = C.GHOST_EAT_POINTS[Math.min(S.ghostsEatenThisRound, 3)] * S.scoreMultiplier;
    S.score += pts;
    ++S.ghostsEatenThisRound;
    SZ.GameAudio.play('zap', { pitch: 0.75 + 0.25 * S.ghostsEatenThisRound });
    E.floatingText.add(ghost.x, ghost.y, String(pts), {
      color: '#00FFFF', font: 'bold 12px sans-serif', decay: 0.015
    });
    E.particles.burst(ghost.x, ghost.y, 25, { color: '#4488FF', speed: 3 });
    E.particles.confetti(ghost.x, ghost.y - 5, 10);
    E.screenShake.trigger(4, 200);

    S.electricArcs.push({
      x1: S.pacman.x, y1: S.pacman.y,
      x2: ghost.x, y2: ghost.y,
      life: 300
    });

    NS.status.updateStatus();
  }

  NS.collisions.checkFruitAppearance = function checkFruitAppearance() {
    if (S.fruitActive || S.fruitShown >= 2)
      return;
    if ((S.dotsEaten === 70 && S.fruitShown === 0) || (S.dotsEaten === 170 && S.fruitShown === 1)) {
      S.fruitActive = true;
      S.fruitTimer = 9000;
      ++S.fruitShown;
    }
  }

  NS.collisions.checkFruitCollision = function checkFruitCollision() {
    if (!S.fruitActive)
      return;
    const fx = T.FRUIT_POS.x * C.TILE + C.TILE / 2;
    const fy = T.FRUIT_POS.y * C.TILE + C.TILE / 2;
    const dist = NS.movement.distance(S.pacman.x, S.pacman.y, fx, fy);
    if (dist < C.TILE) {
      const fruitIndex = Math.min(S.level - 1, T.FRUIT_TABLE.length - 1);
      const fruit = T.FRUIT_TABLE[fruitIndex];
      S.score += fruit.pts * S.scoreMultiplier;
      S.fruitActive = false;
      SZ.GameAudio.play('pickup');
      E.floatingText.add(fx, fy, String(fruit.pts), {
        color: fruit.color, font: 'bold 12px sans-serif', decay: 0.012
      });
      E.particles.burst(fx, fy, 12, { color: fruit.color, speed: 2.5 });
      NS.status.updateStatus();
    }
  }

  NS.collisions.updateFruit = function updateFruit(dt) {
    if (!S.fruitActive)
      return;
    S.fruitTimer -= dt * 1000;
    if (S.fruitTimer <= 0)
      S.fruitActive = false;
  }

})();
