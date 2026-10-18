;(function() {
  'use strict';

  // Tooltips for tiles, enemies and upgrade nodes, and the status bar.
  // Owns: NS.tooltip
  // Reads: constants, dom, sprites, textLayout, panels, rules, upgradeData, upgrades, gameState, time,
  //   waves, chests, upgradeTree, mineHud
  // Reads state of: gameState, time, relocation

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, STATE_PLAYING, STATE_UPGRADE_DIALOG, TILE_EMPTY, TILE_DIRT,
    TILE_GADGET, TILE_CORE, TILE_CHEST, TILE_VALUES, TILE_LABELS, TILE_ICONS } = NS.constants;
  const { ctx, statusView, statusWave, statusDome, statusResources } = NS.dom;
  const { SPRITES, measureIconText, fillIconText } = NS.sprites;
  const { uiFont, wrapText } = NS.textLayout;
  const { UI, drawPanel } = NS.panels;
  const { TILE_DISPLAY_NAMES, DEPTH_TIERS, getDepthTier, getDepthMineMultiplier, getDepthValueMultiplier } = NS.rules;
  const { UPGRADE_EFFECT_DESC, getMiningDifficultyLabel } = NS.upgradeData;
  const { getTreeNodeLevel, TREE_NODE_BY_ID, prereqId, isPrereqMet, prereqLabel, arePrereqsMet,
    canAffordTreeNode } = NS.upgrades;
  const { tooltip, TOOLTIP_DELAY } = NS.gameState;
  const { isNight, secondsToNight } = NS.time;
  const { ELITE_AURAS, enemyType } = NS.waves;
  const { MINIGAME_NAMES, chestAt, chestDifficulty } = NS.chests;
  const { getTreeNodeInfo, levelEffectText, toRoman } = NS.upgradeTree;
  const { RESOURCE_HUD_ENTRIES } = NS.mineHud;

  /* ======================================================================
     TOOLTIP SYSTEM
     ====================================================================== */

  function updateTooltipHover(dt) {
    if (!tooltip.visible && tooltip.lines.length > 0) {
      tooltip.delayTimer += dt;
      if (tooltip.delayTimer >= TOOLTIP_DELAY)
        tooltip.visible = true;
    }
  }

  function clearTooltip() {
    tooltip.enemy = null;
    tooltip.lines = [];
    tooltip.visible = false;
    tooltip.delayTimer = 0;
    tooltip.anchor = null;
    tooltip.lastHoverKey = '';
  }

  function setTooltip(x, y, lines, hoverKey, anchor) {
    tooltip.enemy = null;
    if (hoverKey !== tooltip.lastHoverKey) {
      tooltip.delayTimer = 0;
      tooltip.visible = false;
      tooltip.lastHoverKey = hoverKey;
    }
    tooltip.lines = lines;
    tooltip.x = x;
    tooltip.y = y;
    tooltip.anchor = anchor || null;
  }

  function drawTooltip() {
    if (!tooltip.visible || tooltip.lines.length === 0) return;
    if (G.state !== STATE_PLAYING && G.state !== STATE_UPGRADE_DIALOG) return;
    if (tooltip.enemy) {
      if (!G.enemies.includes(tooltip.enemy) || tooltip.enemy.hidden || G.currentView !== VIEW_SURFACE) {
        clearTooltip();
        return;
      }
      tooltip.lines = buildEnemyTooltip(tooltip.enemy);
    }

    const padding = 14;
    const maxTextW = 440;
    let fontSize = 18;
    let rows, boxW, boxH;
    // Lay out (wrapping long lines); shrink if the box would not fit the screen
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < tooltip.lines.length; ++i) {
        const line = tooltip.lines[i];
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 8 });
          continue;
        }
        ctx.font = uiFont(i === 0 ? fontSize + 2 : fontSize, i === 0 ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: i === 0 ? 'title' : 'text', text: w, h: (i === 0 ? fontSize + 2 : fontSize) * 1.4, src: line });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + padding * 2;
      boxH = padding * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= CANVAS_H - 16 || fontSize <= 12)
        break;
      --fontSize;
    }
    boxW = Math.max(boxW, 160);

    // Place next to the anchor (keyboard focus) or the cursor, always inside the canvas
    let bx, by;
    const a = tooltip.anchor;
    if (a) {
      bx = a.x + a.w + 12;
      if (bx + boxW > CANVAS_W - 8) bx = a.x - boxW - 12;
      by = a.y;
    } else {
      bx = tooltip.x + 24;
      by = tooltip.y + 24;
      if (bx + boxW > CANVAS_W - 8) bx = tooltip.x - boxW - 12;
      if (by + boxH > CANVAS_H - 8) by = tooltip.y - boxH - 12;
    }
    bx = Math.max(8, Math.min(CANVAS_W - 8 - boxW, bx));
    by = Math.max(8, Math.min(CANVAS_H - 8 - boxH, by));

    ctx.save();
    drawPanel(bx, by, boxW, boxH, { accent: UI.gold, radius: 10, shadow: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + padding;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(11, fontSize - 5), 'bold');
        ctx.fillStyle = UI.textMute;
        ctx.fillText(r.text, bx + padding, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx + padding + tw + 8, cy, boxW - padding * 2 - tw - 8, 1);
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = UI.text;
        if (!title) {
          if (r.src.startsWith('✔')) color = UI.good;
          else if (r.src.startsWith('✘')) color = UI.bad;
          else if (r.src.startsWith('⚠')) color = UI.warn;
          else color = '#c4cde0';
        } else
          color = '#ffffff';
        ctx.fillStyle = color;
        fillIconText(r.text, bx + padding, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  // Build tooltip content for an underground tile
  function buildTileTooltip(col, row) {
    const tile = G.undergroundGrid[row][col];
    if (tile === TILE_EMPTY) return null;

    const lines = [];
    const displayName = TILE_DISPLAY_NAMES[tile] || 'Unknown';
    const depthTier = DEPTH_TIERS[getDepthTier(row)];
    const depthMult = getDepthMineMultiplier(row);

    const chest = tile === TILE_CHEST ? chestAt(row, col) : null;
    if (chest && chest.revealed) {
      lines.push('[[chest]] Secret Chest');
      lines.push(`Dig into it to open its ${MINIGAME_NAMES[chest.kind].toLowerCase()} lock`);
      lines.push('Difficulty: ' + ['Easy', 'Fair', 'Tricky', 'Hard', 'Fiendish'][Math.min(4, Math.round(chestDifficulty(chest) * 4))]);
      if (chest.cooldown > 0)
        lines.push(`\u26A0 Jammed for ${Math.ceil(chest.cooldown)} s`);
      return lines;
    }
    if (tile === TILE_CORE && G.relocationCore.revealed) {
      lines.push('[[core]] Relocation Core');
      lines.push('Mine it to unlock relocating the dome');
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else if (tile === TILE_DIRT || tile === TILE_CORE || tile === TILE_CHEST) {
      lines.push(depthTier.name);
      lines.push('Depth tier: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else if (tile === TILE_GADGET) {
      lines.push('Gadget Chamber');
      const chamber = G.gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === row && ch.c + dc === col) return true;
        return false;
      });
      if (chamber && chamber.revealed)
        lines.push('Mine to discover a gadget');
      else
        lines.push('Hidden - mine nearby to reveal');
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else {
      const icon = TILE_ICONS[tile] || '';
      lines.push((icon ? '[[' + icon + ']] ' : '') + displayName);
      if (TILE_VALUES[tile])
        lines.push('Value: ' + Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(row)) + ' ' + TILE_LABELS[tile]);
      lines.push('Depth: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    }

    // Partial mining status
    if (G.tileHP[row] && G.tileMaxHP[row] && G.tileMaxHP[row][col] > 0) {
      const hpRatio = G.tileHP[row][col] / G.tileMaxHP[row][col];
      if (hpRatio < 0.99) {
        const pct = Math.round(hpRatio * 100);
        lines.push('Remaining: ' + pct + '%');
      }
    }

    return lines;
  }

  // Build tooltip content for an enemy
  function buildEnemyTooltip(e) {
    const T = enemyType(e);
    const lines = [(e.elite ? 'Elite ' : '') + (e.enraged ? 'Enraged ' : '') + T.name, T.desc];
    if (e.elite)
      lines.push(`\u26A0 ${ELITE_AURAS[e.elite].name}: ${ELITE_AURAS[e.elite].desc}`);
    else if (e.aura)
      lines.push(`\u26A0 Strengthened by a ${ELITE_AURAS[e.aura].name.toLowerCase()}`);
    if (e.spit !== undefined)
      lines.push('\u26A0 Spits acid on its way in');
    lines.push('HP: ' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxHP));
    if (e.shield > 0)
      lines.push('Shield: ' + Math.ceil(e.shield) + ' / ' + Math.ceil(e.maxShield));
    else if (e.maxShield > 0)
      lines.push('\u2718 Shield broken');
    if (e.armor > 0)
      lines.push('\u26A0 Armor: blocks ' + e.armor + ' damage per hit');
    lines.push('Damage: ' + e.damage + ' per hit');
    if (e.stunTimer > 0)
      lines.push('\u26A0 Stunned: ' + e.stunTimer.toFixed(1) + 's');
    return lines;
  }

  // Build tooltip content for an upgrade tree node (quick: shown on the quick panel)
  function buildUpgradeNodeTooltip(node, quick) {
    const lines = [];
    const lvl = getTreeNodeLevel(node.id);
    const maxed = lvl >= node.maxLevel;

    const info = getTreeNodeInfo(node);
    lines.push('[[' + node.icon + ']] ' + info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : ''));

    // Effect description
    const effectDesc = UPGRADE_EFFECT_DESC[node.upgradeKey];
    if (effectDesc)
      lines.push(effectDesc);

    // Type
    lines.push('Type: ' + (node.type === 'gadget' ? 'Gadget (unlock)' : 'Stat upgrade'));

    // Level
    if (info.chain.length > 1)
      lines.push('Tier ' + (info.index + 1) + ' of ' + info.chain.length);
    if (node.maxLevel > 1) {
      lines.push('Level ' + lvl + ' of ' + node.maxLevel);
      const now = levelEffectText(node, lvl);
      if (now)
        lines.push(maxed ? now : now + ' \u2192 ' + levelEffectText(node, lvl + 1).replace(/^\D+/, ''));
    }
    if (maxed)
      lines.push(node.maxLevel > 1 ? '\u2714 Maxed' : '\u2714 Purchased');

    // Cost
    if (!maxed) {
      const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
      const COST_NAMES = {
        iron: 'Iron', water: 'Water', cobalt: 'Cobalt', copper: 'Copper',
        tin: 'Tin', coal: 'Coal', lead: 'Lead', silver: 'Silver',
        gold: 'Gold', quartz: 'Quartz', redstone: 'Redstone',
        emerald: 'Emerald', diamond: 'Diamond', ruby: 'Ruby',
        titanium: 'Titanium', sapphire: 'Sapphire', uranium: 'Uranium',
        amethyst: 'Amethyst', opal: 'Fire Opal', voidstone: 'Voidstone'
      };
      let costParts = [];
      for (const key in cost)
        if ((cost[key] || 0) > 0) {
          const have = G.resources[key] || 0;
          const need = cost[key];
          const mark = have >= need ? '\u2714' : '\u2718';
          const ico = SPRITES[key] ? '[[' + key + ']] ' : '';
          costParts.push(mark + ' ' + ico + (COST_NAMES[key] || key) + ': ' + have + '/' + need);
        }
      if (costParts.length > 0) {
        lines.push('--- Cost ---');
        for (const cp of costParts)
          lines.push(cp);
      }
    }

    // Prerequisites
    if (node.prereqs.length > 0) {
      const unmet = [];
      for (const pid of node.prereqs)
        if (!isPrereqMet(pid) && TREE_NODE_BY_ID[prereqId(pid)])
          unmet.push('\u2718 ' + prereqLabel(pid));
      if (unmet.length > 0) {
        lines.push('--- Prerequisites ---');
        for (const u of unmet)
          lines.push(u);
      }
    }

    if (!maxed && arePrereqsMet(node)) {
      if (canAffordTreeNode(node))
        lines.push(quick ? '\u2714 Click to buy' : '\u2714 Click or press Enter to buy');
      else
        lines.push(quick ? '\u26A0 Not enough resources - click to see it in the tree' : '\u26A0 Not enough resources');
    }

    return lines;
  }

  /* ======================================================================
     STATUS BAR
     ====================================================================== */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${G.currentView}`;
    if (statusWave) statusWave.textContent = isNight() ? `Night ${G.world.day}: ${G.enemies.length} monsters` : `Day ${G.world.day}: night in ${Math.ceil(secondsToNight())}s`;
    if (statusDome) statusDome.textContent = `Dome: ${Math.ceil(G.domeHP)}/${G.maxDomeHP}`;
    if (statusResources) {
      let resParts = [];
      for (const entry of RESOURCE_HUD_ENTRIES)
        if (G.resources[entry.key] > 0)
          resParts.push(`${entry.label}:${G.resources[entry.key]}`);
      statusResources.textContent = resParts.join(' ') || 'Fe:0 H2O:0 Co:0';
    }
  }

  NS.tooltip = { updateTooltipHover, clearTooltip, setTooltip, drawTooltip, buildTileTooltip,
    buildEnemyTooltip, buildUpgradeNodeTooltip, updateStatusBar };
})();
