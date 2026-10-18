;(function() {
  'use strict';

  // Per-frame animation updates, crumble and dust spawners and the shield-aware damage helper.
  // Owns: NS.animation
  // Reads: constants, dom, rules, gameState
  // Reads state of: gameState, weapon

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, VIEW_SURFACE, VIEW_UNDERGROUND, GRID_COLS, GRID_ROWS, TILE_SIZE,
    TILE_EMPTY, TILE_DIRT, TILE_GADGET, TILE_CORE, TILE_CHEST, TILE_HIGHLIGHT_COLORS } = NS.constants;
  const { particles, floatingText, enemyHitFlash } = NS.dom;
  const { DOME_X, DOME_Y } = NS.rules;
  const { PICKAXE_SWING_DURATION } = NS.gameState;

  /* ======================================================================
     ANIMATION UPDATES
     ====================================================================== */

  function updateAnimations(dt) {
    G.animTime += dt;

    // Dome pulse
    G.domePulsePhase += dt * 2.0;

    G.screenFlash = Math.max(0, G.screenFlash - dt * 3);

    // Dome hit flash decay
    if (G.domeHitFlash > 0)
      G.domeHitFlash = Math.max(0, G.domeHitFlash - dt * 4);

    // Player idle bob
    G.playerBob = Math.sin(G.animTime * 3) * 2;

    // Pickaxe swing
    if (G.pickaxeSwinging) {
      G.pickaxeSwingTimer -= dt;
      const progress = 1 - (G.pickaxeSwingTimer / PICKAXE_SWING_DURATION);
      // Swing out to 70 deg then back
      if (progress < 0.5)
        G.pickaxeAngle = progress * 2 * 1.2;
      else
        G.pickaxeAngle = (1 - progress) * 2 * 1.2;

      if (G.pickaxeSwingTimer <= 0) {
        G.pickaxeSwinging = false;
        G.pickaxeAngle = 0;
      }
    }

    // Crumble effects
    for (let i = G.crumbleEffects.length - 1; i >= 0; --i) {
      const c = G.crumbleEffects[i];
      c.life -= dt;
      for (const p of c.pieces) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 0.15;
        p.rot += p.rotV;
      }
      if (c.life <= 0)
        G.crumbleEffects.splice(i, 1);
    }

    // Dust clouds
    for (let i = G.dustClouds.length - 1; i >= 0; --i) {
      const d = G.dustClouds[i];
      d.alpha -= dt * 2;
      d.radius += d.expandRate * dt * 60;
      d.y -= dt * 15;
      if (d.alpha <= 0)
        G.dustClouds.splice(i, 1);
    }

    // Resource glows
    for (let i = G.resourceGlows.length - 1; i >= 0; --i) {
      const g = G.resourceGlows[i];
      g.life -= dt * 1.5;
      g.radius += dt * 40;
      if (g.life <= 0)
        G.resourceGlows.splice(i, 1);
    }

    // Shield impacts
    for (let i = G.shieldImpacts.length - 1; i >= 0; --i) {
      const s = G.shieldImpacts[i];
      s.life -= dt * 3;
      if (s.life <= 0)
        G.shieldImpacts.splice(i, 1);
    }

    // Ambient sparkles on resource tiles underground
    if (G.currentView === VIEW_UNDERGROUND) {
      G.tileSparkleTimer -= dt;
      if (G.tileSparkleTimer <= 0) {
        G.tileSparkleTimer = 0.3 + Math.random() * 0.4;
        // Pick a random visible resource tile
        const candidates = [];
        const spkR0 = Math.max(0, Math.floor(G.cameraY / TILE_SIZE));
        const spkR1 = Math.min(GRID_ROWS, Math.ceil((G.cameraY + CANVAS_H) / TILE_SIZE));
        const spkC0 = Math.max(0, Math.floor(G.cameraX / TILE_SIZE));
        const spkC1 = Math.min(GRID_COLS, Math.ceil((G.cameraX + CANVAS_W) / TILE_SIZE));
        for (let r = spkR0; r < spkR1; ++r)
          for (let c = spkC0; c < spkC1; ++c)
            if (G.undergroundGrid[r][c] !== TILE_EMPTY && G.undergroundGrid[r][c] !== TILE_DIRT && G.undergroundGrid[r][c] !== TILE_GADGET && G.undergroundGrid[r][c] !== TILE_CORE && G.undergroundGrid[r][c] !== TILE_CHEST)
              candidates.push({ r, c });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const sx = pick.c * TILE_SIZE + Math.random() * TILE_SIZE - G.cameraX;
          const sy = pick.r * TILE_SIZE + Math.random() * TILE_SIZE - G.cameraY;
          particles.sparkle(sx, sy, 1, { color: TILE_HIGHLIGHT_COLORS[G.undergroundGrid[pick.r][pick.c]] || '#fff', speed: 0.5 });
        }
      }
    }

    // Update enemy animation phases
    for (const e of G.enemies) {
      if (e.wobblePhase === undefined) {
        e.wobblePhase = Math.random() * TWO_PI;
        e.legPhase = Math.random() * TWO_PI;
        e.eyeBlinkTimer = 2 + Math.random() * 3;
        e.eyeBlinking = false;
      }
      const hf = enemyHitFlash.get(e);
      if (hf > 0)
        enemyHitFlash.set(e, Math.max(0, hf - dt * 6));
      e.wobblePhase += dt * 4;
      e.legPhase += dt * 8;
      if (e.type === 'flyer' || e.type === 'diver' || e.type === 'queen')
        e.wingPhase = (e.wingPhase || 0) + dt * (e.type === 'queen' ? 18 : 12);
      e.eyeBlinkTimer -= dt;
      if (e.eyeBlinkTimer <= 0) {
        e.eyeBlinking = !e.eyeBlinking;
        e.eyeBlinkTimer = e.eyeBlinking ? 0.15 : (2 + Math.random() * 3);
      }
    }
  }

  /* ======================================================================
     CRUMBLE / DUST SPAWNERS
     ====================================================================== */

  function spawnCrumble(tx, ty, color) {
    const pieces = [];
    for (let i = 0; i < 8; ++i)
      pieces.push({
        x: tx + (Math.random() - 0.5) * 20,
        y: ty + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        rot: Math.random() * TWO_PI,
        rotV: (Math.random() - 0.5) * 0.3,
        size: 4 + Math.random() * 8,
        color: color
      });
    G.crumbleEffects.push({ x: tx, y: ty, pieces, life: 0.6 });
  }

  function spawnDust(tx, ty) {
    for (let i = 0; i < 3; ++i)
      G.dustClouds.push({
        x: tx + (Math.random() - 0.5) * 30,
        y: ty + (Math.random() - 0.5) * 10,
        alpha: 0.4 + Math.random() * 0.2,
        radius: 6 + Math.random() * 8,
        expandRate: 0.5 + Math.random() * 0.3
      });
  }

  function spawnResourceGlow(tx, ty, color) {
    G.resourceGlows.push({ x: tx, y: ty, color, life: 1.0, radius: 10 });
  }

  function spawnShieldImpact(ex, ey) {
    const angle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    G.shieldImpacts.push({ angle, life: 1.0, intensity: 1.0 });
  }

  /* ======================================================================
     DAMAGE HELPER (shields)
     ====================================================================== */

  function applyDamageToEnemy(e, amount) {
    if (e.hidden) return;
    enemyHitFlash.set(e, 0.8);
    if (e.aura === 'ward')
      amount *= 0.75;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
      particles.burst(e.x, e.y, 6, { color: '#4af', speed: 2, life: 0.3 });
      if (e.shield <= 0) {
        e.shield = 0;
        SZ.GameAudio.play('zap');
        floatingText.add(e.x, e.y - (e.size || 20) - 36, 'SHIELD BROKEN', { color: '#4af', font: 'bold 22px sans-serif' });
        particles.burst(e.x, e.y, 15, { color: '#4af', speed: 3.5, life: 0.5 });
        particles.sparkle(e.x, e.y, 8, { color: '#8cf', speed: 2 });
      }
    }
    // Armour plates soak part of every hit (at least a quarter always gets through)
    if (e.armor > 0 && amount > 0) {
      const soaked = Math.min(e.armor, amount * 0.75);
      amount -= soaked;
      if (soaked > 0 && G.currentView === VIEW_SURFACE && Math.random() < 0.5) {
        particles.sparkle(e.x, e.y - (e.size || 20) * 0.3, 3, { color: '#fff0c0', speed: 2 });
        SZ.GameAudio.play('hit', { pitch: 1.8, volume: 0.35 });
      }
    }
    e.hp -= amount;
  }

  NS.animation = { updateAnimations, spawnCrumble, spawnDust, spawnResourceGlow, spawnShieldImpact,
    applyDamageToEnemy };
})();
