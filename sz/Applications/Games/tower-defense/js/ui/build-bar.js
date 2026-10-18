/* ui/build-bar.js -- the build bar with one card per tower family.
   Reads: constants, towerTypes, enemyTypes, env, pixelArt, text, widgets, effects, research, towerArt,
      abilityBar, inspector and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { WORLD_W, WORLD_H, BOT_H } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx, audio } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { uiFont, fitText } = NS.text;
  const { UI, roundRectPath, drawPanel, drawKeycap, addRegion, pressAmount, beginHudPanel, endHudPanel } = NS.widgets;
  const { floatingText } = NS.effects;
  const { BOSS_TOWER, towerUnlocked } = NS.research;
  const { drawTowerIcon } = NS.towerArt;
  const { abilityBarWidth, drawAbilityButtons } = NS.abilityBar;

  /* ══════════════════════════════════════════════════════════════════
     BUILD BAR -- one card per tower type
     ══════════════════════════════════════════════════════════════════ */

  function towerHotkey(i) {
    return i < 9 ? String(i + 1) : i === 9 ? '0' : i < 19 ? '⇧' + (i - 9) : '';
  }

  function buildBarRect() {
    return { x: 8, y: G.UH - BOT_H + 4, w: G.UW - 16, h: BOT_H - 10 };
  }

  function drawBuildBar() {
    const r = buildBarRect();
    beginHudPanel('build', r.x, r.y, r.w, r.h);
    drawPanel(r.x, r.y, r.w, r.h, { accent: UI.gold, radius: 10 });
    const n = TOWER_TYPES.length;
    const gap = n > 12 ? 3 : 5;
    const abW = abilityBarWidth();
    const innerX = r.x + 8, innerW = r.w - 16 - abW - 8;
    // Separator and ability buttons on the right
    ctx.fillStyle = 'rgba(255,215,90,0.25)';
    ctx.fillRect(r.x + r.w - abW - 10, r.y + 10, 1, r.h - 20);
    drawAbilityButtons(r.x + r.w - abW - 2, r.y + 7, r.h - 14);
    // One row of tall cards when there is room, otherwise two rows of wide ones
    const twoRows = (innerW - gap * (n - 1)) / n < 58;
    const perRow = twoRows ? Math.ceil(n / 2) : n;
    const cw = Math.min(92 * (twoRows ? 1.6 : 1), (innerW - gap * (perRow - 1)) / perRow);
    const ch = twoRows ? (r.h - 14 - gap) / 2 : r.h - 14;
    const total = perRow * cw + (perRow - 1) * gap;
    for (let i = 0; i < n; ++i) {
      const row = Math.floor(i / perRow), col = i % perRow;
      const cx = innerX + (innerW - total) / 2 + col * (cw + gap);
      const cy = r.y + 7 + row * (ch + gap);
      if (twoRows) drawBuildCardWide(i, cx, cy, cw, ch);
      else drawBuildCard(i, cx, cy, cw, ch);
    }
    endHudPanel();
  }

  // Compact card for narrow windows: icon on the left, name and cost on the right
  function drawBuildCardWide(i, x, y, w, h) {
    const def = TOWER_TYPES[i];
    const id = 'build' + i;
    const selected = G.selectedTowerType === i;
    const locked = !towerUnlocked(i);
    const afford = G.gold >= def.cost && !locked;
    const hover = G.hoverId === id;
    ctx.save();
    roundRectPath(x, y, w, h, 6);
    ctx.fillStyle = selected ? 'rgba(90,70,20,0.95)' : hover ? 'rgba(46,56,86,0.95)' : 'rgba(26,32,54,0.95)';
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? UI.gold : hover ? 'rgba(255,215,90,0.55)' : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    const is = h - 4;
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (locked ? 0.25 : afford ? 1 : 0.5);
    drawTowerIcon(i, 1, x + 2 + is / 2, y + h / 2, is);
    ctx.globalAlpha = pa;
    if (locked) drawIcon('lock', x + 2 + is / 2, y + h / 2, Math.min(16, is * 0.6));
    const tx = x + is + 5, tw = w - is - 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(def.name, tx, y + h * 0.32, tw, 11, { weight: 'bold', color: locked ? UI.textMute : afford ? UI.text : UI.textDim, minPx: 8 });
    if (locked)
      fitText(BOSS_TOWER[def.id] ? '[[skull]] Boss' : '[[flask]] Research', tx, y + h * 0.72, tw - 18, 10, { weight: 'bold', color: BOSS_TOWER[def.id] ? '#ff8a8a' : '#b89aff', minPx: 8 });
    else
      fitText(`[[coin]]${def.cost}`, tx, y + h * 0.72, tw - 18, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad, minPx: 8 });
    const hk = towerHotkey(i);
    if (hk) {
      ctx.font = uiFont(8, 'bold');
      drawKeycap(hk, x + w - 4 - Math.max(12, ctx.measureText(hk).width + 6), y + h - 15, 8);
    }
    ctx.restore();
    addRegion({
      id, x, y, w, h, anchorTip: true,
      onClick: () => selectBuildType(i),
      tip: () => lockedTip(i)
    });
  }

  function drawBuildCard(i, x, y, w, h) {
    const def = TOWER_TYPES[i];
    const id = 'build' + i;
    const selected = G.selectedTowerType === i;
    const locked = !towerUnlocked(i);
    const afford = G.gold >= def.cost && !locked;
    const hover = G.hoverId === id;
    const press = pressAmount(id);
    const lift = (selected ? 3 : hover ? 1.5 : 0) - press * 2;
    ctx.save();
    roundRectPath(x, y - lift, w, h, 7);
    const g = ctx.createLinearGradient(0, y - lift, 0, y - lift + h);
    g.addColorStop(0, selected ? 'rgba(90,70,20,0.95)' : hover ? 'rgba(46,56,86,0.95)' : 'rgba(30,38,62,0.95)');
    g.addColorStop(1, selected ? 'rgba(40,28,8,0.95)' : 'rgba(12,16,30,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? UI.gold : hover ? 'rgba(255,215,90,0.55)' : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    if (selected) {
      roundRectPath(x - 2, y - lift - 2, w + 4, h + 4, 9);
      ctx.strokeStyle = `rgba(255,215,90,${0.35 + 0.25 * Math.sin(G.animTime * 5)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Icon
    const iconSize = Math.min(w - 10, h - 30);
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (locked ? 0.25 : afford ? 1 : 0.5);
    drawTowerIcon(i, 1, x + w / 2, y - lift + 4 + iconSize / 2, iconSize);
    ctx.globalAlpha = pa;
    if (locked)
      drawIcon('lock', x + w / 2, y - lift + 4 + iconSize / 2, Math.min(22, iconSize * 0.6));
    // Name and cost
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(def.name, x + w / 2, y - lift + h - 21, w - 6, 11, { weight: 'bold', color: locked ? UI.textMute : afford ? UI.text : UI.textDim, minPx: 7 });
    if (locked)
      fitText(BOSS_TOWER[def.id] ? '[[skull]] Boss' : '[[flask]] Research', x + w / 2, y - lift + h - 8, w - 6, 10, { weight: 'bold', color: BOSS_TOWER[def.id] ? '#ff8a8a' : '#b89aff', minPx: 7 });
    else
      fitText(`[[coin]]${def.cost}`, x + w / 2, y - lift + h - 8, w - 6, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad, minPx: 7 });
    const hk = towerHotkey(i);
    if (hk)
      drawKeycap(hk, x + 3, y - lift + 3, 9);
    ctx.restore();
    addRegion({
      id, x, y: y - lift, w, h, anchorTip: true,
      onClick: () => selectBuildType(i),
      tip: () => lockedTip(i)
    });
  }

  function lockedTip(i) {
    if (towerUnlocked(i)) return NS.inspector.buildTooltip(i);
    const boss = BOSS_TOWER[TOWER_TYPES[i].id];
    return [TOWER_TYPES[i].name, TOWER_TYPES[i].desc, boss ? `✘ Locked: defeat the ${ENEMY_TYPES[boss].name} to win it.` : '✘ Locked: unlock it in Research (from the title screen or the campaign map).'];
  }

  function selectBuildType(i) {
    if (!towerUnlocked(i)) {
      audio.play('error');
      floatingText.add(WORLD_W / 2, WORLD_H - 30, BOSS_TOWER[TOWER_TYPES[i].id] ? `${TOWER_TYPES[i].name} is won by defeating the ${ENEMY_TYPES[BOSS_TOWER[TOWER_TYPES[i].id]].name}` : `${TOWER_TYPES[i].name} is locked: unlock it in Research`, { color: '#b89aff', font: 'bold 12px sans-serif', life: 1.8 });
      return;
    }
    if (G.selectedTowerType === i) {
      G.selectedTowerType = -1;
      audio.play('click', { pitch: 0.8 });
      return;
    }
    G.selectedTowerType = i;
    G.selectedTower = null;
    audio.play('click');
  }

  NS.buildBar = { drawBuildBar, selectBuildType };

})();
