/* Kills and losses: combo scoring, the common alien death and the player being hit.
   Owns G.combo*; writes G.score, G.lives, G.gameState. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    PLAYER_W, PLAYER_H, POWERUP_DROP_CHANCE, POWERUP_DROP_CHANCE_SPECIAL, COMBO_TIMEOUT, COMBO_MULTIPLIERS,
    SPECIES_DEATH_PITCH, SPECIES_FLARE, COMBO_COLORS
  } = NS.constants;
  const { MODES } = NS.data;
  const { playSfx } = NS.audio;
  const { treeLevel } = NS.progress;
  const {
    particles, shake, floatingText, addFlare, darkenColor, addDebris, addRing, playerDeathFx, triggerFlash
  } = NS.fx;
  const { addSpecialCharge } = NS.special;
  const { spawnPowerup } = NS.powerups;

  function addComboKill(points) {
    ++G.comboCount;
    G.comboTimer = COMBO_TIMEOUT;
    const prevMult = G.comboMultiplier;
    const idx = Math.min(G.comboCount, COMBO_MULTIPLIERS.length - 1);
    G.comboMultiplier = COMBO_MULTIPLIERS[idx];
    if (G.comboMultiplier > G.maxMultiplier)
      G.maxMultiplier = G.comboMultiplier;
    const gained = points * G.comboMultiplier;
    G.score += gained;

    if (G.comboMultiplier > prevMult && G.comboMultiplier > 1) {
      playSfx('levelup', { pitch: 1 + G.comboMultiplier * 0.1 });
      G.comboPop = { text: 'x' + G.comboMultiplier, color: COMBO_COLORS[G.comboMultiplier] || '#ffd23f', t: 0 };
    }

    return gained;
  }

  function updateCombo(dt) {
    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) {
        G.comboCount = 0;
        G.comboMultiplier = 1;
        G.comboTimer = 0;
      }
    }
  }

  /* Common death for any alien, whatever killed it */
  function destroyAlien(a) {
    a.alive = false;
    ++G.save.stats.kills;
    const gained = addComboKill(a.points);
    playSfx('smallExplode', { pitch: SPECIES_DEATH_PITCH[a.species] || 1, volume: 0.45 });

    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    addFlare(acx, acy, SPECIES_FLARE[a.species] || 'white', 46, 0.25);
    addDebris(acx, acy, 8 + Math.floor(G.rand() * 5), [a.color, darkenColor(a.color, 0.45)]);
    addRing(acx, acy, a.color, 6, 40, 0.25);

    particles.burst(acx, acy, 15, {
      speed: 3,
      color: a.color,
      gravity: 0.05,
      size: 3,
    });
    particles.sparkle(acx, acy, 6, { color: a.color });

    floatingText.add(acx, a.y, '+' + gained, {
      color: '#ff0',
      font: 'bold 13px sans-serif',
    });

    const dropChance = (a.isDiver ? POWERUP_DROP_CHANCE_SPECIAL : POWERUP_DROP_CHANCE)
      * (MODES[G.gameMode].powerupMult || 1)
      * (1 + 0.25 * treeLevel('p_luck'));
    if (G.rand() < dropChance)
      spawnPowerup(a.x + a.w / 2, a.y + a.h / 2);

    addSpecialCharge(4);
  }

  function killPlayer() {
    if (!G.player.alive) return;
    if (G.invuln > 0) return;
    if (G.activePowerups.shield && G.activePowerups.shield > 0) {
      G.activePowerups.shield = 0;
      delete G.activePowerups.shield;
      particles.sparkle(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, 15, { color: '#88f' });
      playSfx('zap', { pitch: 1.2, volume: 0.5 });
      triggerFlash('#88f', 0.3);
      shake.trigger(4, 200);
      return;
    }

    G.player.alive = false;
    --G.lives;
    ++G.livesLost;
    G.deathTimer = 2000;
    G.gameState = 'dying';
    G.specialActive = 0;
    G.specialKind = '';
    G.novaRing = null;
    G.dash = null;

    particles.burst(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, 30, {
      speed: 5,
      color: '#f80',
      gravity: 0.08,
      size: 4,
    });
    particles.burst(G.player.x + PLAYER_W / 2, G.player.y + PLAYER_H / 2, 15, {
      speed: 3,
      color: '#f00',
      gravity: 0.05,
      size: 3,
    });
    playerDeathFx();
    triggerFlash('#f44', 0.3);
    playSfx('explode');
  }

  Object.assign(NS.combat, {
    killPlayer, updateCombo, destroyAlien
  });
})();
