;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.boss.startBossIntro = function startBossIntro() {
    S.bossWarningTimer = C.BOSS_WARNING_DURATION;
    S.gameState = 'bossIntro';
    SZ.GameAudio.play('lose', { pitch: 0.6, volume: 0.7 });

    /* Prepare S.maze for S.boss fight */
    S.maze = NS.maze.cloneMaze();
    S.totalDots = NS.maze.countDots(S.maze);
    S.dotsEaten = 0;
    S.fruitActive = false;
    S.fruitTimer = 0;
    S.fruitShown = 0;
    NS.flow.resetPositions();

    S.pacman.speed = 2 * S.levelConfig.pac;
    for (const g of S.ghosts)
      g.speed = 1.5 * S.levelConfig.ghost;

    /* Create S.boss */
    const bossIndex = Math.floor((S.level - 1) / C.BOSS_EVERY) % T.BOSS_TYPES.length;
    const bossNum = Math.floor((S.level - 1) / C.BOSS_EVERY) + 1;
    S.boss = {
      x: C.CANVAS_W / 2,
      y: 6 * C.TILE,
      hp: C.BOSS_BASE_HP + (bossNum - 1) * C.BOSS_HP_PER_BOSS,
      maxHp: C.BOSS_BASE_HP + (bossNum - 1) * C.BOSS_HP_PER_BOSS,
      speed: C.BOSS_SPEED_BASE,
      type: T.BOSS_TYPES[bossIndex],
      bossNumber: bossNum,
      vulnerable: false,
      stunned: false,
      stunTimer: 0,
      vulnerableTimer: 0,
      invulnTimer: 0,
      abilityTimer: 5000,
      abilityCD: 5000,
      phase2: false
    };
    S.bossActive = true;
    S.bossMinions = [];

    /* Reset powerup state */
    S.fieldPowerup = null;
    S.activePowerups = [];
    S.scoreMultiplier = 1;
    S.pacmanPhasing = false;
    S.ghostsFrozen = false;
    S.pacmanSlowed = false;
    S.pacmanSlowTimer = 0;
  }

  NS.boss.updateBoss = function updateBoss(dt) {
    if (!S.boss)
      return;

    const ms = dt * 1000;

    /* Invulnerability cooldown */
    if (S.boss.invulnTimer > 0)
      S.boss.invulnTimer -= ms;

    /* Stun timer */
    if (S.boss.stunned) {
      S.boss.stunTimer -= ms;
      if (S.boss.stunTimer <= 0) {
        S.boss.stunned = false;
        S.boss.vulnerable = false;
      }
    }

    /* Vulnerability timer */
    if (S.boss.vulnerable) {
      S.boss.vulnerableTimer -= ms;
      if (S.boss.vulnerableTimer <= 0)
        S.boss.vulnerable = false;
    }

    /* Don't move when stunned */
    if (S.boss.stunned) {
      NS.boss.updateBossMinions(dt);
      return;
    }

    /* Ability timer */
    S.boss.abilityTimer -= ms;
    if (S.boss.abilityTimer <= 0) {
      NS.boss.useBossAbility();
      S.boss.stunned = true;
      S.boss.stunTimer = 1500;
      S.boss.abilityTimer = S.boss.phase2 ? S.boss.abilityCD * 0.7 : S.boss.abilityCD;
    }

    /* Movement: gravitate toward Pac-Man */
    const dx = S.pacman.x - S.boss.x;
    const dy = S.pacman.y - S.boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      const spd = S.boss.speed * (S.boss.phase2 ? 1.3 : 1.0);
      S.boss.x += nx * spd * (60 * dt);
      S.boss.y += ny * spd * (60 * dt);
    }

    /* Clamp to S.maze bounds */
    const halfSize = C.TILE * C.BOSS_SIZE / 2;
    S.boss.x = Math.max(halfSize, Math.min(C.CANVAS_W - halfSize, S.boss.x));
    S.boss.y = Math.max(halfSize + 2 * C.TILE, Math.min(C.CANVAS_H - halfSize - C.TILE, S.boss.y));

    NS.boss.updateBossMinions(dt);
  }

  NS.boss.updateBossMinions = function updateBossMinions(dt) {
    for (let i = S.bossMinions.length - 1; i >= 0; --i) {
      const m = S.bossMinions[i];
      const mdx = S.pacman.x - m.x;
      const mdy = S.pacman.y - m.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist > 1) {
        m.x += (mdx / mdist) * 1.5 * (60 * dt);
        m.y += (mdy / mdist) * 1.5 * (60 * dt);
      }
      m.life -= dt * 1000;
      if (m.life <= 0)
        S.bossMinions.splice(i, 1);
    }
  }

  NS.boss.useBossAbility = function useBossAbility() {
    switch (S.boss.type.ability) {
      case 'summon':
        for (let i = 0; i < 2; ++i) {
          S.bossMinions.push({
            x: S.boss.x + (Math.random() - 0.5) * C.TILE * 2,
            y: S.boss.y + (Math.random() - 0.5) * C.TILE * 2,
            color: S.boss.type.color,
            life: 8000
          });
        }
        break;
      case 'teleport':
        S.boss.x = (4 + Math.random() * (C.COLS - 8)) * C.TILE;
        S.boss.y = (4 + Math.random() * (C.ROWS - 8)) * C.TILE;
        E.particles.burst(S.boss.x, S.boss.y, 20, { color: S.boss.type.color, speed: 4 });
        break;
      case 'freeze':
        S.pacmanSlowed = true;
        S.pacmanSlowTimer = 3000;
        break;
      case 'split':
        for (let i = 0; i < 2; ++i) {
          S.bossMinions.push({
            x: S.boss.x + (i === 0 ? -C.TILE * 2 : C.TILE * 2),
            y: S.boss.y,
            color: S.boss.type.color,
            life: 6000
          });
        }
        break;
    }

    SZ.GameAudio.play('whoosh', { pitch: 0.7 });
    E.particles.burst(S.boss.x, S.boss.y, 15, { color: S.boss.type.color, speed: 3 });
    E.floatingText.add(S.boss.x, S.boss.y - C.TILE, S.boss.type.ability.toUpperCase() + '!', {
      color: S.boss.type.color, font: 'bold 14px sans-serif'
    });
  }

  NS.boss.checkBossCollision = function checkBossCollision() {
    if (!S.bossActive || !S.boss)
      return;

    const dist = NS.movement.distance(S.pacman.x, S.pacman.y, S.boss.x, S.boss.y);
    const hitDist = C.TILE * C.BOSS_SIZE / 2 + C.TILE / 2;

    if (dist < hitDist) {
      if (S.boss.vulnerable && S.boss.invulnTimer <= 0)
        NS.boss.damageBoss();
      else if (!S.boss.vulnerable && !S.boss.stunned)
        NS.flow.startDying();
    }

    /* Check minions */
    for (const m of S.bossMinions) {
      const mdist = NS.movement.distance(S.pacman.x, S.pacman.y, m.x, m.y);
      if (mdist < C.TILE * 0.8) {
        if (S.frightenedTimer > 0) {
          m.life = 0;
          S.score += 200 * S.scoreMultiplier;
          SZ.GameAudio.play('smallExplode');
          E.particles.burst(m.x, m.y, 10, { color: m.color, speed: 3 });
        } else {
          NS.flow.startDying();
          return;
        }
      }
    }
  }

  NS.boss.damageBoss = function damageBoss() {
    --S.boss.hp;
    S.boss.invulnTimer = 2000;
    S.boss.vulnerable = false;

    E.screenShake.trigger(6, 300);
    SZ.GameAudio.play('hit');
    E.particles.burst(S.boss.x, S.boss.y, 30, { color: '#FFFFFF', speed: 5 });
    E.floatingText.add(S.boss.x, S.boss.y, '-1 HP', { color: '#FF4444', font: 'bold 16px sans-serif' });

    if (S.boss.hp <= S.boss.maxHp / 2 && !S.boss.phase2) {
      S.boss.phase2 = true;
      E.floatingText.add(S.boss.x, S.boss.y - 20, 'PHASE 2!', { color: '#FF0000', font: 'bold 18px sans-serif' });
    }

    if (S.boss.hp <= 0)
      NS.boss.defeatBoss();
  }

  NS.boss.defeatBoss = function defeatBoss() {
    const pts = 5000 * S.boss.bossNumber;
    S.score += pts * S.scoreMultiplier;

    E.screenShake.trigger(12, 800);
    SZ.GameAudio.play('explode');
    SZ.GameAudio.play('win');
    E.particles.burst(S.boss.x, S.boss.y, 60, { color: S.boss.type.color, speed: 6, gravity: 0.03, life: 1 });
    E.particles.confetti(S.boss.x, S.boss.y, 40);
    E.floatingText.add(S.boss.x, S.boss.y, String(pts), { color: '#FFD700', font: 'bold 20px sans-serif', decay: 0.008 });

    S.bossActive = false;
    S.boss = null;
    S.bossMinions = [];

    S.gameState = 'bossVictory';
    S.bossVictoryTimer = C.BOSS_VICTORY_DURATION;
    NS.status.updateStatus();
  }

})();
