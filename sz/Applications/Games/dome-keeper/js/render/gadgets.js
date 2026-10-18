;(function() {
  'use strict';

  // Drawing gadgets, the surface HUD, key hints and the Relocation Core marker.
  // Owns: NS.gadgetArt
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, hudFading, rules, upgrades, gameState,
  //   time, relocation, cinematicArt, waves, chests, artifacts, droneArt, biomes, undergroundArt, combatArt
  // Reads state of: gameState, relocation, waves, chests, artifacts, drones, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_DIRT, TILE_GADGET, TILE_CORE,
    TILE_CHEST, TILE_HIGHLIGHT_COLORS, TILE_ICONS } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { SPRITE_OUTLINE, drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { uiFont, fitText } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawMeter, drawChip } = NS.panels;
  const { beginHudPanel, endHudPanel } = NS.hudFading;
  const { RESOURCE_TILES, DOME_RADIUS, DOME_X, DOME_Y, TOOL_DEFS } = NS.rules;
  const { totalResources, getEffectiveLevel } = NS.upgrades;
  const { MINE_GADGET_NAMES } = NS.gameState;
  const { isNight, drawClockPanel } = NS.time;
  const { coreDepthHint, relocateButtonRect } = NS.relocation;
  const { drawRelocateButton } = NS.cinematicArt;
  const { threatLevel, threatColor } = NS.waves;
  const { chestAt, chestsOpened, revealChest } = NS.chests;
  const { hasArtifact, aegisMax, drawArtifactStrip } = NS.artifacts;
  const { drawSurfaceDrones } = NS.droneArt;
  const { currentBiome } = NS.biomes;
  const { drawTile } = NS.undergroundArt;

  /* ======================================================================
     DRAWING -- GADGETS
     ====================================================================== */

  function drawSurfaceGadgets() {
    // Shield Generator: blue arc around dome when active
    if (G.primaryGadget === 'shield' && G.primaryGadgetState.active) {
      ctx.save();
      const shieldPulse = Math.sin(G.animTime * 4) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 12, Math.PI, 0);
      ctx.strokeStyle = `rgba(80,180,255,${0.5 * shieldPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 16, Math.PI + 0.2, -0.2);
      ctx.strokeStyle = `rgba(120,200,255,${0.3 * shieldPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Repellent Field: expanding purple ring
    if (G.primaryGadget === 'repellent' && G.primaryGadgetState.active) {
      ctx.save();
      const ringPulse = Math.sin(G.animTime * 6) * 0.2 + 0.8;
      const ringRadius = DOME_RADIUS + 40 + Math.sin(G.animTime * 3) * 10;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius, 0, TWO_PI);
      ctx.strokeStyle = `rgba(160,80,220,${0.6 * ringPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#a0f';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius + 10, 0, TWO_PI);
      ctx.strokeStyle = `rgba(180,100,240,${0.25 * ringPulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Orchard: small tree inside dome
    if (G.primaryGadget === 'orchard') {
      const treeX = DOME_X - 60;
      const treeY = DOME_Y - 16;
      drawSprite('tree', treeX, treeY - 26, 52);
      // Fruit (glowing when ready)
      if (G.primaryGadgetState.fruitReady) {
        const fruitGlow = Math.sin(G.animTime * 5) * 0.3 + 0.7;
        drawGlow('#ffd040', treeX + 10, treeY - 30, 18, fruitGlow);
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 7, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = `rgba(255,200,50,${fruitGlow})`;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 5.5, 0, TWO_PI);
        ctx.fill();
      }
    }

    drawSurfaceDrones();

    // Auto Cannon: turret on top of dome (apex) so it can reach both sides
    if (G.foundGadgets.includes('autoCannon')) {
      const acX = DOME_X;
      const acY = DOME_Y - DOME_RADIUS;
      // Base
      ctx.fillStyle = '#667';
      ctx.fillRect(acX - 10, acY - 4, 20, 16);
      // Barrel (points upward)
      ctx.fillStyle = '#556';
      ctx.fillRect(acX - 3, acY - 20, 6, 20);
      // Muzzle flash
      if (G.primaryGadgetState.autoCannonFlash > 0 && G.primaryGadgetState.autoCannonTarget) {
        const t = G.primaryGadgetState.autoCannonTarget;
        const alpha = G.primaryGadgetState.autoCannonFlash / 0.3;
        ctx.strokeStyle = `rgba(255,255,0,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,200,0,${alpha * 0.4})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
    }

    // Stun Laser: blue beam from dome to target
    if (G.foundGadgets.includes('stunLaser') && G.primaryGadgetState.stunLaserFlash > 0 && G.primaryGadgetState.stunLaserTarget) {
      const t = G.primaryGadgetState.stunLaserTarget;
      const alpha = G.primaryGadgetState.stunLaserFlash / 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(80,160,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4af';
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(150,210,255,${alpha * 0.6})`;
      ctx.lineWidth = 10;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Emergency Shield: golden bubble while invulnerable
    if (G.domeInvulnerable > 0) {
      const a = Math.min(1, G.domeInvulnerable) * (0.6 + Math.sin(G.animTime * 12) * 0.2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 22, Math.PI, 0);
      ctx.strokeStyle = `rgba(255,220,110,${a})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = '#ffd060';
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
    }

    // Reinforced Dome: extra thick dome arc
    if (G.unlockedTools.reinforcedDome) {
      ctx.save();
      const armorPulse = Math.sin(G.animTime * 2) * 0.1 + 0.9;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 8, Math.PI, 0);
      ctx.strokeStyle = `rgba(180,160,100,${0.35 * armorPulse})`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 6, Math.PI + 0.1, -0.1);
      ctx.strokeStyle = `rgba(220,200,140,${0.2 * armorPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Row of keycap hints ("[Space] Mine") centred on cx and kept within maxW
  function drawKeyHints(hints, cx, cy, maxW) {
    const keyPx = 14, labelPx = 15, keyH = 22, gap = 18;
    ctx.font = uiFont(keyPx, 'bold');
    const parts = hints.map(h => {
      ctx.font = uiFont(keyPx, 'bold');
      const kw = Math.max(keyH, ctx.measureText(h.key).width + 12);
      ctx.font = uiFont(labelPx);
      return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
    });
    let total = -gap;
    for (const p of parts)
      total += p.kw + 6 + p.lw + gap;
    const s = Math.min(1, maxW / total);
    ctx.save();
    ctx.translate(cx - total * s / 2, cy);
    ctx.scale(s, s);
    let x = 0;
    for (const p of parts) {
      roundRectPath(x, -keyH / 2, p.kw, keyH, 5);
      ctx.fillStyle = 'rgba(20,26,42,0.85)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(170,190,230,0.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 3, keyH / 2 - 3, p.kw - 6, 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = uiFont(keyPx, 'bold');
      ctx.fillStyle = '#dfe6f5';
      ctx.fillText(p.key, x + p.kw / 2, 1);
      ctx.textAlign = 'left';
      ctx.font = uiFont(labelPx);
      ctx.fillStyle = 'rgba(200,210,230,0.75)';
      ctx.fillText(p.label, x + p.kw + 6, 1);
      x += p.kw + 6 + p.lw + gap;
    }
    ctx.restore();
  }

  function drawSurfaceHUD() {
    // Day, time and moon (top-left)
    beginHudPanel('clock', 16, 16, 330, 112);
    drawClockPanel();
    endHudPanel();
    if (G.relocationCore.found) {
      const rb = relocateButtonRect();
      beginHudPanel('relocate', rb.x, rb.y, rb.w, rb.h);
      drawRelocateButton();
      endHudPanel();
    }

    drawGadgetHUD();

    // Score and stock (top-right)
    const sx = CANVAS_W - 340;
    beginHudPanel('score', sx, 16, 320, 118);
    drawPanel(sx, 16, 320, 118, { accent: UI.gold });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('SCORE', sx + 16, 38, 90, 14, { weight: 'bold', color: UI.textDim });
    fitText(`[[crate]] ${totalResources()} resources`, sx + 16, 64, 170, 16, { color: UI.textDim });
    ctx.textAlign = 'right';
    fitText(String(G.score), sx + 304, 42, 200, 30, { weight: 'bold', color: UI.gold });
    // Site, threat and the Relocation Core
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(sx + 14, 79, 292, 1);
    ctx.textAlign = 'left';
    fitText(`Site ${G.site.index + 1} · ${currentBiome().name}`, sx + 16, 96, 200, 16, { weight: 'bold', color: UI.text });
    const threat = isNight() ? Math.max(1, threatLevel()) : threatLevel() + 1; // tonight's threat
    const tc = threatColor(threat);
    drawChip(`Threat ${threat}`, sx + 306, 84, 24, { align: 'right', px: 13, maxW: 96, bg: hexToRgba(tc, 0.16), border: hexToRgba(tc, 0.6), color: tc });
    ctx.textAlign = 'left';
    ctx.textAlign = 'right';
    const chw = fitText(`[[chest]] ${chestsOpened()} / ${G.chests.length}`, sx + 306, 120, 70, 14, { weight: 'bold', color: '#e0b0ff' });
    ctx.textAlign = 'left';
    fitText(G.relocationCore.found ? '[[core]] Core found: relocate when ready' : `[[core]] Core hidden below ${coreDepthHint()} m`, sx + 16, 120, 282 - chw, 14, { color: G.relocationCore.found ? '#7ae8ff' : UI.textMute });
    endHudPanel();

    // Dome integrity under the dome
    const hpRatio = Math.max(0, G.domeHP / G.maxDomeHP);
    const barW = 280, barH = 24;
    const barX = DOME_X - barW / 2, barY = DOME_Y + 22;
    drawMeter(barX, barY, barW, barH, hpRatio, hpRatio > 0.5 ? '#46c862' : (hpRatio > 0.25 ? '#e8b030' : '#e84040'), {
      label: `Dome ${Math.ceil(G.domeHP)} / ${G.maxDomeHP}`, labelPx: 16
    });
    if (hasArtifact('aegisHeart'))
      drawMeter(barX + 20, barY + barH + 4, barW - 40, 7, G.artifactState.aegis / aegisMax(), '#6cc8ff', { track: 'rgba(0,10,30,0.7)' });
    NS.combatArt.drawCombatHUD(barX, barY, barW, barH);

    drawKeyHints([
      { key: 'Space', label: 'Underground' },
      { key: 'U', label: 'Upgrade tree' },
      { key: 'C', label: 'Bombs' },
      { key: 'H', label: 'Help' },
      { key: 'Esc', label: 'Pause' }
    ], CANVAS_W / 2 - 60, CANVAS_H - 24, 600);
  }

  function drawGadgetHUD() {
    // Collect the status lines first so the panel can be sized to them
    const rows = [];
    if (G.primaryGadget === 'shield')
      rows.push({ icon: 'shield', text: 'Shield: ' + (G.primaryGadgetState.active ? 'ACTIVE' : 'depleted'), color: G.primaryGadgetState.active ? '#6cc8ff' : UI.textMute });
    else if (G.primaryGadget === 'repellent') {
      if (G.primaryGadgetState.active)
        rows.push({ icon: 'portal', text: `Repellent: ${Math.ceil(G.primaryGadgetState.duration)}s`, color: '#c890ff' });
      else if (G.primaryGadgetState.cooldown > 0)
        rows.push({ icon: 'portal', text: `Repellent [R]: ${Math.ceil(G.primaryGadgetState.cooldown)}s`, color: UI.textMute });
      else
        rows.push({ icon: 'portal', text: 'Repellent [R]: READY', color: '#c890ff' });
    } else if (G.primaryGadget === 'orchard') {
      if (G.primaryGadgetState.speedBoostTimer > 0)
        rows.push({ icon: 'tree', text: `Mining boost: ${Math.ceil(G.primaryGadgetState.speedBoostTimer)}s`, color: UI.good });
      else if (G.primaryGadgetState.fruitReady)
        rows.push({ icon: 'tree', text: 'Fruit ready! Click the tree', color: '#ffe060' });
      else
        rows.push({ icon: 'tree', text: `Orchard: ${Math.ceil(G.primaryGadgetState.fruitTimer)}s`, color: '#4ac080' });
    }
    if (G.drones.length || G.gunDrones.length || G.repairBots.length) {
      const out = G.drones.filter(d => d.state !== 'dock').length;
      const parts = [];
      if (G.drones.length)
        parts.push(`${G.drones.length} courier${G.drones.length > 1 ? 's' : ''}${out ? ' (' + out + ' out)' : ''}`);
      if (G.gunDrones.length)
        parts.push(`${G.gunDrones.length} gun`);
      if (G.repairBots.length)
        parts.push(`${G.repairBots.length} repair`);
      rows.push({ icon: 'drone', text: 'Drones: ' + parts.join(', '), color: '#d8b8ff' });
    }

    for (const g of G.foundGadgets) {
      if (g === 'blastMining') continue;
      rows.push({ icon: 'gear', text: MINE_GADGET_NAMES[g] || g, color: '#d0c890' });
    }
    if (G.artifacts.length)
      rows.push({ artifacts: true });

    for (const def of TOOL_DEFS) {
      if (!G.unlockedTools[def.key]) continue;
      const isActive = G.activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';
      if (def.key === 'blastTool') {
        const cd = G.toolState.blastToolCooldown > 0;
        rows.push({ icon: def.icon, text: `Blast [2]: ${cd ? Math.ceil(G.toolState.blastToolCooldown) + 's' : 'READY'}`, color: cd ? UI.textMute : (isActive ? UI.gold : '#ffa040') });
      } else if (def.key === 'teleporter') {
        const cd = G.toolState.teleporterCooldown > 0;
        rows.push({ icon: def.icon, text: `Teleport [5]: ${cd ? Math.ceil(G.toolState.teleporterCooldown) + 's' : 'READY'}`, color: cd ? UI.textMute : (isActive ? UI.gold : '#c890ff') });
      } else if (def.key === 'drill') {
        const combo = isActive && G.toolState.drillConsecutive > 0 ? ` (x${G.toolState.drillConsecutive} combo)` : '';
        rows.push({ icon: def.icon, text: `Drill [1]${combo}`, color: isActive ? UI.gold : UI.textDim });
      } else if (isPassive)
        rows.push({ icon: def.icon, text: `${def.name} [${def.shortcut}]: ON`, color: UI.good });
    }
    if (!rows.length) return;

    const rowH = 28, pw = 300;
    const maxRows = 10;
    const shown = rows.slice(0, maxRows);
    const ph = 14 + shown.length * rowH;
    const px = 16, py = CANVAS_H - 58 - ph;
    beginHudPanel('gadgets', px, py, pw, ph);
    drawPanel(px, py, pw, ph, { accent: '#9a7aff', shadow: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < shown.length; ++i) {
      const r = shown[i];
      const y = py + 7 + i * rowH + rowH / 2;
      if (r.artifacts) {
        drawArtifactStrip(px + 12, y, pw - 24, 22);
        continue;
      }
      drawSprite(r.icon, px + 22, y, 20);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(r.text, px + 40, y + 1, pw - 52, 17, { weight: 'bold', color: r.color });
    }
    endHudPanel();
  }

  // Tiles the scanner sees around the keeper
  function scannerRange() {
    return 3 + (G.toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
  }

  // The Relocation Core in the rock, and the scanner's hint towards it
  function drawRelocationCoreMarker() {
    const rc = G.relocationCore;
    if (rc.found) return;
    const x = rc.c * TILE_SIZE - G.cameraX, y = rc.r * TILE_SIZE - G.cameraY;
    if (rc.revealed && x > -TILE_SIZE && x < CANVAS_W && y > -TILE_SIZE && y < CANVAS_H) {
      const pulse = Math.sin(G.animTime * 3) * 0.5 + 0.5;
      drawGlow('#7ae8ff', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * (1.2 + pulse * 0.4), 0.55);
      drawSprite('core', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + Math.sin(G.animTime * 2) * 2, 30);
      if (Math.random() < 0.05)
        particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#bff4ff', speed: 0.6 });
    }
    // Scanners sense the core: in range it shows up, further away an arrow points to it
    const scanRange = G.toolState.scannerActive ? scannerRange() : 0;
    if (!scanRange) return;
    const dist = Math.abs(rc.r - G.drillY) + Math.abs(rc.c - G.drillX);
    if (dist <= scanRange) {
      rc.revealed = true;
      return;
    }
    if (dist > scanRange * 8) return;
    const px = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, py = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
    const a = Math.atan2(rc.r - G.drillY, rc.c - G.drillX);
    const rr = (scanRange + 0.8) * TILE_SIZE;
    const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr;
    const pulse = 0.5 + Math.sin(G.animTime * 5) * 0.4;
    drawGlow('#7ae8ff', ax, ay, 34, pulse * 0.8);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(150,240,255,${0.55 + pulse * 0.45})`;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-9, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawSprite('core', ax - Math.cos(a) * 34, ay - Math.sin(a) * 34, 24, 0.6 + pulse * 0.4);
  }

  function drawUndergroundGadgets() {
    // Draw gadget chamber tiles
    for (const ch of G.gadgetChambers) {
      // Check if any tile of this chamber still exists
      let anyLeft = false;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc)
          if (G.undergroundGrid[ch.r + dr] && G.undergroundGrid[ch.r + dr][ch.c + dc] === TILE_GADGET)
            anyLeft = true;
      if (!anyLeft) continue;

      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          if (G.undergroundGrid[ch.r + dr][ch.c + dc] !== TILE_GADGET) continue;
          const x = (ch.c + dc) * TILE_SIZE - G.cameraX;
          const y = (ch.r + dr) * TILE_SIZE - G.cameraY;
          if (x < -TILE_SIZE || x > CANVAS_W || y < -TILE_SIZE || y > CANVAS_H) continue;

          if (!ch.revealed) {
            // Hidden: looks like dirt but with faint shimmer
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const shimmer = Math.sin(G.animTime * 3 + dr + dc) * 0.5 + 0.5;
            drawGlow('#ffd040', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.55, 0.12 + shimmer * 0.18);
          } else {
            // Revealed: golden plate with a pulsing "?"
            const pulse = Math.sin(G.animTime * 4) * 0.15 + 0.85;
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const pg = ctx.createLinearGradient(0, y + 3, 0, y + TILE_SIZE - 3);
            pg.addColorStop(0, '#ffe680');
            pg.addColorStop(0.5, '#d8a020');
            pg.addColorStop(1, '#8a5a08');
            roundRectPath(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 6);
            ctx.fillStyle = pg;
            ctx.globalAlpha = 0.75 + pulse * 0.25;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 2;
            ctx.strokeStyle = SPRITE_OUTLINE;
            ctx.stroke();
            drawGlow('#ffd040', x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.8, 0.25 * pulse);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            fitText('?', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1, TILE_SIZE - 10, 26, { weight: 'bold', color: '#fffbe0', outline: 'rgba(80,40,0,0.9)' });

            // Sparkle particles on border
            if (Math.random() < 0.03)
              particles.sparkle(
                x + Math.random() * TILE_SIZE,
                y + Math.random() * TILE_SIZE,
                1,
                { color: '#ffd700', speed: 0.5 }
              );
          }
        }
    }

    // Probe Scanner: highlight resource tiles within 4 tiles of pickup location
    if (G.foundGadgets.includes('probeScanner') && G.primaryGadgetState.probeTimer > 0) {
      const fadeAlpha = Math.min(1, G.primaryGadgetState.probeTimer / 3); // fade out in last 3s
      const probePulse = Math.sin(G.animTime * 5) * 0.3 + 0.7;
      const pr = G.primaryGadgetState.probePlayerR || G.drillY;
      const pc = G.primaryGadgetState.probePlayerC || G.drillX;
      const probeR0 = Math.max(0, pr - 4), probeR1 = Math.min(GRID_ROWS, pr + 5);
      const probeC0 = Math.max(0, pc - 4), probeC1 = Math.min(GRID_COLS, pc + 5);
      for (let r = probeR0; r < probeR1; ++r)
        for (let c = probeC0; c < probeC1; ++c) {
          const tile = G.undergroundGrid[r][c];
          if (tile === TILE_CORE && Math.abs(r - pr) + Math.abs(c - pc) <= 4)
            G.relocationCore.revealed = true;
          if (tile === TILE_CHEST && Math.abs(r - pr) + Math.abs(c - pc) <= 4 && chestAt(r, c))
            revealChest(chestAt(r, c), false);
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - pr) + Math.abs(c - pc) > 4) continue;
          const x = c * TILE_SIZE - G.cameraX;
          const y = r * TILE_SIZE - G.cameraY;
          ctx.strokeStyle = `rgba(255,215,0,${0.6 * probePulse * fadeAlpha})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
    }

    // Scanner gadget (unlockable tool): continuous passive reveal in 3-tile Manhattan radius
    if (G.toolState.scannerActive) {
      const scanPulse = Math.sin(G.animTime * 3) * 0.2 + 0.8;
      const scanRange = 3 + (G.toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      const scanR0 = Math.max(0, G.drillY - scanRange), scanR1 = Math.min(GRID_ROWS, G.drillY + scanRange + 1);
      const scanC0 = Math.max(0, G.drillX - scanRange), scanC1 = Math.min(GRID_COLS, G.drillX + scanRange + 1);
      for (let r = scanR0; r < scanR1; ++r)
        for (let c = scanC0; c < scanC1; ++c) {
          const tile = G.undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - G.drillY) + Math.abs(c - G.drillX) > scanRange) continue;
          const x = c * TILE_SIZE - G.cameraX;
          const y = r * TILE_SIZE - G.cameraY;

          // Semi-transparent resource type indicator
          const tileColor = TILE_HIGHLIGHT_COLORS[tile] || '#fff';
          ctx.strokeStyle = hexToRgba(tileColor, 0.5 * scanPulse);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);

          // Small resource type sprite
          drawSprite(TILE_ICONS[tile], x + TILE_SIZE / 2, y + TILE_SIZE / 2, 20, 0.7 * scanPulse);
        }

      // Scanner radius ring around player
      const playerScreenX = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX;
      const playerScreenY = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      ctx.save();
      ctx.strokeStyle = `rgba(0,255,200,${0.15 * scanPulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      const scanRingRange = 3 + (G.toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      ctx.arc(playerScreenX, playerScreenY, (scanRingRange + 0.5) * TILE_SIZE, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  NS.gadgetArt = { drawSurfaceGadgets, drawKeyHints, drawSurfaceHUD, scannerRange, drawRelocationCoreMarker,
    drawUndergroundGadgets };
})();
