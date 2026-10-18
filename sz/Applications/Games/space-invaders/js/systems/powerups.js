/* Power-ups: weighted drops, falling capsules, pickup effects, the bomb and active timers.
   Owns G.fallingPowerups, G.activePowerups, G.drone; reads G.player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    GAME_W, GAME_H, PLAYER_W, PLAYER_H, DRONE_W, POWERUP_SIZE, POWERUP_FALL_SPEED, SPECIES_FLARE
  } = NS.constants;
  const { POWERUPS, TOTAL_POWERUP_WEIGHT, rectsOverlap } = NS.data;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;
  const { treeLevel, powerupDuration } = NS.progress;
  const { particles, shake, floatingText, addFlare, triggerFlash } = NS.fx;
  const { addSpecialCharge } = NS.special;

  function pickRandomPowerup() {
    let r = G.rand() * TOTAL_POWERUP_WEIGHT;
    for (const p of POWERUPS) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return POWERUPS[0];
  }

  function spawnPowerup(x, y) {
    const def = pickRandomPowerup();
    G.fallingPowerups.push({
      x: x - POWERUP_SIZE / 2,
      y,
      def,
      time: G.gameTime,
    });
  }

  function updateFallingPowerups(dt) {
    for (let i = G.fallingPowerups.length - 1; i >= 0; --i) {
      const p = G.fallingPowerups[i];
      p.y += POWERUP_FALL_SPEED;
      p.time = G.gameTime;

      if (treeLevel('p_magnet') > 0 && G.player.alive && p.y < G.player.y) {
        const pull = G.player.x + PLAYER_W / 2 - (p.x + POWERUP_SIZE / 2);
        if (Math.abs(pull) > 1)
          p.x += Math.sign(pull) * 1.5;
      }

      if (p.y > GAME_H + 30) {
        G.fallingPowerups.splice(i, 1);
        continue;
      }

      if (G.player.alive && rectsOverlap(
        p.x, p.y + Math.sin(G.gameTime * 0.004) * 4.5, POWERUP_SIZE, POWERUP_SIZE,
        G.player.x, G.player.y, PLAYER_W, PLAYER_H
      )) {
        playSfx('powerup');
        collectPowerup(p.def);
        particles.sparkle(p.x + POWERUP_SIZE / 2, p.y + POWERUP_SIZE / 2, 12, { color: p.def.color });
        floatingText.add(p.x + POWERUP_SIZE / 2, p.y, p.def.name, {
          color: p.def.color,
          font: 'bold 18px sans-serif',
        });
        G.fallingPowerups.splice(i, 1);
      }
    }
  }

  function collectPowerup(def) {
    triggerFlash(def.color, 0.15);

    if (def.id === 'extraLife') {
      ++G.lives;
      updateStatusBar();
      return;
    }

    if (def.id === 'bomb') {
      activateBomb();
      return;
    }

    if (def.id === 'drone') {
      G.drone = {
        x: G.player.x + PLAYER_W / 2 - DRONE_W / 2 + 30,
        y: G.player.y - 30,
      };
      G.droneShootTimer = 0;
      G.activePowerups.drone = powerupDuration(def);
      return;
    }

    G.activePowerups[def.id] = powerupDuration(def);
  }

  function activateBomb() {
    let bombScore = 0;
    for (const a of G.aliens) {
      if (!a.alive) continue;
      a.alive = false;
      ++G.save.stats.kills;
      bombScore += a.points;
      addSpecialCharge(4);
      addFlare(a.x + a.w / 2, a.y + a.h / 2, SPECIES_FLARE[a.species] || 'white', 46, 0.25);
      particles.burst(a.x + a.w / 2, a.y + a.h / 2, 8, {
        speed: 3,
        color: a.color,
        gravity: 0.05,
        size: 2,
      });
    }

    for (const d of G.divers) {
      if (!d.alive) continue;
      d.alive = false;
      ++G.save.stats.kills;
      bombScore += d.points || 50;
      addSpecialCharge(4);
      addFlare(d.x + d.w / 2, d.y + d.h / 2, 'orange', 46, 0.25);
      particles.burst(d.x + d.w / 2, d.y + d.h / 2, 8, {
        speed: 3,
        color: '#f80',
        gravity: 0.05,
        size: 2,
      });
    }
    G.divers = [];

    G.score += bombScore;
    triggerFlash('#fa0', 0.4);
    shake.trigger(6, 300);
    if (bombScore > 0)
      floatingText.add(GAME_W / 2, GAME_H / 2, '+' + bombScore, {
        color: '#fa0',
        font: 'bold 30px sans-serif',
      });
  }

  function updateActivePowerups(dt) {
    for (const id of Object.keys(G.activePowerups)) {
      G.activePowerups[id] -= dt;
      if (G.activePowerups[id] <= 0) {
        delete G.activePowerups[id];
        playSfx('drop', { volume: 0.3 });
        if (id === 'drone')
          G.drone = null;
      }
    }
  }

  Object.assign(NS.powerups, {
    spawnPowerup, updateFallingPowerups, updateActivePowerups
  });
})();
