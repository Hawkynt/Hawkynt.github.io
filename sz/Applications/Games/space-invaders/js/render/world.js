/* Draws the battlefield: bunkers, aliens, boss, ship, drone, special visuals, bullets, UFO,
   capsules and the effect layers. Reads G only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    PLAYER_W, PLAYER_H, BULLET_W, BULLET_H, BOSS_W, BOSS_H, BOSS_SPRITE_W, BOSS_SPRITE_H, DRONE_W, DRONE_H,
    POWERUP_SIZE, BUNKER_ROW_COLORS
  } = NS.constants;
  const { currentShipId } = NS.progress;
  const { ctx } = NS.view;
  const { particles, floatingText } = NS.fx;

  /* The battlefield, inside the shaken world transform */
  function drawWorld() {
    drawBunkers();
    drawAliens();
    drawBossShip();
    drawPlayerShip();

    // Drone
    if (G.drone)
      SZ.InvaderArt.drawDrone(ctx, G.drone.x + DRONE_W / 2, G.drone.y + DRONE_H / 2, G.gameTime / 1000);

    drawSpecialFx();
    drawProjectiles();
    drawFxLayers();

    // Particles + floating text
    particles.draw(ctx);
    floatingText.draw(ctx);
  }

  function drawBunkers() {
    // Bunkers: energy-crystal wall, damaged blocks sit darker
    for (const shieldBlocks of G.shields)
      for (const s of shieldBlocks)
        if (s.alive) {
          ctx.globalAlpha = s.hp < s.maxHp ? 0.55 : 1;
          ctx.fillStyle = BUNKER_ROW_COLORS[s.row];
          ctx.fillRect(s.x, s.y, s.w, s.h);
        }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(200,251,255,0.6)';
    for (const shieldBlocks of G.shields)
      for (const s of shieldBlocks)
        if (s.alive && s.hp >= s.maxHp)
          ctx.fillRect(s.x, s.y, s.w, 1);
  }

  function drawAliens() {
    // Aliens
    for (const a of G.aliens) {
      if (!a.alive) continue;
      SZ.InvaderArt.drawAlien(ctx, a.diving ? 4 : (a.species || 3), a.x, a.y, G.alienFrame % 2, a.flash > 0);

      if (a.shielded && a.shieldHP > 0) {
        ctx.save();
        ctx.strokeStyle = '#3af2ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7 + 4, a.h * 0.7 + 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, a.w * 0.7 + 7, a.h * 0.7 + 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawBossShip() {
    // Boss
    if (G.boss) {
      const phase2 = G.boss.hp <= G.boss.maxHp / 2;

      /* During the entrance the descending boss drags a growing shadow along */
      if (G.gameState === 'bossIntro') {
        const prog = Math.max(0, Math.min(1, (G.boss.y + BOSS_H + 30) / (G.boss.targetY + BOSS_H + 30)));
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.25 * prog;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(G.boss.x + BOSS_W / 2, G.boss.y + BOSS_H + 30, BOSS_W * (0.25 + 0.3 * prog), 14 + 10 * prog, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(G.boss.x, G.boss.y);
      ctx.scale(BOSS_W / BOSS_SPRITE_W, BOSS_H / BOSS_SPRITE_H);
      SZ.InvaderArt.drawBoss(ctx, G.boss.design !== undefined ? G.boss.design : 0, 0, 0, phase2, G.boss.flash > 0);
      ctx.restore();
    }
  }

  function drawPlayerShip() {
    // Player
    if (G.player.alive) {
      const moving = (G.keys['ArrowLeft'] || G.keys['KeyA'] || G.keys['ArrowRight'] || G.keys['KeyD'])
        || (G.mouseActive && G.mouseGameX >= 0 && Math.abs(G.mouseGameX - (G.player.x + PLAYER_W / 2)) > 1);
      let thrust = (moving ? 3 : 1) + (Math.floor(G.gameTime / 60) % 2);
      thrust = Math.max(0, Math.min(3, thrust));
      const phaseOn = G.specialActive > 0 && G.specialKind === 'phase';
      SZ.InvaderArt.drawShip(ctx, currentShipId(), G.player.x + PLAYER_W / 2, G.player.y, thrust, G.player.tilt, phaseOn ? 0.45 : 1);

      if (phaseOn) {
        ctx.save();
        ctx.strokeStyle = '#b06aff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(G.gameTime * 0.012);
        ctx.beginPath();
        ctx.ellipse(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, PLAYER_W * 0.85, PLAYER_H * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (G.activePowerups.shield > 0) {
        ctx.save();
        const shieldAlpha = 0.25 + Math.sin(G.gameTime * 0.008) * 0.1;
        ctx.globalAlpha = shieldAlpha;
        ctx.strokeStyle = '#88f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, PLAYER_W * 0.8, PLAYER_H * 1.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,100,255,0.08)';
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.ellipse(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, PLAYER_W * 0.95, PLAYER_H * 1.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawSpecialFx() {
    // Special ability visuals
    if (G.specialActive > 0 && G.specialKind === 'railgun' && G.player.alive) {
      const rx = G.player.x + PLAYER_W / 2;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(rx - 9, 0, 18, G.player.y);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx - 2.5, 0, 5, G.player.y);
      ctx.restore();
    }
    if (G.specialActive > 0 && G.specialKind === 'barrier' && G.player.alive) {
      const bx = G.player.x + PLAYER_W / 2, by = G.player.y + PLAYER_H / 2;
      ctx.save();
      ctx.strokeStyle = '#3af2ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(G.gameTime * 0.01);
      ctx.beginPath();
      ctx.arc(bx, by, 70, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, 78, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (G.novaRing) {
      const prog = Math.min(1, G.novaRing.t / 500);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 10 * (1 - prog) + 2;
      ctx.beginPath();
      ctx.arc(G.novaRing.cx, G.novaRing.cy, G.novaRing.maxR * prog, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectiles() {
    // Player bullets
    for (const b of G.playerBullets) {
      const bw = b.w || BULLET_W;
      const bh = b.h || BULLET_H;
      if (b.piercing)
        SZ.InvaderArt.drawBullet(ctx, 'laser', b.x + bw / 2, b.y + bh, bh);
      else
        SZ.InvaderArt.drawBullet(ctx, 'player', b.x + bw / 2, b.y + bh / 2);
    }

    // Alien bullets
    for (const b of G.alienBullets)
      SZ.InvaderArt.drawBullet(ctx, b.bossBullet ? 'orb' : 'alien', b.x + b.w / 2, b.y + b.h / 2);

    // UFO
    if (G.ufo)
      SZ.InvaderArt.drawUfo(ctx, G.ufo.x, G.ufo.y, G.gameTime / 1000);

    // Falling powerups
    for (const p of G.fallingPowerups)
      SZ.InvaderArt.drawCapsule(ctx, p.def.id, p.x + POWERUP_SIZE / 2,
        p.y + POWERUP_SIZE / 2 + Math.sin(G.gameTime * 0.004) * 4.5, G.gameTime / 1000);
  }

  function drawFxLayers() {
    // Explosion flares
    for (const f of G.flares)
      SZ.InvaderArt.drawFlare(ctx, f.color, f.x, f.y,
        f.r * (0.6 + 0.4 * f.t / f.life), 1 - f.t / f.life);

    // Engine trails
    for (const t of G.trails) {
      ctx.globalAlpha = Math.max(0, t.life / 0.3) * 0.6;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Debris shards: small rotating triangles fading out
    for (const d of G.debris) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life / 0.6);
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(0, -d.size);
      ctx.lineTo(d.size * 0.8, d.size * 0.7);
      ctx.lineTo(-d.size * 0.8, d.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shockwave rings
    for (const r of G.rings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  Object.assign(NS.world, {
    drawWorld
  });
})();
