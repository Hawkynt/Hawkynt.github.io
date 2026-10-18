/* Hit tests of one simulation step in fixed order: player bullets vs aliens, UFO, boss and bunkers,
   alien bullets vs bunkers and ship, the fleet reaching the ship row. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, BOSS_W, BOSS_H } = NS.constants;
  const { rectsOverlap } = NS.data;
  const { playSfx } = NS.audio;
  const { bulletDamage } = NS.progress;
  const { particles, floatingText, addFlare, addRing, playerDeathFx, triggerFlash } = NS.fx;
  const { spawnPowerup } = NS.powerups;
  const { damageBoss } = NS.boss;
  const { killPlayer, destroyAlien } = NS.combat;

  /* All hit tests of one step, in a fixed order */
  function resolveCollisions() {
    collidePlayerBullets();
    collidePlayerBulletsWithBunkers();
    collideAlienBulletsWithBunkers();
    collideAlienBulletsWithPlayer();
    checkFleetLanded();
  }

  function collidePlayerBullets() {
    // Collision: player bullets vs aliens
    for (let bi = G.playerBullets.length - 1; bi >= 0; --bi) {
      const b = G.playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let hitSomething = false;

      for (const a of G.aliens) {
        if (!a.alive) continue;
        if (!rectsOverlap(b.x, b.y, bw, bh, a.x, a.y, a.w, a.h)) continue;

        if (a.shielded && a.shieldHP > 0) {
          --a.shieldHP;
          if (a.shieldHP <= 0) a.shielded = false;
          a.flash = 0.08;
          particles.sparkle(a.x + a.w / 2, a.y + a.h / 2, 8, { color: '#4ff' });
          particles.burst(b.x + bw / 2, b.y + bh / 2, 4, { speed: 2.5, color: '#ffd23f', size: 1.5, life: 0.25 });
          playSfx('click', { pitch: 0.7 });
          if (!b.piercing) {
            G.playerBullets.splice(bi, 1);
            hitSomething = true;
            break;
          }
          continue;
        }

        a.hp -= bulletDamage();
        if (a.hp > 0) {
          a.flash = 0.08;
          playSfx('hit', { pitch: 1.2, volume: 0.5 });
          particles.burst(b.x + bw / 2, b.y + bh / 2, 4, { speed: 2.5, color: '#ffd23f', size: 1.5, life: 0.25 });
          if (!b.piercing) {
            G.playerBullets.splice(bi, 1);
            hitSomething = true;
            break;
          }
          continue;
        }

        destroyAlien(a);

        if (!b.piercing) {
          G.playerBullets.splice(bi, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Player bullets vs UFO
      if (G.ufo && rectsOverlap(b.x, b.y, bw, bh, G.ufo.x, G.ufo.y, G.ufo.w, G.ufo.h)) {
        G.score += G.ufo.points;
        playSfx('explode', { pitch: 1.4, volume: 0.7 });
        playSfx('coin');
        addFlare(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, 'purple', 80, 0.4);
        addRing(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, '#ffd23f', 8, 70, 0.35);
        particles.burst(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, 20, {
          speed: 4,
          color: '#f0f',
          gravity: 0.03,
        });
        particles.sparkle(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2, 14, { color: '#ffd23f' });
        floatingText.add(G.ufo.x + G.ufo.w / 2, G.ufo.y, '+' + G.ufo.points, {
          color: '#ffd23f',
          font: 'bold 30px sans-serif',
        });
        spawnPowerup(G.ufo.x + G.ufo.w / 2, G.ufo.y + G.ufo.h / 2);
        G.ufo = null;
        if (!b.piercing)
          G.playerBullets.splice(bi, 1);
        continue;
      }

      // Player bullets vs boss
      if (G.bossActive && G.boss && rectsOverlap(b.x, b.y, bw, bh, G.boss.x, G.boss.y, BOSS_W, BOSS_H)) {
        damageBoss(bulletDamage());
        if (!b.piercing)
          G.playerBullets.splice(bi, 1);
        continue;
      }
    }
  }

  function collidePlayerBulletsWithBunkers() {
    // Player bullets vs shields
    for (let bi = G.playerBullets.length - 1; bi >= 0; --bi) {
      if (G.playerBullets[bi].piercing) continue;
      const b = G.playerBullets[bi];
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      let destroyed = false;
      for (const shieldBlocks of G.shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, bw, bh, s.x, s.y, s.w, s.h)) {
            --s.hp;
            if (s.hp <= 0) s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            playSfx('thud', { volume: 0.25 });
            G.playerBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }
  }

  function collideAlienBulletsWithBunkers() {
    // Alien bullets vs shields
    for (let bi = G.alienBullets.length - 1; bi >= 0; --bi) {
      const b = G.alienBullets[bi];
      let destroyed = false;
      for (const shieldBlocks of G.shields) {
        for (let si = shieldBlocks.length - 1; si >= 0; --si) {
          const s = shieldBlocks[si];
          if (s.alive && rectsOverlap(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) {
            --s.hp;
            if (s.hp <= 0) s.alive = false;
            particles.burst(s.x + s.w / 2, s.y + s.h / 2, 3, {
              speed: 1.5,
              color: '#0a0',
              size: 2,
              life: 0.3,
            });
            playSfx('thud', { volume: 0.25 });
            G.alienBullets.splice(bi, 1);
            destroyed = true;
            break;
          }
        }
        if (destroyed) break;
      }
    }
  }

  function collideAlienBulletsWithPlayer() {
    // Alien bullets vs player
    if (G.player.alive) {
      for (let bi = G.alienBullets.length - 1; bi >= 0; --bi) {
        const b = G.alienBullets[bi];
        if (rectsOverlap(b.x, b.y, b.w, b.h, G.player.x, G.player.y, PLAYER_W, PLAYER_H)) {
          G.alienBullets.splice(bi, 1);
          killPlayer();
          break;
        }
      }
    }
  }

  function checkFleetLanded() {
    // Aliens reaching player row (instant game over, shield cannot save this)
    for (const a of G.aliens) {
      if (a.alive && !a.diving && a.y + a.h >= G.player.y) {
        if (G.activePowerups.shield > 0)
          delete G.activePowerups.shield;
        G.player.alive = false;
        G.lives = 0;
        ++G.livesLost;
        G.deathTimer = 2000;
        G.gameState = 'dying';
        playerDeathFx();
        particles.burst(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, 30, {
          speed: 5, color: '#f80', gravity: 0.08, size: 4,
        });
        triggerFlash('#f44', 0.3);
        playSfx('explode');
        break;
      }
    }
  }

  Object.assign(NS.collisions, {
    resolveCollisions
  });
})();
