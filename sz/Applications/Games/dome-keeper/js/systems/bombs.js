;(function() {
  'use strict';

  // Bombs: crafting, combining, dropping, throwing, lobbing, fuses and blasts in the mine and on the surface.
  // Owns: NS.bombs and these state fields:
  //   G.bombInv, G.bombSel, G.placedBombs, G.surfaceBombs, G.pendingBlasts, G.blasts, G.bombThrowMode,
  //   G.keeperStun, G.craftFocus, G.craftHover, G.stateBeforeCraft
  // Reads: constants, dom, rules, upgrades, animation, mining, cargo, chests, update
  // Reads state of: gameState, relocation

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_PLAYING, GRID_COLS, GRID_ROWS, TILE_SIZE,
    TILE_EMPTY, TILE_GADGET, TILE_COAL, TILE_URANIUM, TILE_CORE, TILE_CHEST, TILE_VALUES } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { RESOURCE_TILES, getDepthValueMultiplier, getTileBaseColor, DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { isTreeNodeMaxed, getEffectiveLevel } = NS.upgrades;
  const { spawnCrumble, applyDamageToEnemy } = NS.animation;
  const { cancelMining, grantMineGadget } = NS.mining;

  /* ======================================================================
     BOMBS -- crafted in the dome, combined into bigger ones, dropped or
     thrown in the mine and lobbed at monsters on the surface
     ====================================================================== */

  // radius in tiles, power in seconds of mining a blast does at its centre,
  // monster damage when lobbed on the surface
  const BOMB_TIERS = [
    { key: 'charge', name: 'Charge', icon: 'bombCharge', radius: 1.3, power: 2.2, monster: 45, color: '#ff8a50',
      recipe: { iron: 6, coal: 4 } },
    { key: 'bomb', name: 'Bomb', icon: 'bomb', radius: 2.1, power: 4, monster: 90, color: '#ffb040',
      recipe: { iron: 12, coal: 8, tin: 4 }, recipeNode: 'recipeBomb' },
    { key: 'big', name: 'Big Bomb', icon: 'bombBig', radius: 3.1, power: 7, monster: 160, color: '#ffd060',
      recipe: { cobalt: 8, coal: 14, redstone: 6 }, recipeNode: 'recipeBig' },
    { key: 'mega', name: 'Mega Bomb', icon: 'bombMega', radius: 4.3, power: 11, monster: 260, color: '#ffe680',
      recipe: { titanium: 5, redstone: 10, uranium: 2 }, recipeNode: 'recipeMega' },
    { key: 'void', name: 'Void Bomb', icon: 'bombVoid', radius: 6.2, power: 18, monster: 450, color: '#c08aff',
      recipe: { uranium: 6, amethyst: 4, voidstone: 2 }, recipeNode: 'recipeVoid' }
  ];
  const BOMB_COMBINE = 3;            // bombs of one size that merge into one of the next
  const BOMB_BASE_FUSE = 2.5;        // seconds
  const BOMB_BASE_CAPACITY = 8;
  const BOMB_THROW_RANGE = 4;        // tiles
  const KEEPER_STUN_TIME = 2.5;      // seconds a keeper caught in a blast is dazed

  G.bombInv = [0, 0, 0, 0, 0];     // bombs in stock per tier
  G.bombSel = 0;                   // tier dropped / thrown next
  G.placedBombs = [];              // in the mine: { r, c, tier, fuse, maxFuse, fly }
  G.surfaceBombs = [];             // lobbed at monsters: { x0, y0, tx, ty, t, dur, tier }
  G.pendingBlasts = [];            // chain reactions waiting to go off: { r, c, R, power, delay }
  G.blasts = [];                   // explosion visuals: { x, y, R, t, life, tier, under }
  G.bombThrowMode = false;         // next click throws the selected bomb
  G.keeperStun = 0;                // seconds the keeper stays dazed
  G.craftFocus = 0;                // workshop row selected by keyboard
  G.craftHover = null;             // { row, kind } under the mouse
  G.stateBeforeCraft = null;
  const craftFlash = {};             // `${row}` -> time of the last craft (ms)

  function bombCount() {
    return G.bombInv.reduce((s, n) => s + n, 0);
  }

  function bombCapacity() {
    return BOMB_BASE_CAPACITY + 4 * getEffectiveLevel('bombSatchel');
  }

  function bombRadius(tier) {
    return BOMB_TIERS[tier].radius + 0.5 * getEffectiveLevel('blastRadius');
  }

  function bombPower(tier) {
    return BOMB_TIERS[tier].power * (1 + 0.3 * getEffectiveLevel('bombPower'));
  }

  function bombFuse() {
    return Math.max(1, BOMB_BASE_FUSE - 0.6 * getEffectiveLevel('bombFuse'));
  }

  // Share of the ore in blasted tiles that survives (the rest is pulverised)
  function bombYield() {
    return [0.5, 0.8, 1, 1.25][Math.min(3, getEffectiveLevel('bombYield'))];
  }

  function bombThrowRange() {
    return BOMB_THROW_RANGE + (G.unlockedTools.stickyBombs ? 2 : 0);
  }

  function recipeKnown(tier) {
    const node = BOMB_TIERS[tier].recipeNode;
    return !node || isTreeNodeMaxed(node);
  }

  // Recipe with the Bombsmith discount
  function craftCost(tier) {
    const k = 1 - 0.15 * getEffectiveLevel('bombsmith');
    const out = {};
    const r = BOMB_TIERS[tier].recipe;
    for (const key in r)
      out[key] = Math.max(1, Math.ceil(r[key] * k));
    return out;
  }

  function canPay(cost) {
    for (const key in cost)
      if ((G.resources[key] || 0) < cost[key])
        return false;
    return true;
  }

  // Why a bomb of this tier cannot be crafted right now (null when it can)
  function craftBlocker(tier) {
    if (!recipeKnown(tier)) return 'Recipe locked: buy it in the Tools branch';
    if (bombCount() >= bombCapacity()) return `Bomb storage full (${bombCapacity()})`;
    if (!canPay(craftCost(tier))) return 'Not enough resources';
    return null;
  }

  function craftBomb(tier) {
    const why = craftBlocker(tier);
    if (why) {
      SZ.GameAudio.play('error');
      floatingText.add(CANVAS_W / 2, 140, why, { color: '#ff8a7a', font: 'bold 22px sans-serif' });
      return false;
    }
    const cost = craftCost(tier);
    for (const key in cost)
      G.resources[key] -= cost[key];
    ++G.bombInv[tier];
    G.bombSel = tier;
    craftFlash[tier] = performance.now();
    SZ.GameAudio.play('pickup', { pitch: 0.8 + tier * 0.12 });
    SZ.GameAudio.play('click', { pitch: 0.6 });
    return true;
  }

  function combineBombs(tier) {
    if (tier >= BOMB_TIERS.length - 1 || G.bombInv[tier] < BOMB_COMBINE) {
      SZ.GameAudio.play('error');
      return false;
    }
    G.bombInv[tier] -= BOMB_COMBINE;
    ++G.bombInv[tier + 1];
    G.bombSel = tier + 1;
    craftFlash[tier + 1] = performance.now();
    SZ.GameAudio.play('powerup', { pitch: 0.9 + tier * 0.1, volume: 0.8 });
    return true;
  }

  // Next tier that is in stock, searching forward (dir 1) or back (-1)
  function cycleBomb(dir) {
    for (let i = 1; i <= BOMB_TIERS.length; ++i) {
      const t = (G.bombSel + dir * i + BOMB_TIERS.length * 2) % BOMB_TIERS.length;
      if (G.bombInv[t] > 0) {
        G.bombSel = t;
        SZ.GameAudio.play('blip', { pitch: 1 + t * 0.1, volume: 0.6 });
        return;
      }
    }
    SZ.GameAudio.play('error');
  }

  // A tier that can be used now: the selected one, otherwise the smallest in stock
  function readyBombTier() {
    if (G.bombInv[G.bombSel] > 0) return G.bombSel;
    const t = G.bombInv.findIndex(n => n > 0);
    if (t >= 0) G.bombSel = t;
    return t;
  }

  function noBombsHint() {
    SZ.GameAudio.play('error');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 80, 'No bombs - press C to craft some', { color: '#ffb070', font: 'bold 24px sans-serif' });
  }

  function bombAt(r, c) {
    return G.placedBombs.find(b => b.r === r && b.c === c);
  }

  // Drop the selected bomb at the keeper's feet
  function placeBomb() {
    if (G.state !== STATE_PLAYING || G.currentView !== VIEW_UNDERGROUND) return;
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    if (bombAt(G.drillY, G.drillX)) {
      SZ.GameAudio.play('error');
      return;
    }
    --G.bombInv[tier];
    G.placedBombs.push({ r: G.drillY, c: G.drillX, tier, fuse: bombFuse(), maxFuse: bombFuse(), fly: null });
    G.bombThrowMode = false;
    SZ.GameAudio.play('drop', { pitch: 0.8 });
    floatingText.add(G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, G.drillY * TILE_SIZE - 20 - G.cameraY, `${BOMB_TIERS[tier].name} placed - run!`, { color: '#ffb070', font: 'bold 20px sans-serif' });
  }

  // Tiles the flight passes through (keeper excluded, target included)
  function throwLine(c0, r0, c1, r1) {
    const pts = [];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let i = 1; i <= n; ++i)
      pts.push([Math.round(r0 + (r1 - r0) * i / n), Math.round(c0 + (c1 - c0) * i / n)]);
    return pts;
  }

  // Can the keeper throw a bomb onto this tile? Open tunnel in reach with a free
  // line of flight; Sticky Bombs also cling to a rock face next to a tunnel
  function throwTarget(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return { ok: false, why: 'Out of the mine' };
    if (Math.hypot(col - G.drillX, row - G.drillY) > bombThrowRange() + 0.5) return { ok: false, why: 'Too far to throw' };
    if (col === G.drillX && row === G.drillY) return { ok: false, why: 'Use B to drop it here' };
    const solid = G.undergroundGrid[row][col] !== TILE_EMPTY;
    if (solid && !G.unlockedTools.stickyBombs) return { ok: false, why: 'Throw into an open tunnel' };
    const line = throwLine(G.drillX, G.drillY, col, row);
    for (let i = 0; i < line.length - 1; ++i)
      if (G.undergroundGrid[line[i][0]][line[i][1]] !== TILE_EMPTY)
        return { ok: false, why: 'Rock is in the way' };
    if (bombAt(row, col)) return { ok: false, why: 'A bomb already lies there' };
    return { ok: true, sticky: solid };
  }

  function throwBombAt(col, row) {
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    const t = throwTarget(col, row);
    if (!t.ok) {
      SZ.GameAudio.play('error');
      floatingText.add(col * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, row * TILE_SIZE - 10 - G.cameraY, t.why, { color: '#ff8a7a', font: 'bold 18px sans-serif' });
      return;
    }
    --G.bombInv[tier];
    G.placedBombs.push({
      r: row, c: col, tier, fuse: bombFuse(), maxFuse: bombFuse(), sticky: t.sticky,
      fly: { x: G.drillX * TILE_SIZE + TILE_SIZE / 2, y: G.drillY * TILE_SIZE + TILE_SIZE / 2, t: 0, dur: 0.25 + Math.hypot(col - G.drillX, row - G.drillY) * 0.05 }
    });
    G.bombThrowMode = false;
    SZ.GameAudio.play('whoosh', { pitch: 1.4, volume: 0.6 });
  }

  // Lob a bomb from the turret at a point on the battlefield
  function lobSurfaceBomb(tx, ty) {
    const tier = readyBombTier();
    if (tier < 0) return noBombsHint();
    ty = Math.min(DOME_Y - 8, ty);
    const dd = Math.hypot(tx - DOME_X, ty - DOME_Y);
    if (dd < DOME_RADIUS + 40) {
      const a = Math.atan2(ty - DOME_Y, tx - DOME_X) || -Math.PI / 2;
      tx = DOME_X + Math.cos(a) * (DOME_RADIUS + 40);
      ty = Math.min(DOME_Y - 8, DOME_Y + Math.sin(a) * (DOME_RADIUS + 40));
    }
    --G.bombInv[tier];
    const x0 = DOME_X + Math.cos(G.turretAngle) * (DOME_RADIUS + 30), y0 = DOME_Y + Math.sin(G.turretAngle) * (DOME_RADIUS + 30);
    G.surfaceBombs.push({ x0, y0, tx, ty, t: 0, dur: 0.45 + Math.hypot(tx - x0, ty - y0) / 1400, tier });
    G.bombThrowMode = false;
    SZ.GameAudio.play('whoosh', { pitch: 0.9 });
  }

  // Break open the gadget chamber that owns (r, c)
  function openChamberAt(r, c, tx, ty) {
    const chamber = G.gadgetChambers.find(ch => r >= ch.r && r <= ch.r + 1 && c >= ch.c && c <= ch.c + 1);
    if (!chamber) {
      G.undergroundGrid[r][c] = TILE_EMPTY;
      G.tileHP[r][c] = G.tileMaxHP[r][c] = 0;
      return;
    }
    grantMineGadget(chamber.gadgetType, tx, ty);
    for (let dr = 0; dr < 2; ++dr)
      for (let dc = 0; dc < 2; ++dc)
        if (G.undergroundGrid[chamber.r + dr][chamber.c + dc] === TILE_GADGET) {
          G.undergroundGrid[chamber.r + dr][chamber.c + dc] = TILE_EMPTY;
          G.tileHP[chamber.r + dr][chamber.c + dc] = G.tileMaxHP[chamber.r + dr][chamber.c + dc] = 0;
        }
  }

  // Tiles a blast never breaks; it only lays them open
  function isBlastProof(tile) {
    return tile === TILE_CORE || tile === TILE_CHEST;
  }

  function revealBlastProof(r, c, tile) {
    if (tile === TILE_CORE)
      G.relocationCore.revealed = true;
    else if (tile === TILE_CHEST && NS.chests.chestAt(r, c))
      NS.chests.revealChest(NS.chests.chestAt(r, c), true);
  }

  // Explosion in the mine centred on tile (cr, cc): rock takes damage that
  // falls off towards the rim, broken ore drops as loose piles
  function blastUnderground(cr, cc, R, power, tier, chained) {
    const onScreen = G.currentView === VIEW_UNDERGROUND;
    let broken = 0, ore = 0;
    const ext = Math.ceil(R);
    const yieldK = bombYield();
    for (let r = cr - ext; r <= cr + ext; ++r) {
      if (r < 0 || r >= GRID_ROWS) continue;
      for (let c = cc - ext; c <= cc + ext; ++c) {
        if (c < 0 || c >= GRID_COLS) continue;
        const d = Math.hypot(r - cr, c - cc);
        if (d > R) continue;
        const tile = G.undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;
        const tx = c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
        if (isBlastProof(tile)) {
          revealBlastProof(r, c, tile);
          continue;
        }
        if (tile === TILE_GADGET) {
          openChamberAt(r, c, tx, ty);
          continue;
        }
        const dmg = power * (1 - 0.45 * d / Math.max(1, R));
        if (G.tileHP[r][c] > dmg) {
          G.tileHP[r][c] -= dmg;          // cracked, not broken
          continue;
        }
        if (RESOURCE_TILES.includes(tile)) {
          const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(r) * yieldK);
          NS.cargo.dropOre(r, c, tile, value);
          ore += value;
          // Chain Reaction: coal and uranium seams go off as well
          if (G.unlockedTools.chainReaction && (tile === TILE_COAL || tile === TILE_URANIUM) && G.pendingBlasts.length < 12)
            G.pendingBlasts.push({ r, c, R: tile === TILE_URANIUM ? 2.1 : 1.4, power: tile === TILE_URANIUM ? 5 : 2.6, delay: 0.12 + Math.random() * 0.25, tier: tile === TILE_URANIUM ? 2 : 0 });
        }
        if (onScreen) {
          spawnCrumble(tx, ty, getTileBaseColor(tile, r));
          if (Math.random() < 0.5)
            particles.burst(tx, ty, 4, { color: getTileBaseColor(tile, r), speed: 2.5, life: 0.4, gravity: 0.1 });
        }
        G.undergroundGrid[r][c] = TILE_EMPTY;
        G.tileHP[r][c] = G.tileMaxHP[r][c] = 0;
        ++broken;
      }
    }
    // Neighbouring bombs go off almost at once
    for (const b of G.placedBombs)
      if (!b.fly && Math.hypot(b.r - cr, b.c - cc) <= R + 0.5)
        b.fuse = Math.min(b.fuse, 0.15);
    // The keeper is knocked out unless wearing a Blast Suit
    if (!G.unlockedTools.blastSuit && Math.hypot(G.drillY - cr, G.drillX - cc) <= R + 0.4) {
      G.keeperStun = KEEPER_STUN_TIME;
      cancelMining();
      NS.update.clearMoveTarget();
      if (onScreen)
        floatingText.add(G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, G.drillY * TILE_SIZE - 30 - G.cameraY, 'Knocked out!', { color: '#ff7a6a', font: 'bold 24px sans-serif' });
      SZ.GameAudio.play('hurt', { pitch: 1.3, volume: 0.7 });
    }
    // Light the tunnel walls the blast opened up
    if (!G.relocationCore.revealed && Math.abs(G.relocationCore.r - cr) <= ext + 1 && Math.abs(G.relocationCore.c - cc) <= ext + 1)
      G.relocationCore.revealed = true;
    for (const ch of G.gadgetChambers)
      if (!ch.revealed && Math.hypot(ch.r - cr, ch.c - cc) <= R + 1.5)
        ch.revealed = true;

    const wx = cc * TILE_SIZE + TILE_SIZE / 2, wy = cr * TILE_SIZE + TILE_SIZE / 2;
    G.blasts.push({ x: wx, y: wy, R: (R + 0.4) * TILE_SIZE, t: 0, life: 0.55 + tier * 0.1, tier, under: true });
    const vol = onScreen ? 1 : 0.35;
    SZ.GameAudio.play('explode', { pitch: 1.25 - tier * 0.16, volume: (0.6 + tier * 0.1) * vol });
    if (tier >= 2)
      SZ.GameAudio.noise(0.5 + tier * 0.25, 0.14 * vol, 'lowpass', 500, 60);
    if (tier === 4)
      SZ.GameAudio.sweep(900, 60, 0.9, 'sawtooth', 0.06 * vol);
    if (onScreen) {
      const sx = wx - G.cameraX, sy = wy - G.cameraY;
      particles.burst(sx, sy, 24 + tier * 12, { color: BOMB_TIERS[tier].color, speed: 3 + tier, life: 0.5 + tier * 0.08 });
      particles.burst(sx, sy, 12 + tier * 6, { color: '#fff4c0', speed: 2 + tier * 0.6, life: 0.3 });
      if (tier === 4)
        particles.sparkle(sx, sy, 30, { color: '#d0a0ff', speed: 4 });
      screenShake.trigger(Math.min(22, 7 + tier * 4), 260 + tier * 70);
      if (!chained && (broken || ore))
        floatingText.add(sx, sy - R * TILE_SIZE * 0.5 - 20, `BOOM! ${broken} ${broken === 1 ? 'block' : 'blocks'}` + (ore > 0 ? ` · ${ore} ore loose` : ''), { color: BOMB_TIERS[tier].color, font: 'bold 24px sans-serif' });
    }
  }

  function detonateBomb(b) {
    G.placedBombs.splice(G.placedBombs.indexOf(b), 1);
    blastUnderground(b.r, b.c, bombRadius(b.tier), bombPower(b.tier), b.tier, false);
  }

  // A lobbed bomb lands among the monsters
  function blastSurface(x, y, tier) {
    const R = 70 + 26 * bombRadius(tier);
    const dmg = BOMB_TIERS[tier].monster * (1 + 0.3 * getEffectiveLevel('bombPower'));
    let hits = 0;
    for (const e of G.enemies) {
      if (e.hidden) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R + (e.size || 16)) continue;
      applyDamageToEnemy(e, Math.ceil(dmg * (1 - 0.5 * Math.min(1, d / R))));
      e.stunTimer = Math.max(e.stunTimer || 0, 0.6);
      ++hits;
    }
    G.blasts.push({ x, y, R, t: 0, life: 0.55 + tier * 0.1, tier, under: false });
    if (G.currentView === VIEW_SURFACE) {
      particles.burst(x, y, 26 + tier * 12, { color: BOMB_TIERS[tier].color, speed: 3.5 + tier, life: 0.6, gravity: 0.05 });
      particles.burst(x, Math.min(y, DOME_Y), 14, { color: '#7a6a58', speed: 2.5, life: 0.8, gravity: 0.12 });
      screenShake.trigger(Math.min(20, 6 + tier * 3.5), 260 + tier * 60);
      if (hits > 1)
        floatingText.add(x, y - 60, `${hits} hit!`, { color: BOMB_TIERS[tier].color, font: 'bold 24px sans-serif' });
    }
    SZ.GameAudio.play('explode', { pitch: 1.2 - tier * 0.15, volume: 0.7 + tier * 0.08 });
  }

  function updateBombs(dt) {
    if (G.keeperStun > 0)
      G.keeperStun = Math.max(0, G.keeperStun - dt);
    for (let i = G.placedBombs.length - 1; i >= 0; --i) {
      const b = G.placedBombs[i];
      if (b.fly) {
        b.fly.t += dt / b.fly.dur;
        if (b.fly.t >= 1) {
          b.fly = null;
          if (G.currentView === VIEW_UNDERGROUND)
            SZ.GameAudio.play('drop', { pitch: b.sticky ? 1.4 : 0.8, volume: 0.7 });
        }
        continue;
      }
      const before = b.fuse;
      b.fuse -= dt;
      if (G.currentView === VIEW_UNDERGROUND && Math.ceil(before * 2) !== Math.ceil(b.fuse * 2) && b.fuse > 0)
        SZ.GameAudio.play('blip', { pitch: b.fuse < 1 ? 1.6 : 1.1, volume: 0.35 });
    }
    // Several bombs may go off in one frame; detonate one by one
    for (let guard = 0; guard < 40; ++guard) {
      const b = G.placedBombs.find(x => !x.fly && x.fuse <= 0);
      if (!b) break;
      detonateBomb(b);
    }
    for (let i = G.pendingBlasts.length - 1; i >= 0; --i) {
      const p = G.pendingBlasts[i];
      p.delay -= dt;
      if (p.delay > 0) continue;
      G.pendingBlasts.splice(i, 1);
      blastUnderground(p.r, p.c, p.R, p.power, p.tier, true);
    }
    for (let i = G.surfaceBombs.length - 1; i >= 0; --i) {
      const s = G.surfaceBombs[i];
      s.t += dt / s.dur;
      if (s.t >= 1) {
        G.surfaceBombs.splice(i, 1);
        blastSurface(s.tx, s.ty, s.tier);
      }
    }
  }

  // Explosion visuals age with real time so they also fade while paused
  function updateBlastVisuals(dt) {
    for (let i = G.blasts.length - 1; i >= 0; --i) {
      G.blasts[i].t += dt;
      if (G.blasts[i].t >= G.blasts[i].life) G.blasts.splice(i, 1);
    }
  }

  // Detonate every bomb lying in the mine (Remote Detonator)
  function remoteDetonate() {
    if (!G.unlockedTools.remoteDetonator) return;
    const armed = G.placedBombs.filter(b => !b.fly);
    if (!armed.length) {
      SZ.GameAudio.play('error');
      return;
    }
    armed.forEach((b, i) => { b.fuse = Math.min(b.fuse, 0.05 + i * 0.08); });
    SZ.GameAudio.play('zap', { pitch: 1.6, volume: 0.6 });
  }

  NS.bombs = { BOMB_TIERS, BOMB_COMBINE, BOMB_BASE_FUSE, craftFlash, bombCount, bombCapacity, bombRadius,
    bombPower, bombThrowRange, recipeKnown, craftCost, craftBlocker, craftBomb, combineBombs, cycleBomb,
    readyBombTier, noBombsHint, placeBomb, throwTarget, throwBombAt, lobSurfaceBomb, updateBombs,
    updateBlastVisuals, remoteDetonate };
})();
