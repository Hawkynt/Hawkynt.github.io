/* Boss fights: entrance, movement, enrage, attack patterns, damage and the defeat cascade.
   Owns G.boss and the boss timers; writes G.alienBullets, G.score, G.gameState. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    GAME_W, GAME_H, PLAYER_W, ALIEN_BULLET_W, ALIEN_BULLET_H, BOSS_W, BOSS_H
  } = NS.constants;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;
  const { particles, shake, floatingText, addFlare, addRing } = NS.fx;
  const { addSpecialCharge } = NS.special;
  const { spawnPowerup } = NS.powerups;

  function updateBoss(dt) {
    if (!G.boss || !G.bossActive) return;

    if (G.boss.flash > 0)
      G.boss.flash = Math.max(0, G.boss.flash - dt / 1000);

    if (G.gameState === 'bossIntro') {
      G.bossWarningTimer -= dt;
      /* three low warning klaxons across the 2 s entrance */
      if (G.bossWarnBeats < 3 && G.bossWarningTimer <= 2000 - G.bossWarnBeats * 650) {
        ++G.bossWarnBeats;
        playSfx('hurt', { pitch: 0.5 });
      }
      G.bossDescendY += (G.boss.targetY - G.bossDescendY) * 0.03;
      G.boss.y = G.bossDescendY;
      if (G.bossWarningTimer <= 0) {
        G.boss.y = G.boss.targetY;
        G.gameState = 'playing';
        shake.trigger(2, 300);
      }
      return;
    }

    G.boss.movePhase += G.boss.moveSpeed * dt * 0.001;
    G.boss.x = GAME_W / 2 + Math.sin(G.boss.movePhase) * (GAME_W / 2 - BOSS_W / 2 - 30) - BOSS_W / 2;

    const phase2 = G.boss.hp <= G.boss.maxHp / 2;
    if (phase2) {
      G.boss.moveSpeed = 2.5;
      G.boss.attackInterval = 1200;
      if (G.boss.patterns.length === 3)
        G.boss.patterns.push('spiral');
      if (!G.boss.enraged) {
        G.boss.enraged = true;
        const ecx = G.boss.x + BOSS_W / 2, ecy = G.boss.y + BOSS_H / 2;
        addFlare(ecx, ecy, 'orange', 120, 0.45);
        addRing(ecx, ecy, '#ff4a5a', 10, 150, 0.4);
        floatingText.add(ecx, ecy - 60, 'ENRAGED!', {
          color: '#ff4a5a',
          font: 'bold 30px sans-serif',
        });
        playSfx('explode', { pitch: 0.7 });
        shake.trigger(6, 300);
      }
    }

    G.boss.attackTimer += dt;
    if (G.boss.attackTimer >= G.boss.attackInterval) {
      G.boss.attackTimer = 0;
      bossAttack();
    }
  }

  function bossAttack() {
    if (!G.boss) return;
    const pattern = G.boss.patterns[G.boss.currentPattern % G.boss.patterns.length];
    playSfx('laser', { pitch: 0.6 });
    const bx = G.boss.x + BOSS_W / 2;
    const by = G.boss.y + BOSS_H;

    switch (pattern) {
      case 'spread':
        for (let i = -2; i <= 2; ++i) {
          const angle = Math.PI / 2 + i * 0.2;
          G.alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W + 1.5,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 3.75,
            vy: Math.sin(angle) * 3.75,
            bossBullet: true,
          });
        }
        break;
      case 'aimed': {
        const px = G.player.alive ? G.player.x + PLAYER_W / 2 : GAME_W / 2;
        const py = G.player.alive ? G.player.y : GAME_H - 60;
        const dx = px - bx;
        const dy = py - by;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        for (let i = -1; i <= 1; ++i)
          G.alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: nx * 5.25 + i * 0.9,
            vy: ny * 5.25,
            bossBullet: true,
          });
        break;
      }
      case 'rain':
        for (let i = 0; i < 7; ++i)
          G.alienBullets.push({
            x: G.boss.x + (i / 6) * BOSS_W,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: 0,
            vy: 3 + G.rand() * 2.25,
            bossBullet: true,
          });
        break;
      case 'spiral':
        for (let i = 0; i < 8; ++i) {
          const angle = (i / 8) * Math.PI * 2 + G.boss.movePhase;
          G.alienBullets.push({
            x: bx - ALIEN_BULLET_W / 2,
            y: by,
            w: ALIEN_BULLET_W,
            h: ALIEN_BULLET_H,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3 + 2.25,
            bossBullet: true,
          });
        }
        break;
    }
    ++G.boss.currentPattern;
  }

  function damageBoss(amount, fromSpecial) {
    if (!G.boss) return;
    G.boss.hp -= (amount === undefined ? 1 : amount);
    addSpecialCharge(1);
    G.boss.flash = 0.06;
    if (fromSpecial)
      G.hitStop = 0.05;
    playSfx('hit', { pitch: 1.4, volume: 0.4 });

    addFlare(G.boss.x + BOSS_W / 2, G.boss.y + BOSS_H / 2, 'white', 30, 0.12);

    particles.burst(G.boss.x + BOSS_W / 2, G.boss.y + BOSS_H / 2, 6, {
      speed: 2,
      color: '#ff0',
      size: 2,
      life: 0.3,
    });

    if (G.boss.hp <= 0)
      bossDeath();
  }

  function bossDeath() {
    ++G.save.stats.bosses;
    const bossScore = G.boss.maxHp * 100;
    G.score += bossScore;

    const bx = G.boss.x;
    const by = G.boss.y;

    /* 1.6 s cascade of explosions across the boss box, driven by the update loop */
    G.bossFinaleBox = { x: bx, y: by };
    G.bossFinale = 1.6;
    G.bossFinaleTick = 0;
    G.hitStop = 0.12;

    shake.trigger(12, 600);
    playSfx('explode', { pitch: 0.7 });
    playSfx('win');

    floatingText.add(bx + BOSS_W / 2, by, '+' + bossScore, {
      color: '#ff0',
      font: 'bold 33px sans-serif',
    });

    for (let i = 0; i < 3; ++i)
      spawnPowerup(
        bx + BOSS_W * (0.2 + i * 0.3),
        by + BOSS_H / 2
      );

    G.boss = null;
    G.bossActive = false;
    G.bossVictoryTimer = 2500;
    G.gameState = 'bossVictory';
    updateStatusBar();
  }

  Object.assign(NS.boss, {
    damageBoss, updateBoss
  });
})();
