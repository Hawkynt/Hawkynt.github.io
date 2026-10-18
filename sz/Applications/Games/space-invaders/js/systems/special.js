/* Ship specials and movement extras: the special meter and charges, Overdrive, Railgun, Barrier,
   Phase, Nova, the dash and the escort drone. Owns G.special*, G.novaRing, G.dash, G.invuln. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    PLAYER_W, PLAYER_H, BULLET_H, BULLET_SPEED, BOSS_W, BOSS_H, DRONE_W, DRONE_SHOOT_INTERVAL
  } = NS.constants;
  const { SHIP_DEFS } = NS.data;
  const { playSfx } = NS.audio;
  const { treeLevel, currentShipId, maxSpecialCharges, bulletDamage } = NS.progress;
  const { shake, addFlare, triggerFlash } = NS.fx;
  const Boss = NS.boss;
  const Combat = NS.combat;

  function addSpecialCharge(base) {
    if (G.specialCharges >= maxSpecialCharges())
      return;
    G.special += base * (1 + 0.2 * treeLevel('s_charge'));
    if (G.special >= 100) {
      ++G.specialCharges;
      G.special = 0;
      playSfx('pickup');
    }
  }

  function fireSpecial() {
    if (G.specialActive > 0)
      return;
    if (G.specialCharges <= 0) {
      playSfx('error');
      return;
    }
    --G.specialCharges;

    const ship = SHIP_DEFS[currentShipId()];
    const f = 1 + 0.3 * treeLevel('s_power');
    G.specialKind = ship.special;
    G.specialTick = 0;

    if (ship.special === 'overdrive') {
      G.specialActive = 4000 * f;
      G.activePowerups.tripleShot = Math.max(G.activePowerups.tripleShot || 0, G.specialActive);
      G.activePowerups.rapidFire = Math.max(G.activePowerups.rapidFire || 0, G.specialActive);
      playSfx('powerup');
    } else if (ship.special === 'railgun') {
      G.specialActive = 1200 * f;
      playSfx('laser');
    } else if (ship.special === 'barrier') {
      G.specialActive = 5000 * f;
      playSfx('zap');
    } else if (ship.special === 'phase') {
      G.specialActive = 3000 * f;
      G.invuln = Math.max(G.invuln, G.specialActive);
      playSfx('whoosh');
    } else if (ship.special === 'nova') {
      G.specialActive = 500;
      G.novaRing = {
        cx: G.player.x + PLAYER_W / 2,
        cy: G.player.y + PLAYER_H / 2,
        t: 0,
        maxR: 380 * (1 + 0.15 * treeLevel('s_power')),
        hitBoss: false,
      };
      addFlare(G.novaRing.cx, G.novaRing.cy, 'white', 160, 0.5);
      triggerFlash('#fff', 0.4);
      shake.trigger(12, 500);
      playSfx('explode', { pitch: 0.7 });
    }
  }

  /* Railgun: every 0.1 s the 18 px column under the ship takes damage */
  function tickRailgun(dt) {
    G.specialTick += dt;
    while (G.specialTick >= 100) {
      G.specialTick -= 100;
      const cx = G.player.x + PLAYER_W / 2;
      let tickKills = 0;
      for (const a of G.aliens) {
        if (!a.alive) continue;
        if (a.x + a.w > cx - 9 && a.x < cx + 9) {
          --a.hp;
          if (a.hp <= 0) {
            Combat.destroyAlien(a);
            ++tickKills;
          } else
            a.flash = 0.08;
        }
      }
      if (tickKills >= 3)
        G.hitStop = 0.05;
      if (G.bossActive && G.boss && G.boss.x < cx + 9 && G.boss.x + BOSS_W > cx)
        Boss.damageBoss(2 * bulletDamage(), true);
    }
  }

  /* Nova: shockwave ring expanding from the ship, wiping everything it touches */
  function updateNova(dt) {
    if (!G.novaRing) return;
    G.novaRing.t += dt;
    const r = G.novaRing.maxR * Math.min(1, G.novaRing.t / 500);
    for (const a of G.aliens) {
      if (!a.alive) continue;
      const dx = a.x + a.w / 2 - G.novaRing.cx;
      const dy = a.y + a.h / 2 - G.novaRing.cy;
      if (dx * dx + dy * dy <= r * r)
        Combat.destroyAlien(a);
    }
    if (!G.novaRing.hitBoss && G.bossActive && G.boss) {
      const bx = G.boss.x + BOSS_W / 2 - G.novaRing.cx;
      const by = G.boss.y + BOSS_H / 2 - G.novaRing.cy;
      if (bx * bx + by * by <= r * r) {
        G.novaRing.hitBoss = true;
        Boss.damageBoss(10 * bulletDamage(), true);
      }
    }
    if (G.novaRing.t >= 500)
      G.novaRing = null;
  }

  function tryDash(dir) {
    if (G.dash || G.dashCooldown > 0)
      return;
    G.dash = { dir, t: 0 };
    G.invuln = Math.max(G.invuln, 300);
    G.dashCooldown = 1200;
    playSfx('whoosh', { pitch: 1.5, volume: 0.5 });
  }

  function updateDrone(dt) {
    if (!G.drone) return;

    const targetX = G.player.x + PLAYER_W / 2 - DRONE_W / 2 + 37.5;
    const targetY = G.player.y - 33;
    G.drone.x += (targetX - G.drone.x) * 0.08;
    G.drone.y += (targetY - G.drone.y) * 0.08;

    G.droneShootTimer += dt;
    if (G.droneShootTimer >= DRONE_SHOOT_INTERVAL && G.player.alive) {
      G.droneShootTimer = 0;
      G.playerBullets.push({
        x: G.drone.x + DRONE_W / 2 - 1.5,
        y: G.drone.y - BULLET_H,
        vx: 0,
        vy: -BULLET_SPEED * 0.8,
        w: 3,
        h: BULLET_H - 3,
        piercing: false,
        fromDrone: true,
      });
    }
  }

  function updateSpecialTimers(dt) {
    // Special ability + dash timers
    if (G.specialActive > 0) {
      G.specialActive -= dt;
      if (G.specialActive <= 0) {
        G.specialActive = 0;
        G.specialKind = '';
      }
    }
    if (G.invuln > 0)
      G.invuln = Math.max(0, G.invuln - dt);
    if (G.dashCooldown > 0)
      G.dashCooldown = Math.max(0, G.dashCooldown - dt);
    if (G.specialKind === 'railgun' && G.specialActive > 0)
      tickRailgun(dt);
    updateNova(dt);
  }

  Object.assign(NS.special, {
    addSpecialCharge, fireSpecial, tryDash, updateDrone, updateSpecialTimers
  });
})();
