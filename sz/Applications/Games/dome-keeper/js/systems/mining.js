;(function() {
  'use strict';

  // Mining tiles, ore drops, gadget chambers and the tool actions (blast tool, teleporter).
  // Owns: NS.mining
  // Reads: constants, dom, rules, upgrades, gameState, animation, relocation, cargo, chests, artifacts,
  //   update
  // Reads state of: gameState, run, relocation, waves, bombs

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_PLAYING, GRID_COLS, GRID_ROWS, TILE_SIZE,
    TILE_EMPTY, TILE_GADGET, TILE_CORE, TILE_CHEST, TILE_HIGHLIGHT_COLORS, TILE_VALUES, TILE_LABELS } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { RESOURCE_TILES, getDepthMineMultiplier, getDepthValueMultiplier, getTileBaseColor,
    BASE_DRILL_SPEED, BASE_MINE_TIME, TILE_MINE_MULTIPLIER, GADGET_TOOL_COOLDOWNS } = NS.rules;
  const { getEffectiveLevel, computeMaxDomeHP } = NS.upgrades;
  const { PICKAXE_SWING_DURATION, pileByCell, MINE_GADGET_NAMES } = NS.gameState;
  const { spawnCrumble, spawnDust, spawnResourceGlow } = NS.animation;
  const { collectRelocationCore } = NS.relocation;

  /* ======================================================================
     MINING
     ====================================================================== */

  function cancelMining() {
    // Save partial progress to the tile's HP array so it persists
    if (G.miningTarget && G.miningDuration > 0 && G.miningProgress > 0) {
      const r = G.miningTarget.row;
      const c = G.miningTarget.col;
      if (G.tileMaxHP[r] && G.tileMaxHP[r][c] > 0)
        G.tileHP[r][c] = G.tileMaxHP[r][c] * (1 - Math.min(G.miningProgress / G.miningDuration, 0.99));
    }
    G.miningTarget = null;
    G.miningDir = null;
    G.miningProgress = 0;
    G.miningDuration = 0;
  }

  function getMiningTime(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    let time = BASE_MINE_TIME * depthMultiplier * tileMultiplier;

    // Drill speed upgrade reduces mining time
    const effectiveDrillSpeed = (G.primaryGadget === 'orchard' && G.primaryGadgetState.speedBoostTimer > 0)
      ? G.drillSpeed * 0.7
      : G.drillSpeed;
    // drillSpeed starts at 0.3 and decreases with upgrades; normalize to a multiplier
    time *= effectiveDrillSpeed / BASE_DRILL_SPEED;

    // Mining tools upgrade: each level reduces time by 20%
    time *= Math.pow(0.8, getEffectiveLevel('miningTools'));
    // Speed Mining: -10% per level
    time *= Math.pow(0.9, getEffectiveLevel('speedMining'));

    // Drill Gadget: 30% faster when mining consecutive tiles in the same column
    if (G.unlockedTools.drill && G.activeToolKey === 'drill' && G.toolState.drillConsecutive > 0)
      time *= getEffectiveLevel('drillCombo') > 0 ? 0.5 : 0.7;

    return time;
  }

  function tryMine(dx, dy) {
    if (G.state !== STATE_PLAYING) return;
    if (G.currentView !== VIEW_UNDERGROUND) return;
    if (G.keeperStun > 0) return;

    // every step or dig turns the keeper and his lamp that way
    G.lastMineDir = { dx, dy };
    const nx = G.drillX + dx;
    const ny = G.drillY + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile = G.undergroundGrid[ny][nx];
    if (tile === TILE_EMPTY) {
      // Movement dust
      cancelMining();
      const cx = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
      const cy = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      spawnDust(cx, cy);
      G.drillX = nx;
      G.drillY = ny;
      // Pick up dropped resources at destination
      pickUpDroppedResources();
      return;
    }

    // A secret chest is opened, not dug out
    if (tile === TILE_CHEST) {
      G.lastMineDir = { dx, dy };
      NS.chests.tryOpenChest(NS.chests.chestAt(ny, nx));
      return;
    }

    // If already mining the same block, ignore repeated starts
    if (G.miningTarget && G.miningTarget.col === nx && G.miningTarget.row === ny)
      return;

    // Start mining a new block (save progress of previous target first)
    cancelMining();
    G.miningTarget = { col: nx, row: ny };
    G.miningDir = { dx, dy };
    G.miningDuration = getMiningTime(ny, tile);
    // Digging upward: jetpack and wall climb help
    if (dy < 0) {
      if (G.unlockedTools.jetpack) G.miningDuration *= 0.8;
      if (G.unlockedTools.wallClimb) G.miningDuration *= 0.7;
    }
    // Phase Shift: the next block gives way at once
    if (G.unlockedTools.phaseShift && G.toolState.phaseShiftCooldown <= 0 && tile !== TILE_CORE) {
      G.miningDuration = 0.05;
      G.toolState.phaseShiftCooldown = 25 - 8 * (getEffectiveLevel('phaseShift') - 1);
      floatingText.add(nx * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ny * TILE_SIZE - G.cameraY, 'Phase!', { color: '#c8b0ff', font: 'bold 20px sans-serif' });
    }
    G.keeperIdle = 0;

    // Restore partial progress from persistent tile HP
    if (G.tileMaxHP[ny] && G.tileMaxHP[ny][nx] > 0 && G.tileHP[ny][nx] < G.tileMaxHP[ny][nx])
      G.miningProgress = G.miningDuration * (1 - G.tileHP[ny][nx] / G.tileMaxHP[ny][nx]);
    else
      G.miningProgress = 0;

    G.lastMineDir = { dx, dy };
    SZ.GameAudio.play('click', { pitch: 0.5 });

    // Trigger pickaxe swing animation
    G.pickaxeSwinging = true;
    G.pickaxeSwingTimer = PICKAXE_SWING_DURATION;
  }

  function completeMining() {
    if (!G.miningTarget) return;

    const nx = G.miningTarget.col;
    const ny = G.miningTarget.row;
    const dx = G.miningDir.dx;
    const dy = G.miningDir.dy;
    const tile = G.undergroundGrid[ny][nx];

    // Trigger pickaxe swing animation on completion
    G.pickaxeSwinging = true;
    G.pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    G.lastMineDir = { dx, dy };

    const tx = nx * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
    const ty = ny * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;

    // Rich mining particles
    const tileColor = getTileBaseColor(tile, ny);

    // Directional rock debris (chunks fly opposite to mining direction)
    for (let p = 0; p < 6; ++p)
      particles.trail(tx + (Math.random() - 0.5) * 12, ty + (Math.random() - 0.5) * 12, {
        vx: -dx * (1.5 + Math.random() * 2) + (Math.random() - 0.5),
        vy: -dy * (1.5 + Math.random() * 2) - Math.random() * 1.5,
        color: tileColor,
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        gravity: 0.08,
        shape: 'square'
      });

    // Small circular dust particles
    particles.burst(tx, ty, 6, { color: '#8a7a6a', speed: 1.5, life: 0.3, size: 1.5 });

    // Rock crumble animation
    spawnCrumble(tx, ty, tileColor);

    // Dust cloud at impact
    spawnDust(tx, ty);

    // Stronger shake for mining
    screenShake.trigger(4, 120);
    SZ.GameAudio.play('thud', { pitch: 0.9 + Math.random() * 0.2, volume: 0.7 });

    if (RESOURCE_TILES.includes(tile)) {
      const label = TILE_LABELS[tile];
      let value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(ny));

      if (G.unlockedTools.silkTouch)
        value = Math.round(value * 1.25);
      // Midas Lens: one ore in four comes out doubled
      if (NS.artifacts.hasArtifact('midasLens') && Math.random() < 0.25) {
        value *= 2;
        floatingText.add(tx, ty - 84, 'MIDAS x2', { color: '#ffe040', font: 'bold 24px sans-serif' });
        particles.sparkle(tx, ty, 10, { color: '#ffe040', speed: 2.2 });
      }
      // Fortune: 30% chance to double ore yield (+10% per extra level)
      if (G.unlockedTools.fortune && Math.random() < 0.3 + 0.1 * (getEffectiveLevel('fortune') - 1)) {
        value *= 2;
        const tx2 = nx * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
        const ty2 = ny * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
        floatingText.add(tx2, ty2 - 60, 'FORTUNE!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        particles.sparkle(tx2, ty2, 8, { color: '#ffd700', speed: 2 });
      }

      const fitsInInventory = NS.cargo.bagAdd(label, value);
      const excess = value - fitsInInventory;

      if (fitsInInventory > 0) {
        G.resources[label] += fitsInInventory;
        floatingText.add(tx, ty - 30, `+${fitsInInventory} ${label}`, { color: '#0f0', font: 'bold 24px sans-serif' });
      }

      // Drop excess resources on the ground
      if (excess > 0) {
        NS.cargo.addPileOre(nx, ny, tile, excess);
        floatingText.add(tx, ty - 60, `${excess} ${label} dropped!`, { color: '#f80', font: 'bold 22px sans-serif' });
      }

      SZ.GameAudio.play('pickup', { pitch: 0.9 + RESOURCE_TILES.indexOf(tile) * 0.04 });
      // Resource reveal glow burst
      spawnResourceGlow(tx, ty, TILE_HIGHLIGHT_COLORS[tile] || '#fff');
      particles.sparkle(tx, ty, 12, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2.5 });

      // Extra screen shake for precious resources
      screenShake.trigger(5, 150);
    }

    if (tile === TILE_CORE)
      collectRelocationCore(tx, ty);

    // Gadget chamber tile -- grant the chamber's gadget
    if (tile === TILE_GADGET) {
      const chamber = G.gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === ny && ch.c + dc === nx) return true;
        return false;
      });
      if (chamber) {
        grantMineGadget(chamber.gadgetType, tx, ty);
        // Clear remaining tiles of this chamber
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (G.undergroundGrid[chamber.r + dr][chamber.c + dc] === TILE_GADGET) {
              G.undergroundGrid[chamber.r + dr][chamber.c + dc] = TILE_EMPTY;
              if (G.tileHP[chamber.r + dr]) G.tileHP[chamber.r + dr][chamber.c + dc] = 0;
              if (G.tileMaxHP[chamber.r + dr]) G.tileMaxHP[chamber.r + dr][chamber.c + dc] = 0;
            }
      }
    }

    G.undergroundGrid[ny][nx] = TILE_EMPTY;
    // Reset tile HP on clear
    if (G.tileHP[ny]) G.tileHP[ny][nx] = 0;
    if (G.tileMaxHP[ny]) G.tileMaxHP[ny][nx] = 0;
    G.drillX = nx;
    G.drillY = ny;

    // Vein Miner and Tunnel Bore break more rock in one go
    if (G.unlockedTools.veinMiner && RESOURCE_TILES.includes(tile)) {
      const seen = new Set([ny * GRID_COLS + nx]);
      const queue = [[ny, nx]];
      let n = 0;
      while (queue.length && n < 10) {
        const [r, c] = queue.shift();
        for (const [ddr, ddc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + ddr, cc = c + ddc, key = rr * GRID_COLS + cc;
          if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS || seen.has(key)) continue;
          seen.add(key);
          if (G.undergroundGrid[rr][cc] !== tile || n >= 10) continue;
          breakTileInstant(rr, cc);
          queue.push([rr, cc]);
          ++n;
        }
      }
    }
    if (G.unlockedTools.tunnelBore)
      for (let k = 1; k <= 2; ++k) {
        const rr = ny + dy * k, cc = nx + dx * k;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) break;
        const t = G.undergroundGrid[rr][cc];
        if (t === TILE_EMPTY || t === TILE_GADGET || t === TILE_CORE || t === TILE_CHEST) break;
        breakTileInstant(rr, cc);
      }

    // Twin Drill: the block beside the dug one goes too (above a sideways dig, right of a vertical one)
    if (NS.artifacts.hasArtifact('twinDrill')) {
      let sr = dx !== 0 ? ny - 1 : ny, sc = dx !== 0 ? nx : nx + 1;
      if (sr < 0) sr = ny + 1;
      if (sr >= 0 && sr < GRID_ROWS && sc >= 0 && sc < GRID_COLS && G.undergroundGrid[sr][sc] !== TILE_EMPTY) {
        breakTileInstant(sr, sc);
        particles.sparkle(sc * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, sr * TILE_SIZE + TILE_SIZE / 2 - G.cameraY, 5, { color: '#ffc060', speed: 1.8 });
      }
    }
    // Quake Hammer: the blow cracks the rock all around
    if (NS.artifacts.hasArtifact('quakeHammer'))
      for (let qr = ny - 1; qr <= ny + 1; ++qr)
        for (let qc = nx - 1; qc <= nx + 1; ++qc) {
          if (qr < 0 || qr >= GRID_ROWS || qc < 0 || qc >= GRID_COLS) continue;
          const qt = G.undergroundGrid[qr][qc];
          if (qt === TILE_EMPTY || qt === TILE_CHEST || qt === TILE_CORE || !(G.tileMaxHP[qr][qc] > 0)) continue;
          G.tileHP[qr][qc] = Math.max(G.tileMaxHP[qr][qc] * 0.05, G.tileHP[qr][qc] - G.tileMaxHP[qr][qc] * 0.45);
          if (Math.random() < 0.5)
            spawnDust(qc * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, qr * TILE_SIZE + TILE_SIZE / 2 - G.cameraY);
        }

    // Track drill gadget consecutive column mining
    if (G.unlockedTools.drill && G.activeToolKey === 'drill') {
      if (dy === 1 && dx === 0 && nx === G.toolState.drillLastCol)
        ++G.toolState.drillConsecutive;
      else
        G.toolState.drillConsecutive = 0;
      G.toolState.drillLastCol = nx;
    }

    // Pick up dropped resources at destination
    pickUpDroppedResources();

    // Reveal an adjacent Relocation Core, secret chests and gadget chambers
    if (!G.relocationCore.revealed && Math.abs(G.relocationCore.r - ny) + Math.abs(G.relocationCore.c - nx) <= 1)
      G.relocationCore.revealed = true;
    NS.chests.revealChestsNear(ny, nx, 1, true);
    for (const ch of G.gadgetChambers) {
      if (ch.revealed) continue;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          const cr = ch.r + dr, cc = ch.c + dc;
          if (Math.abs(cr - ny) + Math.abs(cc - nx) === 1)
            ch.revealed = true;
        }
    }

    cancelMining();
  }

  function updateMining(dt) {
    if (!G.miningTarget) return;
    if (G.currentView !== VIEW_UNDERGROUND) {
      cancelMining();
      return;
    }

    // Check the block is still there (blast mining could clear it)
    const tile = G.undergroundGrid[G.miningTarget.row][G.miningTarget.col];
    if (tile === TILE_EMPTY) {
      cancelMining();
      return;
    }

    G.miningProgress += dt;

    // Update persistent tile HP in real-time for visual crack overlay
    const mr = G.miningTarget.row;
    const mc = G.miningTarget.col;
    if (G.tileMaxHP[mr] && G.tileMaxHP[mr][mc] > 0) {
      const ratio = Math.min(G.miningProgress / G.miningDuration, 1);
      G.tileHP[mr][mc] = G.tileMaxHP[mr][mc] * (1 - ratio);
    }

    // Periodically retrigger pickaxe swing animation while mining
    if (!G.pickaxeSwinging) {
      G.pickaxeSwinging = true;
      G.pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    }

    // Emit small mining particles while in progress
    if (Math.random() < dt * 8) {
      const tx = G.miningTarget.col * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
      const ty = G.miningTarget.row * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      const tileColor = getTileBaseColor(tile, G.miningTarget.row);
      particles.trail(tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 10, {
        vx: -(G.miningDir.dx) * (0.5 + Math.random()),
        vy: -(G.miningDir.dy) * (0.5 + Math.random()) - Math.random() * 0.5,
        color: tileColor,
        life: 0.2 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        gravity: 0.05,
        shape: 'square'
      });
    }

    if (G.miningProgress >= G.miningDuration)
      completeMining();
  }

  // Break a tile at once (Vein Miner, Tunnel Bore): ore goes into the cargo, overflow drops
  function breakTileInstant(r, c) {
    const tile = G.undergroundGrid[r][c];
    if (tile === TILE_CHEST || tile === TILE_CORE || tile === TILE_GADGET || tile === TILE_EMPTY) return;
    const tx = c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
    if (RESOURCE_TILES.includes(tile)) {
      let value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r));
      if (G.unlockedTools.silkTouch)
        value = Math.round(value * 1.25);
      const fits = NS.cargo.bagAdd(TILE_LABELS[tile], value);
      G.resources[TILE_LABELS[tile]] += fits;
      if (value > fits)
        NS.cargo.addPileOre(c, r, tile, value - fits);
      particles.sparkle(tx, ty, 6, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2 });
    }
    spawnCrumble(tx, ty, getTileBaseColor(tile, r));
    G.undergroundGrid[r][c] = TILE_EMPTY;
    G.tileHP[r][c] = 0;
    G.tileMaxHP[r][c] = 0;
    if (!G.relocationCore.revealed && Math.abs(G.relocationCore.r - r) + Math.abs(G.relocationCore.c - c) <= 1)
      G.relocationCore.revealed = true;
  }

  // Ore on the keeper's cell hops into the bag
  function pickUpDroppedResources() {
    const drop = pileByCell.get(G.drillY * GRID_COLS + G.drillX);
    if (drop)
      NS.cargo.launchPileOre(drop, NS.cargo.bagWithFlyingOre(), 0.25, 22);
  }

  function grantMineGadget(type, tx, ty) {
    G.foundGadgets.push(type);
    const name = MINE_GADGET_NAMES[type] || type;
    SZ.GameAudio.play('powerup');
    floatingText.add(tx, ty - 50, `GADGET: ${name}!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.burst(tx, ty, 25, { color: '#ffd700', speed: 3, life: 0.7 });
    particles.sparkle(tx, ty, 15, { color: '#ffaa00', speed: 2 });
    screenShake.trigger(8, 200);

    switch (type) {
      case 'domeArmor':
        G.maxDomeHP = computeMaxDomeHP();
        G.domeHP = Math.min(G.domeHP + 50, G.maxDomeHP);
        floatingText.add(tx, ty - 90, '+50 Max HP!', { color: '#0f0', font: 'bold 24px sans-serif' });
        break;
      case 'blastMining':
        G.bombInv[1] += 2;
        floatingText.add(tx, ty - 90, '+2 Bombs!', { color: '#f80', font: 'bold 24px sans-serif' });
        break;
      case 'probeScanner':
        G.primaryGadgetState.probeTimer = 15;
        G.primaryGadgetState.probePlayerR = G.drillY;
        G.primaryGadgetState.probePlayerC = G.drillX;
        floatingText.add(tx, ty - 90, 'Resources Revealed!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        break;
      case 'autoCannon':
        G.primaryGadgetState.autoCannonTimer = 0;
        break;
      case 'stunLaser':
        G.primaryGadgetState.stunLaserTimer = 0;
        G.primaryGadgetState.stunLaserTarget = null;
        G.primaryGadgetState.stunLaserFlash = 0;
        break;
      case 'condenser':
        G.primaryGadgetState.condenserTimer = 0;
        break;
    }
  }

  /* ======================================================================
     TOOL ACTIONS
     ====================================================================== */

  function useBlastTool() {
    if (!G.unlockedTools.blastTool) return;
    if (G.toolState.blastToolCooldown > 0) return;
    if (G.state !== STATE_PLAYING || G.currentView !== VIEW_UNDERGROUND) return;
    const upgraded = getEffectiveLevel('blastToolLevel') > 0;
    const ironCost = upgraded ? 5 : 10;
    if (G.resources.iron < ironCost) {
      SZ.GameAudio.play('error');
      floatingText.add(
        G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX,
        G.drillY * TILE_SIZE - 10 - G.cameraY,
        `Need ${ironCost} iron!`, { color: '#f44', font: 'bold 24px sans-serif' }
      );
      return;
    }

    G.resources.iron -= ironCost;
    G.toolState.blastToolCooldown = upgraded ? GADGET_TOOL_COOLDOWNS.blastTool / 2 : GADGET_TOOL_COOLDOWNS.blastTool;
    SZ.GameAudio.play('explode');

    floatingText.add(
      G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX,
      G.drillY * TILE_SIZE - 10 - G.cameraY,
      `BLAST! (-${ironCost} iron)`, { color: '#f80', font: 'bold 28px sans-serif' }
    );

    // Clear 3x3 area around player
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        const r = G.drillY + dr, c = G.drillX + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        const tile = G.undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;

        const tx = c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
        const ty = r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;

        if (tile === TILE_CHEST) {
          NS.chests.revealChest(NS.chests.chestAt(r, c), true);
          continue;
        }
        if (tile === TILE_GADGET) {
          const chamber = G.gadgetChambers.find(ch => {
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                if (ch.r + dr2 === r && ch.c + dc2 === c) return true;
            return false;
          });
          if (chamber) {
            grantMineGadget(chamber.gadgetType, tx, ty);
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                G.undergroundGrid[chamber.r + dr2][chamber.c + dc2] = TILE_EMPTY;
          }
        } else if (tile === TILE_CORE) {
          collectRelocationCore(tx, ty);
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r));
          const fitsInInventory = NS.cargo.bagAdd(label, value);
          const excess = value - fitsInInventory;
          if (fitsInInventory > 0)
            G.resources[label] += fitsInInventory;
          if (excess > 0)
            NS.cargo.addPileOre(c, r, tile, excess);
        }
        G.undergroundGrid[r][c] = TILE_EMPTY;
        if (G.tileHP[r]) G.tileHP[r][c] = 0;
        if (G.tileMaxHP[r]) G.tileMaxHP[r][c] = 0;
        particles.burst(tx, ty, 8, { color: '#f44', speed: 2.5, life: 0.4 });
        spawnCrumble(tx, ty, getTileBaseColor(tile, r));
      }

    const cx = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
    const cy = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
    particles.burst(cx, cy, 30, { color: '#f80', speed: 4, life: 0.6 });
    particles.burst(cx, cy, 15, { color: '#ff0', speed: 3, life: 0.4 });
    screenShake.trigger(10, 300);
  }

  function useTeleporter() {
    const anchor = NS.artifacts.hasArtifact('warpAnchor');
    if (!G.unlockedTools.teleporter && !anchor) return;
    if (G.toolState.teleporterCooldown > 0 && !anchor) return;
    if (G.state !== STATE_PLAYING || G.currentView !== VIEW_UNDERGROUND) return;

    G.toolState.teleporterCooldown = anchor ? 0 : GADGET_TOOL_COOLDOWNS.teleporter - 5 * getEffectiveLevel('teleportCooldown');

    // Teleport particles at origin
    const cx = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
    const cy = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
    particles.burst(cx, cy, 20, { color: '#a0f', speed: 3, life: 0.5 });
    particles.sparkle(cx, cy, 10, { color: '#c4f', speed: 2 });
    screenShake.trigger(6, 200);
    SZ.GameAudio.play('whoosh', { pitch: 1.6 });

    // Cancel mining and movement
    cancelMining();
    NS.update.clearMoveTarget();

    // Deposit carried resources
    if (G.carried > 0) {
      const total = NS.cargo.bagTotal();
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${total} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      NS.artifacts.depositScore(total, CANVAS_W / 2, CANVAS_H / 2 + 40);
      G.bag = {};
      G.carried = 0;
    }

    // Switch to surface
    G.transitionTarget = VIEW_SURFACE;
    G.transitionProgress = 0;
    G.transitionPhase = 'fade-out';

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'Teleported!', { color: '#a0f', font: 'bold 32px sans-serif' });
  }

  function selectTool(key) {
    if (!G.unlockedTools[key]) return;
    // Scanner and reinforcedDome are passive -- no selection needed
    if (key === 'scanner' || key === 'reinforcedDome') return;
    G.activeToolKey = G.activeToolKey === key ? null : key;
  }

  NS.mining = { cancelMining, tryMine, updateMining, pickUpDroppedResources, grantMineGadget, useBlastTool,
    useTeleporter, selectTool };
})();
