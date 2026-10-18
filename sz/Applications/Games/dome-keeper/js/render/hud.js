;(function() {
  'use strict';

  // The quick upgrade panel and the HUD.
  // Owns: NS.hud
  // Reads: constants, util, dom, sprites, textLayout, panels, hudFading, upgradeData, upgrades, gameState,
  //   persistence, cinematicArt, chestArt, upgradeTree, gadgetArt, craftDialog
  // Reads state of: gameState, persistence, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, VIEW_SURFACE, STATE_READY, STATE_GADGET_SELECT, STATE_PLAYING,
    STATE_PAUSED, STATE_GAME_OVER, STATE_CONFIRM, STATE_CRAFT, STATE_MINIGAME, TILE_VALUES, TILE_LABELS } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { uiFont, fitText, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawChip, drawButton, drawHeadline, drawScrim } = NS.panels;
  const { beginHudPanel, endHudPanel } = NS.hudFading;
  const { UPGRADE_TREE, TREE_BRANCH_ORDER, TREE_BRANCH_LABELS, TREE_BRANCH_COLORS } = NS.upgradeData;
  const { getTreeNodeLevel, isTreeNodeMaxed, arePrereqsMet, canAffordTreeNode } = NS.upgrades;
  const { quickPanelFlash, PRIMARY_GADGETS } = NS.gameState;
  const { getTitleButtons } = NS.persistence;
  const { drawRelocateConfirm } = NS.cinematicArt;
  const { drawMinigame } = NS.chestArt;
  const { getTreeNodeInfo, treeNodeState, drawCostRow, toRoman, tryPurchaseTreeNode, openUpgradeDialog } = NS.upgradeTree;
  const { drawKeyHints } = NS.gadgetArt;
  const { drawCraftDialog } = NS.craftDialog;

  /* ======================================================================
     DRAWING -- UPGRADE PANEL
     ====================================================================== */

  /* -- Quick upgrade panel: the next node of every tree branch -- */
  const QUICK_PANEL_X = CANVAS_W - 340, QUICK_PANEL_Y = 146, QUICK_PANEL_W = 320;
  const QUICK_HEADER_H = 44, QUICK_ROW_H = 58, QUICK_ROW_GAP = 6;
  let resourceWeights = null;

  // Rarer resources weigh more when ranking which node comes next
  function resourceWeight(key) {
    if (!resourceWeights) {
      resourceWeights = {};
      for (const t in TILE_LABELS)
        resourceWeights[TILE_LABELS[t]] = TILE_VALUES[t] || 10;
    }
    return resourceWeights[key] || 10;
  }

  function currentNodeCost(node) {
    return node.costs[Math.min(getTreeNodeLevel(node.id), node.costs.length - 1)];
  }

  // Per unfinished branch: the cheapest node that can be bought now,
  // otherwise the unlocked node that is closest to affordable
  function getQuickPicks() {
    const picks = [];
    for (const branch of TREE_BRANCH_ORDER) {
      let best = null, bestScore = Infinity, buyable = 0, owned = 0, total = 0;
      for (const n of UPGRADE_TREE) {
        if (n.branch !== branch) continue;
        ++total;
        if (isTreeNodeMaxed(n.id)) {
          ++owned;
          continue;
        }
        if (!arePrereqsMet(n)) continue;
        const cost = currentNodeCost(n);
        const afford = canAffordTreeNode(n);
        if (afford) ++buyable;
        let price = 0, missing = 0;
        for (const k in cost) {
          const w = resourceWeight(k);
          price += cost[k] * w;
          missing += Math.max(0, cost[k] - (G.resources[k] || 0)) * w;
        }
        const score = afford ? price : 1e7 + missing * 10 + price;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      // a finished branch leaves the panel; the rows below move up
      if (owned < total)
        picks.push({ branch, node: best, buyable, owned, total });
    }
    return picks;
  }

  function getQuickPanelLayout() {
    const x = QUICK_PANEL_X, w = QUICK_PANEL_W;
    let y = QUICK_PANEL_Y + QUICK_HEADER_H + 8;
    const rows = getQuickPicks().map(p => {
      const r = Object.assign({ x: x + 10, y, w: w - 20, h: QUICK_ROW_H }, p);
      y += QUICK_ROW_H + QUICK_ROW_GAP;
      return r;
    });
    const button = { x: x + 10, y: y + 2, w: w - 20, h: 36 };
    return { x, y: QUICK_PANEL_Y, w, h: button.y + button.h + 10 - QUICK_PANEL_Y, rows, button };
  }

  function hitQuickPanel(mx, my) {
    if (G.currentView !== VIEW_SURFACE || G.state !== STATE_PLAYING) return null;
    const L = getQuickPanelLayout();
    if (mx < L.x || mx > L.x + L.w || my < L.y || my > L.y + L.h) return null;
    for (const r of L.rows)
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h)
        return { kind: 'row', row: r };
    const b = L.button;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
      return { kind: 'tree' };
    return { kind: 'panel' };
  }

  // A row buys its node when affordable; otherwise it opens the tree on that node
  function activateQuickRow(r) {
    if (!r.node) {
      openUpgradeDialog(null, r.branch);
      return;
    }
    if (treeNodeState(r.node) === 'ready') {
      const before = getTreeNodeLevel(r.node.id);
      tryPurchaseTreeNode(r.node);
      if (getTreeNodeLevel(r.node.id) > before)
        quickPanelFlash[r.branch] = performance.now();
    } else
      openUpgradeDialog(r.node.id);
  }

  // Background and border of an upgrade card, shared by the tree and the quick panel
  function drawNodeFrame(x, y, w, h, color, st, highlight) {
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned')
      ctx.fillStyle = hexToRgba(color, 0.26);
    else if (st === 'ready')
      ctx.fillStyle = highlight ? hexToRgba(color, 0.3) : hexToRgba(color, 0.16);
    else if (st === 'poor')
      ctx.fillStyle = highlight ? 'rgba(54,48,38,0.95)' : 'rgba(40,36,30,0.95)';
    else
      ctx.fillStyle = 'rgba(16,18,26,0.95)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = st === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.restore();
    roundRectPath(x, y, w, h, 12);
    if (st === 'owned') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
    } else if (st === 'ready') {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + Math.sin(G.animTime * 4) * 4;
    } else if (st === 'poor') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,182,72,0.65)';
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(120,130,160,0.3)';
      ctx.setLineDash([6, 5]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  function drawQuickRow(r, hover) {
    const color = TREE_BRANCH_COLORS[r.branch];
    const node = r.node;
    const complete = !node && r.owned >= r.total;
    const st = node ? treeNodeState(node) : (complete ? 'owned' : 'locked');
    ctx.save();
    drawNodeFrame(r.x, r.y, r.w, r.h, color, st, hover);
    if (hover) {
      roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.stroke();
    }
    // Icon well
    const ix = r.x + 8, iy = r.y + (r.h - 42) / 2;
    roundRectPath(ix, iy, 42, 42, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(node ? node.icon : 'check', ix + 21, iy + 21, 30, st === 'locked' ? 0.5 : 1);

    const tx = r.x + 60, tw = r.w - 60 - 10;
    // Branch name and progress (top right)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tagW = fitText(TREE_BRANCH_LABELS[r.branch], r.x + r.w - 10, r.y + 15, 78, 11, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 9 });
    ctx.textAlign = 'left';
    if (node) {
      const info = getTreeNodeInfo(node);
      const title = info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : '') + (node.maxLevel > 1 ? ' ' + (getTreeNodeLevel(node.id) + 1) : '');
      fitText(title, tx, r.y + 16, tw - tagW - 8, 16, { weight: 'bold', color: st === 'locked' ? '#7a8298' : UI.text, minPx: 11 });
      let extraW = 0;
      if (r.buyable > 1) {
        ctx.font = uiFont(12, 'bold');
        extraW = drawChip('+' + (r.buyable - 1), r.x + r.w - 8, r.y + r.h - 28, 20, { align: 'right', px: 12, bg: hexToRgba(color, 0.2), border: hexToRgba(color, 0.6), color: '#fff' }) + 6;
      }
      drawCostRow(currentNodeCost(node), tx, r.y + r.h - 18, tw - extraW, 14);
    } else {
      fitText(complete ? 'Branch complete' : 'Nothing unlocked yet', tx, r.y + 16, tw - tagW - 8, 16, { weight: 'bold', color: complete ? UI.good : UI.textMute });
      fitText(`${r.owned} / ${r.total} upgrades`, tx, r.y + r.h - 18, tw, 14, { color: UI.textDim });
    }
    // Purchase flash
    const flash = quickPanelFlash[r.branch];
    if (flash !== undefined) {
      const t = (performance.now() - flash) / 600;
      if (t >= 1)
        delete quickPanelFlash[r.branch];
      else {
        roundRectPath(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
        roundRectPath(r.x - t * 10, r.y - t * 10, r.w + t * 20, r.h + t * 20, 12 + t * 6);
        ctx.lineWidth = 3 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawUpgradePanel() {
    const L = getQuickPanelLayout();
    beginHudPanel('quick', L.x, L.y, L.w, L.h);
    let owned = 0;
    for (const r of L.rows)
      owned += r.owned;
    drawPanel(L.x, L.y, L.w, L.h, { title: 'Next upgrades', titleRight: `${owned} / ${UPGRADE_TREE.length}`, titleRightColor: UI.gold, headerH: QUICK_HEADER_H });
    const hover = G.quickPanelHover;
    for (const r of L.rows)
      drawQuickRow(r, !!(hover && hover.kind === 'row' && hover.row.branch === r.branch));

    // Button that opens the full tree
    const b = L.button;
    const hb = !!(hover && hover.kind === 'tree');
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, 9);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, hb ? 'rgba(255,215,90,0.32)' : 'rgba(255,215,90,0.16)');
    g.addColorStop(1, hb ? 'rgba(160,110,20,0.32)' : 'rgba(120,80,10,0.18)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hb ? 2 : 1;
    ctx.strokeStyle = hb ? UI.gold : 'rgba(255,215,90,0.5)';
    ctx.stroke();
    const kw = drawChip('U', b.x + b.w - 8, b.y + 7, 22, { align: 'right', px: 13, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.25)', color: UI.text });
    drawSprite('gear', b.x + 22, b.y + b.h / 2, 22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Open upgrade tree', b.x + 40, b.y + b.h / 2 + 1, b.w - 40 - kw - 16, 17, { weight: 'bold', color: UI.gold });
    ctx.restore();
    endHudPanel();
  }


  /* ======================================================================
     DRAWING -- HUD
     ====================================================================== */

  function drawHUD() {
    const pulse = Math.sin(G.animTime * 3) * 0.5 + 0.5;
    const hoverIn = (b) => G.mouseAimX >= b.x && G.mouseAimX <= b.x + b.w && G.mouseAimY >= b.y && G.mouseAimY <= b.y + b.h;

    if (G.state === STATE_READY) {
      drawScrim(0.5);
      drawPanel(CANVAS_W / 2 - 380, 190, 760, 600, { accent: UI.accent, radius: 16 });
      drawHeadline('DOME KEEPER', CANVAS_W / 2, 290, 680, 88, '#7cc8ff', '#2a7ae0');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Defend your dome. Mine resources. Upgrade.', CANVAS_W / 2, 370, 660, 26, { color: UI.textDim });
      const best = G.highScores[0];
      if (best)
        fitText(`Best run: ${best.score} points  ·  wave ${best.waves}  ·  ${best.sites || 1} site${(best.sites || 1) > 1 ? 's' : ''}`, CANVAS_W / 2, 420, 660, 18, { color: UI.gold });
      ctx.fillStyle = 'rgba(120,180,255,0.25)';
      ctx.fillRect(CANVAS_W / 2 - 220, 450, 440, 1);

      if (G.saveAvailable) {
        for (const b of getTitleButtons())
          drawButton(b, b.id === 'continue', hoverIn(b));
        drawKeyHints([{ key: 'Enter', label: 'Continue' }, { key: 'F2', label: 'New game' }, { key: 'H', label: 'How to play' }], CANVAS_W / 2, 700, 640);
      } else {
        const b = getTitleButtons()[0];
        ctx.save();
        ctx.globalAlpha = 0.75 + pulse * 0.25;
        drawButton({ x: b.x, y: b.y, w: b.w, h: b.h, label: 'Start' }, true, hoverIn(b));
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText('Click anywhere or press F2 to start', CANVAS_W / 2, 620, 600, 20, { color: UI.textDim });
        drawKeyHints([{ key: 'F2', label: 'Start' }, { key: 'H', label: 'How to play' }], CANVAS_W / 2, 700, 640);
      }
      if (G.saveNotice)
        drawTextBlock(G.saveNotice, CANVAS_W / 2 - 340, 730, 680, 48, 18, { align: 'center', color: UI.warn });
    }

    if (G.state === STATE_GADGET_SELECT) {
      drawScrim(0.72);
      drawHeadline('Choose Your Gadget', CANVAS_W / 2, 200, 1000, 56, '#ffe080', '#e0a020');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Your dome keeps this ability for the whole run', CANVAS_W / 2, 262, 900, 22, { color: UI.textDim });

      const cardW = 280;
      const cardH = 320;
      const gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const g = PRIMARY_GADGETS[i];
        const cx = startX + i * (cardW + gap);
        const isHover = G.gadgetSelectHover === i;
        const lift = isHover ? -6 : 0;

        drawPanel(cx, cardY + lift, cardW, cardH, {
          accent: isHover ? UI.gold : '#6a8ac8', glow: isHover, radius: 14,
          top: isHover ? 'rgba(40,56,92,0.96)' : UI.panelTop
        });

        // Icon well
        const wx = cx + cardW / 2, wy = cardY + lift + 82;
        ctx.save();
        const wg = ctx.createRadialGradient(wx, wy - 10, 4, wx, wy, 58);
        wg.addColorStop(0, isHover ? 'rgba(255,220,120,0.35)' : 'rgba(120,170,255,0.22)');
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(wx, wy, 58, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
        drawSprite(g.icon, wx, wy, 76);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(g.name, cx + cardW / 2, cardY + lift + 160, cardW - 30, 24, { weight: 'bold', color: isHover ? UI.gold : UI.text });
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx + 30, cardY + lift + 184, cardW - 60, 1);
        drawTextBlock(g.desc.join(' '), cx + 20, cardY + lift + 196, cardW - 40, 84, 18, { align: 'center', valign: 'middle', color: UI.textDim });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(isHover ? 'Click to select' : 'Gadget ' + (i + 1), cx + cardW / 2, cardY + lift + cardH - 24, cardW - 40, 17, { weight: 'bold', color: isHover ? UI.gold : UI.textMute });
      }
    }

    if (G.state === STATE_CONFIRM)
      drawRelocateConfirm();

    if (G.state === STATE_CRAFT)
      drawCraftDialog();

    if (G.state === STATE_MINIGAME)
      drawMinigame();

    if (G.state === STATE_PAUSED) {
      drawScrim(0.45);
      const pw = 520, ph = 250, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
      drawPanel(px, py, pw, ph, { accent: UI.gold, radius: 16 });
      drawHeadline('PAUSED', CANVAS_W / 2, py + 78, pw - 60, 64, '#ffe070', '#e0a010');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Your run is saved', CANVAS_W / 2, py + 140, pw - 60, 20, { color: UI.textDim });
      drawKeyHints([{ key: 'Esc', label: 'Resume' }, { key: 'H', label: 'Help' }, { key: 'F2', label: 'New game' }], CANVAS_W / 2, py + 200, pw - 60);
    }

    if (G.state === STATE_GAME_OVER) {
      drawScrim(0.6);
      ctx.fillStyle = 'rgba(120,0,0,0.12)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const pw = 640, ph = 460, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2;
      drawPanel(px, py, pw, ph, { accent: '#ff5050', radius: 16 });
      drawHeadline('DOME DESTROYED', CANVAS_W / 2, py + 78, pw - 60, 60, '#ff7a6a', '#c01818');

      const best = G.highScores[0];
      const stats = [
        ['Nights survived', String(Math.max(0, G.waveNumber - 1))],
        ['Sites visited', String(G.site.index + 1)],
        ['Score', String(G.score)],
        ['Best score', best ? String(best.score) : String(G.score)]
      ];
      for (let i = 0; i < stats.length; ++i) {
        const ry = py + 146 + i * 46;
        roundRectPath(px + 60, ry, pw - 120, 38, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        fitText(stats[i][0], px + 80, ry + 20, 260, 20, { color: UI.textDim });
        ctx.textAlign = 'right';
        fitText(stats[i][1], px + pw - 80, ry + 20, 220, 24, { weight: 'bold', color: i === 1 ? UI.gold : UI.text });
      }
      if (best && G.score > 0 && best.score === G.score && best.waves === G.waveNumber)
        drawChip('New high score!', CANVAS_W / 2 - 90, py + 344, 30, { px: 17, maxW: 180, bg: 'rgba(255,215,90,0.18)', border: UI.gold, color: UI.gold });

      ctx.save();
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Click or press F2 to play again', CANVAS_W / 2, py + ph - 40, pw - 60, 22, { weight: 'bold', color: UI.text });
      ctx.restore();
    }
  }

  NS.hud = { hitQuickPanel, activateQuickRow, drawNodeFrame, drawUpgradePanel, drawHUD };
})();
