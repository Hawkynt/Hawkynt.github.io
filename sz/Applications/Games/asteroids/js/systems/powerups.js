/* Powerup system: timed states, instant extra life and nuke, timer decay and
   the drop roll on destruction. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;

  function initPowerupState() {
    const state = {};
    for (const key of T.DURATION_POWERUPS)
      state[key] = { active: false, timer: 0 };
    return state;
  }

  function activatePowerup(type) {
    const def = T.POWERUP_TYPES[type];
    ++S.stats.powerupsCollected;

    if (type === 'extraLife') {
      if (S.lives !== Infinity) {
        ++S.lives;
        NS.status.updateDisplays();
      }
      D.floatingText.add(S.ship.x, S.ship.y - 20, '+1 LIFE', { color: '#44ff44', decay: 0.015, font: NS.rules.scaledFont(16) });
      D.particles.sparkle(S.ship.x, S.ship.y, 15, { color: '#44ff44' });
      SZ.GameAudio.play('powerup');
      return;
    }

    if (type === 'nuke') {
      triggerNuke();
      return;
    }

    if (S.powerupState[type]) {
      S.powerupState[type].active = true;
      S.powerupState[type].timer = def.duration;
    }
    SZ.GameAudio.play('pickup');
    D.floatingText.add(S.ship.x, S.ship.y - 20, def.label.toUpperCase(), { color: def.color, decay: 0.02, font: NS.rules.scaledFont(14) });
  }

  function triggerNuke() {
    const cfg = NS.rules.modeConfig();
    let scoreGained = 0;
    for (const a of S.asteroids) {
      scoreGained += a.points;
      D.particles.burst(a.x, a.y, 8, { speed: 3, color: '#ffff44', size: 2, life: 0.5, decay: 0.03 });
      NS.shockwaves.addShockwave(a.x, a.y, { maxRadius: a.radius * 1.5, speed: 3, color: '#ffff44' });
    }
    S.asteroids = [];
    for (const e of S.enemies) {
      if (e.type === 'boss') continue;
      scoreGained += e.points;
      D.particles.burst(e.x, e.y, 8, { speed: 3, color: '#ffff44', size: 2, life: 0.5, decay: 0.03 });
      NS.shockwaves.addShockwave(e.x, e.y, { maxRadius: 40, speed: 3, color: '#ffff44' });
    }
    S.enemies = S.enemies.filter(e => e.type === 'boss');
    S.zones = [];
    S.score += Math.round(scoreGained * NS.combo.getComboMultiplier() * cfg.scoreMult);
    NS.shockwaves.triggerScreenFlash(0.6);
    D.shake.trigger(10, 500);
    SZ.GameAudio.play('explode', { pitch: 0.5 });
    D.floatingText.add(S.W / 2, S.H / 2, 'NUKE! +' + scoreGained, { color: '#ffff44', decay: 0.012, font: NS.rules.scaledFont(20) });
    NS.status.updateDisplays();
  }

  function updatePowerupTimers(dt) {
    for (const key of T.DURATION_POWERUPS)
      if (S.powerupState[key].active) {
        S.powerupState[key].timer -= dt;
        if (S.powerupState[key].timer <= 0) {
          S.powerupState[key].active = false;
          S.powerupState[key].timer = 0;
        }
      }
  }

  function trySpawnPowerup(x, y, dropRate) {
    if (Math.random() < dropRate)
      S.collectiblePowerups.push(NS.entities.createCollectiblePowerup(x, y));
  }

  Object.assign(NS.powerups, { initPowerupState, activatePowerup, triggerNuke, updatePowerupTimers, trySpawnPowerup });
})();
