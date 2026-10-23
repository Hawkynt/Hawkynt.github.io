/* Damage and consequences: fire hitting player, enemies and power-ups, the
   player death and respawn, enemy kills and the level advance. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const X = NS.damage = NS.damage || {};

  /* ── Check fire damage ── */
  X.checkFireDamage = function checkFireDamage() {
    for (const fire of S.fireCells) {
      // Check player hit by fire/explosion
      if (fire.col === S.player.col && fire.row === S.player.row && S.player.moveProgress === 0) {
        X.playerHitByExplosion();
        if (S.state === C.STATE_DEAD)
          return;
      }

      // Check enemy killed by explosion/fire
      for (let i = S.enemies.length - 1; i >= 0; --i) {
        const e = S.enemies[i];
        if (e.col === fire.col && e.row === fire.row && e.alive) {
          X.enemyKilledByExplosion(e, i);
        }
      }

      // Check powerup destroyed by explosion/fire
      for (let i = S.powerUps.length - 1; i >= 0; --i) {
        const pu = S.powerUps[i];
        if (pu.col === fire.col && pu.row === fire.row) {
          const px = pu.col * C.TILE_SIZE + C.TILE_SIZE / 2;
          const py = pu.row * C.TILE_SIZE + C.TILE_SIZE / 2;
          const entry = T.powerUpEntry(pu.type);

          // Destruction particles: colored burst matching the powerup
          D.particles.burst(px, py, 12, { color: entry.color, speed: 4, life: 0.5, size: 2, decay: 0.03 });
          D.particles.sparkle(px, py, 6, { color: '#fff', speed: 3, life: 0.3 });

          // Flash text showing what was destroyed
          D.floatingText.add(px, py, pu.type.replace('_', ' ').toUpperCase(), { color: '#f44', decay: 0.03 });
          SZ.GameAudio.play('error', { volume: 0.6 });

          S.powerUps.splice(i, 1);
        }
      }
    }
  };

  /* ── Player hit by explosion ── */
  X.playerHitByExplosion = function playerHitByExplosion() {
    --S.lives;

    // Death particle burst for player
    D.particles.burst(
      S.player.col * C.TILE_SIZE + C.TILE_SIZE / 2,
      S.player.row * C.TILE_SIZE + C.TILE_SIZE / 2,
      20,
      { color: '#ff0', speed: 5, life: 0.8, size: 3, decay: 0.02 }
    );
    D.screenShake.trigger(10, 400);

    if (S.lives <= 0) {
      S.state = C.STATE_DEAD;
      SZ.GameAudio.play('lose');
      NS.highscores.addHighScore(S.score, S.currentLevel);
      SZ.Dlls.User32.SetWindowText('Bomberman — Game Over');
    } else {
      SZ.GameAudio.play('hurt');
      NS.arena.resetPlayerPosition();
    }
    NS.flow.updateStatus();
  };

  /* ── Enemy killed by explosion ── */
  X.enemyKilledByExplosion = function enemyKilledByExplosion(enemy, idx) {
    --enemy.hp;

    if (enemy.hp > 0) {
      // Hit but alive — flash + small burst + HP indicator
      enemy.hitTimer = 0.15;
      D.particles.burst(enemy.x, enemy.y, 8, { color: '#fff', speed: 3, life: 0.3, size: 2, decay: 0.04 });
      D.floatingText.add(enemy.x, enemy.y, 'HP ' + enemy.hp, { color: '#ff6b6b', decay: 0.04 });
      SZ.GameAudio.play('hit');
      D.screenShake.trigger(4, 100);
      return;
    }

    // Dead — remove
    enemy.alive = false;
    S.enemies.splice(idx, 1);

    const typeDef = T.getEnemyTypeDef(enemy.type);
    const points = enemy.type === 'tank'
      ? typeDef.points * enemy.maxHp * S.currentLevel
      : typeDef.points * S.currentLevel;
    S.score += points;

    // Death particle burst for enemy destruction
    D.particles.burst(enemy.x, enemy.y, 15, { color: typeDef.color, speed: 4, life: 0.6, size: 3, decay: 0.02 });

    // Floating score text for enemy kill
    D.floatingText.add(enemy.x, enemy.y, '+' + points, { color: '#ffd700', decay: 0.025 });
    SZ.GameAudio.play('coin');

    // Check if level clear — all enemies defeated
    if (S.enemies.length === 0)
      X.levelComplete();

    NS.flow.updateStatus();
  };

  /* ── Level Complete ── */
  X.levelComplete = function levelComplete() {
    ++S.currentLevel;
    SZ.GameAudio.play('levelup');
    D.floatingText.add(
      C.COLS * C.TILE_SIZE / 2,
      C.ROWS * C.TILE_SIZE / 2,
      'LEVEL ' + S.currentLevel,
      { color: '#fff', decay: 0.015 }
    );
    // Advance to next level
    NS.arena.generateArena(S.currentLevel);
    NS.arena.spawnEnemies(S.currentLevel);
    NS.arena.resetPlayerPosition();
    S.bombs = [];
    S.fireCells = [];
    S.powerUps = [];
    SZ.Dlls.User32.SetWindowText('Bomberman — Level ' + S.currentLevel);
  };
})();
