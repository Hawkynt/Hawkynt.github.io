;(function() {
  'use strict';

  // Primary and mine gadget updates.
  // Owns: NS.gadgets
  // Reads: constants, dom, rules, upgrades, animation, cargo, chests
  // Reads state of: gameState, relocation, waves

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { VIEW_SURFACE, VIEW_UNDERGROUND } = NS.constants;
  const { particles, floatingText } = NS.dom;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { applyDamageToEnemy } = NS.animation;
  const { attractPiles } = NS.cargo;
  const { revealChestsNear } = NS.chests;

  /* ======================================================================
     GADGET UPDATES
     ====================================================================== */

  function updateGadgets(dt) {
    // -- Primary gadget updates --
    if (G.primaryGadget === 'repellent') {
      if (G.primaryGadgetState.active) {
        G.primaryGadgetState.duration -= dt;
        if (G.primaryGadgetState.duration <= 0) {
          G.primaryGadgetState.active = false;
          G.primaryGadgetState.cooldown = 30 - 4 * getEffectiveLevel('shieldRecharge');
        }
      } else if (G.primaryGadgetState.cooldown > 0)
        G.primaryGadgetState.cooldown -= dt;
    }

    if (G.primaryGadget === 'orchard') {
      if (G.primaryGadgetState.speedBoostTimer > 0)
        G.primaryGadgetState.speedBoostTimer -= dt;

      if (!G.primaryGadgetState.fruitReady) {
        G.primaryGadgetState.fruitTimer -= dt;
        if (G.primaryGadgetState.fruitTimer <= 0)
          G.primaryGadgetState.fruitReady = true;
      }
    }

    // -- Mine gadgets updates --
    // Auto Cannon
    if (G.foundGadgets.includes('autoCannon')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (G.primaryGadgetState.autoCannonFlash > 0) {
        G.primaryGadgetState.autoCannonFlash -= dt;
        if (G.primaryGadgetState.autoCannonFlash <= 0) {
          G.primaryGadgetState.autoCannonFlash = 0;
          G.primaryGadgetState.autoCannonTarget = null;
        }
      }
      if (G.enemies.length > 0) {
        G.primaryGadgetState.autoCannonTimer = (G.primaryGadgetState.autoCannonTimer || 0) - dt;
        if (G.primaryGadgetState.autoCannonTimer <= 0) {
          G.primaryGadgetState.autoCannonTimer = 2;
          // Find nearest enemy
          let nearest = null, bestD = Infinity;
          for (const e of G.enemies) {
            if (e.hidden) continue;
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            applyDamageToEnemy(nearest, 5);
            // Store last target for drawing
            G.primaryGadgetState.autoCannonTarget = { x: nearest.x, y: nearest.y };
            G.primaryGadgetState.autoCannonFlash = 0.3;
            SZ.GameAudio.play('shoot', { volume: 0.5 });
            particles.burst(nearest.x, nearest.y, 6, { color: '#ff0', speed: 2, life: 0.3 });
          }
        }
      }
    }

    // Stun Laser
    if (G.foundGadgets.includes('stunLaser')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (G.primaryGadgetState.stunLaserFlash > 0) {
        G.primaryGadgetState.stunLaserFlash -= dt;
        if (G.primaryGadgetState.stunLaserFlash <= 0) {
          G.primaryGadgetState.stunLaserFlash = 0;
          G.primaryGadgetState.stunLaserTarget = null;
        }
      }
      if (G.enemies.length > 0) {
        G.primaryGadgetState.stunLaserTimer = (G.primaryGadgetState.stunLaserTimer || 0) - dt;
        if (G.primaryGadgetState.stunLaserTimer <= 0) {
          G.primaryGadgetState.stunLaserTimer = 8;
          let nearest = null, bestD = Infinity;
          for (const e of G.enemies) {
            if (e.hidden) continue;
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            nearest.stunTimer = 2;
            G.primaryGadgetState.stunLaserTarget = { x: nearest.x, y: nearest.y };
            G.primaryGadgetState.stunLaserFlash = 0.4;
            SZ.GameAudio.play('zap', { pitch: 1.3 });
            floatingText.add(nearest.x, nearest.y - 40, 'STUNNED!', { color: '#4af', font: 'bold 22px sans-serif' });
          }
        }
      }
    }

    // Probe Scanner timer
    if (G.foundGadgets.includes('probeScanner') && G.primaryGadgetState.probeTimer > 0)
      G.primaryGadgetState.probeTimer -= dt;

    // Condenser
    if (G.foundGadgets.includes('condenser')) {
      G.primaryGadgetState.condenserTimer = (G.primaryGadgetState.condenserTimer || 0) - dt;
      if (G.primaryGadgetState.condenserTimer <= 0) {
        G.primaryGadgetState.condenserTimer = 30;
        G.resources.water += 5;
        floatingText.add(DOME_X + 80, DOME_Y - 40, '+5 water (condenser)', { color: '#6af', font: 'bold 22px sans-serif' });
      }
    }

    // -- New gadget effects --

    // Auto-Repair: slowly regenerate dome HP
    if (G.unlockedTools.autoRepair && G.domeHP < G.maxDomeHP) {
      G.toolState.autoRepairTimer = (G.toolState.autoRepairTimer || 0) - dt;
      if (G.toolState.autoRepairTimer <= 0) {
        G.toolState.autoRepairTimer = 5 / (1 + 0.6 * getEffectiveLevel('autoRepairSpeed')); // heal every 5 seconds (faster with upgrades)
        const heal = 2;
        G.domeHP = Math.min(G.domeHP + heal, G.maxDomeHP);
        floatingText.add(DOME_X + 60, DOME_Y - 40, `+${heal} HP`, { color: '#0f0', font: 'bold 18px sans-serif' });
      }
    }

    // Energy Shield: absorb a percentage of damage (tracked passively via unlockedTools)

    // Magnet: dropped resources within 2 tiles fly to the keeper
    if (G.unlockedTools.magnet && G.currentView === VIEW_UNDERGROUND)
      attractPiles(2 + getEffectiveLevel('magnetRange'));

    // Chain Lightning: when turret fires, extra damage arcs to nearby enemies (handled in weapon)
    // Freeze Ray: slows enemies near projectile impacts (handled in weapon)
    // Plasma Cannon: AoE damage on hit (handled in weapon)

    // Jetpack cooldown
    if (G.toolState.jetpackCooldown > 0)
      G.toolState.jetpackCooldown = Math.max(0, G.toolState.jetpackCooldown - dt);

    // Phase Shift cooldown
    if (G.toolState.phaseShiftCooldown > 0)
      G.toolState.phaseShiftCooldown = Math.max(0, G.toolState.phaseShiftCooldown - dt);

    // -- Unlockable tool cooldowns --
    if (G.toolState.blastToolCooldown > 0)
      G.toolState.blastToolCooldown = Math.max(0, G.toolState.blastToolCooldown - dt);
    if (G.toolState.teleporterCooldown > 0)
      G.toolState.teleporterCooldown = Math.max(0, G.toolState.teleporterCooldown - dt);

    // Shield Regen: slow passive repair
    const regen = getEffectiveLevel('shieldRegen');
    if (regen > 0 && G.domeHP > 0 && G.domeHP < G.maxDomeHP)
      G.domeHP = Math.min(G.maxDomeHP, G.domeHP + 0.2 * regen * dt);
    // Shield Recharge: the Shield Generator comes back on its own after a while
    const recharge = getEffectiveLevel('shieldRecharge');
    if (G.primaryGadget === 'shield' && !G.primaryGadgetState.active && recharge > 0) {
      G.primaryGadgetState.rechargeTimer = (G.primaryGadgetState.rechargeTimer || 0) + dt;
      if (G.primaryGadgetState.rechargeTimer >= 50 - 8 * recharge) {
        G.primaryGadgetState.active = true;
        G.primaryGadgetState.rechargeTimer = 0;
        if (G.currentView === VIEW_SURFACE)
          floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
      }
    }
    if (G.domeInvulnerable > 0) G.domeInvulnerable = Math.max(0, G.domeInvulnerable - dt);
    if (G.emergencyCooldown > 0) G.emergencyCooldown = Math.max(0, G.emergencyCooldown - dt);
    if (G.dashCooldown > 0) G.dashCooldown = Math.max(0, G.dashCooldown - dt);
    // Ore Detector: hidden chambers and the Relocation Core show up nearby
    if (G.unlockedTools.oreDetector) {
      const R = 6 + 3 * (getEffectiveLevel('oreDetector') - 1);
      for (const ch of G.gadgetChambers)
        if (!ch.revealed && Math.abs(ch.r - G.drillY) + Math.abs(ch.c - G.drillX) <= R)
          ch.revealed = true;
      if (!G.relocationCore.revealed && Math.abs(G.relocationCore.r - G.drillY) + Math.abs(G.relocationCore.c - G.drillX) <= R)
        G.relocationCore.revealed = true;
      if (G.currentView === VIEW_UNDERGROUND)
        revealChestsNear(G.drillY, G.drillX, R, true);
    }

    // Scanner passive: always active when unlocked (echo location extends range)
    G.toolState.scannerActive = !!G.unlockedTools.scanner;
    G.toolState.echoLocationActive = !!G.unlockedTools.echoLocation;
  }

  NS.gadgets = { updateGadgets };
})();
