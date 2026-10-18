/* The player ship: movement from keys and mouse, tilt, engine trail, shooting and its bullets.
   Owns G.player, G.playerBullets, G.playerShootCooldown; reads input in G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    GAME_W, PLAYER_W, PLAYER_H, PLAYER_SPEED, BULLET_W, BULLET_H, BULLET_SPEED, LASER_W
  } = NS.constants;
  const { SHIP_DEFS } = NS.data;
  const { playSfx } = NS.audio;
  const { treeLevel, currentShipId } = NS.progress;
  const { particles, addFlare } = NS.fx;

  function updatePlayer(dt) {
    // Player movement
    if (G.player.alive) {
      const ship = SHIP_DEFS[currentShipId()];
      const moveSpeed = PLAYER_SPEED * ship.speed * (1 + 0.08 * treeLevel('e_speed'));

      if (G.dash) {
        G.dash.t += dt;
        G.player.x += G.dash.dir * 140 * dt / 120;
        G.player.x = Math.max(15, Math.min(GAME_W - 15 - PLAYER_W, G.player.x));
        particles.trail(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, {
          vy: 0,
          color: '#5af2ff',
          size: 2.5,
          life: 0.25,
        });
        if (G.dash.t >= 120)
          G.dash = null;
      }

      let tiltDir = 0;
      if (G.keys['ArrowLeft'] || G.keys['KeyA']) {
        G.player.x = Math.max(15, G.player.x - moveSpeed);
        tiltDir = -1;
      }
      if (G.keys['ArrowRight'] || G.keys['KeyD']) {
        G.player.x = Math.min(GAME_W - 15 - PLAYER_W, G.player.x + moveSpeed);
        tiltDir = 1;
      }

      /* Mouse: move player toward cursor X */
      if (G.mouseActive && G.mouseGameX >= 0) {
        const targetX = G.mouseGameX - PLAYER_W / 2;
        const dx = targetX - G.player.x;
        if (Math.abs(dx) > 1) {
          const step = Math.min(Math.abs(dx), moveSpeed);
          G.player.x += Math.sign(dx) * step;
          if (tiltDir === 0) tiltDir = Math.sign(dx);
        }
        G.player.x = Math.max(15, Math.min(GAME_W - 15 - PLAYER_W, G.player.x));
      }

      G.player.tilt += (tiltDir - G.player.tilt) * 0.2;

      /* Engine trail: a puff under the ship every other frame while moving */
      if (tiltDir !== 0 || G.dash) {
        ++G.trailFrame;
        if (G.trailFrame % 2 === 0) {
          G.trails.push({
            x: G.player.x + PLAYER_W / 2 + (G.rand() - 0.5) * 8,
            y: G.player.y + PLAYER_H + 3,
            vy: 1.5,
            life: 0.3,
            color: '#bfe8ff',
          });
          if (G.trails.length > 60)
            G.trails.splice(0, G.trails.length - 60);
        }
      }

      // Shooting
      if (G.playerShootCooldown > 0)
        G.playerShootCooldown -= dt;

      const cooldown = (G.activePowerups.rapidFire > 0 ? 100 : 300)
        * ship.fire * (1 - 0.15 * treeLevel('w_rate'));
      const maxBullets = 2
        + (G.activePowerups.rapidFire > 0 ? 2 : 0)
        + (G.activePowerups.tripleShot > 0 ? 4 : 0);
      const nonDroneBullets = G.playerBullets.filter(b => !b.fromDrone).length;

      if ((G.keys['Space'] || G.keys['ArrowUp'] || G.mouseDown) && G.playerShootCooldown <= 0 && nonDroneBullets < maxBullets) {
        const isLaser = G.activePowerups.laser > 0;
        const bw = isLaser ? LASER_W : BULLET_W;
        const bspd = BULLET_SPEED * (1 + 0.15 * treeLevel('w_speed'));
        const offsets = treeLevel('w_twin') > 0 ? [-8, 8] : [0];

        for (const off of offsets) {
          const bx = G.player.x + PLAYER_W / 2 + off - bw / 2;
          if (G.activePowerups.tripleShot > 0) {
            G.playerBullets.push(
              { x: bx, y: G.player.y - BULLET_H, vx: 0, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser },
              { x: bx - 12, y: G.player.y - BULLET_H + 6, vx: -1.8, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser },
              { x: bx + 12, y: G.player.y - BULLET_H + 6, vx: 1.8, vy: -bspd, w: bw, h: BULLET_H, piercing: isLaser }
            );
          } else
            G.playerBullets.push({
              x: bx,
              y: G.player.y - BULLET_H,
              vx: 0,
              vy: -bspd,
              w: bw,
              h: BULLET_H,
              piercing: isLaser,
            });
        }

        addFlare(G.player.x + PLAYER_W / 2, G.player.y - 4, 'cyan', 14, 0.06);
        G.playerShootCooldown = cooldown;
        if (isLaser)
          playSfx('laser', { volume: 0.3 });
        else
          playSfx('shoot', { pitch: 1.1 + G.rand() * 0.1, volume: 0.35 });
      }
    }
  }

  function movePlayerBullets() {
    // Player bullets
    for (let i = G.playerBullets.length - 1; i >= 0; --i) {
      const b = G.playerBullets[i];
      b.x += (b.vx || 0);
      b.y += (b.vy || -BULLET_SPEED);
      if (b.y + (b.h || BULLET_H) < 0 || b.x < -30 || b.x > GAME_W + 30)
        G.playerBullets.splice(i, 1);
      else if (Math.random() < 0.25) {
        const bw = b.w || BULLET_W;
        particles.trail(b.x + bw / 2, b.y + (b.h || BULLET_H), {
          vy: 0.8,
          color: b.piercing ? '#f0f' : (b.fromDrone ? '#8f8' : '#0f0'),
          size: 1,
          life: 0.2,
        });
      }
    }
  }

  Object.assign(NS.player, {
    updatePlayer, movePlayerBullets
  });
})();
