/* Shooting: the ship's gun with spread/triple variants, every enemy firing
   pattern and the hyperspace jump. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function shoot() {
    if (!S.ship) return;
    const emp = S.empActive;
    const maxBullets = (!emp && S.powerupState.rapid.active) ? C.MAX_BULLETS_RAPID : C.MAX_BULLETS_NORMAL;
    if (S.bullets.length >= maxBullets) return;

    ++S.stats.shotsFired;
    const tipX = S.ship.x + Math.cos(S.ship.angle) * C.SHIP_SIZE;
    const tipY = S.ship.y + Math.sin(S.ship.angle) * C.SHIP_SIZE;

    if (!emp && S.powerupState.spread.active) {
      const count = 5;
      const arc = 0.5;
      for (let i = 0; i < count; ++i) {
        const a = S.ship.angle + (i - (count - 1) / 2) * (arc / (count - 1));
        S.bullets.push(NS.entities.createBullet(tipX, tipY, a));
      }
      S.stats.shotsFired += count - 1;
    } else if (!emp && S.powerupState.triple.active) {
      S.bullets.push(NS.entities.createBullet(tipX, tipY, S.ship.angle));
      S.bullets.push(NS.entities.createBullet(tipX, tipY, S.ship.angle - 0.15));
      S.bullets.push(NS.entities.createBullet(tipX, tipY, S.ship.angle + 0.15));
      S.stats.shotsFired += 2;
    } else
      S.bullets.push(NS.entities.createBullet(tipX, tipY, S.ship.angle));
    SZ.GameAudio.play('shoot', { volume: 0.6 });
  }

  function enemyShoot(enemy) {
    if (!S.ship) return;
    const bulletsBefore = S.enemyBullets.length;
    let angle;
    if (enemy.type === 'ufo')
      angle = NS.rules.randomAngle();
    else {
      angle = Math.atan2(S.ship.y - enemy.y, S.ship.x - enemy.x);
      angle += (Math.random() - 0.5) * 0.3;
    }

    if (enemy.type === 'gunship') {
      for (let i = 0; i < 3; ++i)
        S.enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(angle + (i - 1) * 0.12) * C.BULLET_SPEED * 0.65,
          vy: Math.sin(angle + (i - 1) * 0.12) * C.BULLET_SPEED * 0.65,
          life: C.BULLET_LIFETIME
        });
    } else if (enemy.type === 'boss') {
      if (enemy.attackPattern === 0) {
        for (let i = 0; i < 3; ++i)
          S.enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(angle + (i - 1) * 0.15) * C.BULLET_SPEED * 0.6,
            vy: Math.sin(angle + (i - 1) * 0.15) * C.BULLET_SPEED * 0.6,
            life: C.BULLET_LIFETIME
          });
      } else if (enemy.attackPattern === 1) {
        for (let i = 0; i < 8; ++i) {
          const a = (i / 8) * Math.PI * 2;
          S.enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * C.BULLET_SPEED * 0.5,
            vy: Math.sin(a) * C.BULLET_SPEED * 0.5,
            life: C.BULLET_LIFETIME
          });
        }
      } else {
        const lvl = NS.rules.getEffectiveLevel();
        if (S.enemies.filter(e => e.type === 'drone').length < 3) {
          const d = NS.entities.createEnemy('drone');
          d.x = enemy.x + (Math.random() - 0.5) * 30;
          d.y = enemy.y + 20;
          S.enemies.push(d);
        }
      }
    } else
      S.enemyBullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * C.BULLET_SPEED * 0.7,
        vy: Math.sin(angle) * C.BULLET_SPEED * 0.7,
        life: C.BULLET_LIFETIME
      });
    if (S.enemyBullets.length > bulletsBefore)
      SZ.GameAudio.play('laser', { pitch: enemy.type === 'boss' ? 0.7 : 1, volume: 0.4 });
  }

  function hyperspace() {
    if (!S.ship || S.hyperspaceCooldown > 0) return;

    D.particles.burst(S.ship.x, S.ship.y, 12, { speed: 3, color: '#88aaff', size: 2, life: 0.4, decay: 0.04 });
    NS.shockwaves.addShockwave(S.ship.x, S.ship.y, { maxRadius: 30, speed: 4, color: '#88aaff' });
    SZ.GameAudio.play('whoosh', { pitch: 1.5 });

    S.ship.x = Math.random() * S.W;
    S.ship.y = Math.random() * S.H;
    S.ship.vx = 0;
    S.ship.vy = 0;
    S.hyperspaceCooldown = C.HYPERSPACE_COOLDOWN;

    D.particles.burst(S.ship.x, S.ship.y, 12, { speed: 3, color: '#88aaff', size: 2, life: 0.4, decay: 0.04 });
  }

  Object.assign(NS.shooting, { shoot, enemyShoot, hyperspace });
})();
