/* Space Farming - the "Next upgrades" panel: best next node of every branch, one click to buy.
   Reads: G.UW, G.UH, G.credits, G.inventory, G.uiTime */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { CROPS, LIVESTOCK, ctx, drawSprite, fitText, UI, hexToRgba, roundRectPath, drawPanel, drawChip,
    addRegion, hoverAmount, drawButton, celebrate, TREE_BRANCH_ORDER, TREE_BRANCH_LABELS, TREE_BRANCH_SHORT,
    TREE_BRANCH_COLORS, TECH, techOwned, isNodeDone, arePrereqsMet, nodeCost, canPay, treeNodeState,
    nodeTitle, openTree, tryPurchaseTreeNode, drawCostRow, drawNodeFrame, buildTechTooltip, HUD_M,
    dockHeight, beginHudPanel, endHudPanel } = NS;

  /* ── "Next upgrades" quick panel: the best next node of every branch ── */

  let quickCollapsed = false;
  const quickFlash = {};

  function itemWeight(k) {
    if (k === 'cr') return 1;
    for (const c of CROPS)
      if (c.name === k) return c.sellPrice;
    for (const l of LIVESTOCK)
      if (l.produce === k) return l.produceValue;
    return 10;
  }

  function getQuickPicks() {
    const picks = [];
    for (const branch of TREE_BRANCH_ORDER) {
      let best = null, bestScore = Infinity, buyable = 0, owned = 0, total = 0;
      for (const n of TECH) {
        if (n.branch !== branch) continue;
        if (!n.repeat) ++total;
        if (isNodeDone(n)) {
          ++owned;
          continue;
        }
        if (!arePrereqsMet(n)) continue;
        const cost = nodeCost(n);
        const afford = canPay(cost);
        if (afford) ++buyable;
        let price = 0, missing = 0;
        for (const k in cost) {
          const w = itemWeight(k);
          price += (cost[k] || 0) * w;
          const have = k === 'cr' ? G.credits : (G.inventory[k] || 0);
          missing += Math.max(0, (cost[k] || 0) - have) * w;
        }
        // expanding the field shows up whenever it is affordable; otherwise real upgrades come first
        const score = (afford ? price : 1e7 + missing * 10 + price) + (n.repeat && !afford ? 5e6 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      picks.push({ branch, node: best, buyable, owned, total });
    }
    return picks;
  }

  function quickPanelLayout() {
    const w = 272, x = G.UW - w - HUD_M, y = HUD_M;
    const headerH = 36, rowH = 52, gap = 6;
    if (quickCollapsed)
      return { x, y, w, h: headerH + 4, rows: [], headerH };
    let ry = y + headerH + 8;
    // a short screen shows only the rows that fit above the dock (and below the panel on the left on narrow ones)
    const room = G.UH - dockHeight() - HUD_M - 8 - y;
    const fit = Math.max(0, Math.floor((room - headerH - 8 - 42 + gap) / (rowH + gap)));
    const rows = getQuickPicks().slice(0, fit).map(p => {
      const r = Object.assign({ x: x + 8, y: ry, w: w - 16, h: rowH }, p);
      ry += rowH + gap;
      return r;
    });
    const button = { x: x + 8, y: ry + 2, w: w - 16, h: 32 };
    return { x, y, w, h: button.y + button.h + 8 - y, rows, button, headerH };
  }

  function activateQuickRow(r) {
    if (!r.node) {
      openTree(null, r.branch);
      return;
    }
    if (treeNodeState(r.node) === 'ready') {
      if (tryPurchaseTreeNode(r.node)) {
        quickFlash[r.branch] = G.uiTime;
        celebrate(r.x + r.w / 2, r.y + r.h / 2, 18);
      }
    } else
      openTree(r.node.id);
  }

  function drawQuickPanel() {
    const Q = quickPanelLayout();
    beginHudPanel('quick', Q.x, Q.y, Q.w, Q.h);
    let owned = 0, total = 0, ready = 0;
    for (const n of TECH)
      if (!n.repeat) {
        ++total;
        if (techOwned(n.id)) ++owned;
        else if (treeNodeState(n) === 'ready') ++ready;
      }
    drawPanel(Q.x, Q.y, Q.w, Q.h, { title: 'Next upgrades', icon: 'techtree', titlePx: 14, headerH: Q.headerH, titleRight: `${owned} / ${total}  ${quickCollapsed ? '▾' : '▴'}`, titleRightColor: UI.gold, accent: UI.gold });
    addRegion({ id: 'quick-header', x: Q.x, y: Q.y, w: Q.w, h: Q.headerH, onClick: () => { quickCollapsed = !quickCollapsed; SZ.GameAudio.play('click'); }, tip: () => ['Next upgrades', 'The best next upgrade of every branch.', ready ? `✔ ${ready} upgrade${ready === 1 ? '' : 's'} affordable now` : 'Nothing affordable right now', 'Click the header to fold the panel.'] });
    if (quickCollapsed && ready)
      drawChip(String(ready), Q.x + Q.w - 8, Q.y - 6, 18, { align: 'right', px: 11, bg: UI.leaf, color: '#10141e' });
    for (const r of Q.rows)
      drawQuickRow(r);
    if (Q.button)
      drawButton({ id: 'quick-tree', x: Q.button.x, y: Q.button.y, w: Q.button.w, h: Q.button.h }, { label: 'Open tech tree', icon: 'techtree', key: 'U', color: UI.gold, primary: true, px: 13, onClick: () => openTree(), tip: () => ['[[techtree]] Tech tree', 'All upgrades of every branch.', 'Shortcut: U'] });
    endHudPanel();
  }

  function drawQuickRow(r) {
    const color = TREE_BRANCH_COLORS[r.branch];
    const n = r.node;
    const complete = !n && r.owned >= r.total;
    const st = n ? treeNodeState(n) : (complete ? 'owned' : 'locked');
    const id = 'quick-' + r.branch;
    const hv = hoverAmount(id);
    ctx.save();
    drawNodeFrame(r.x, r.y, r.w, r.h, color, st, hv > 0.5);
    if (hv > 0.05) {
      roundRectPath(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 13);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * hv})`;
      ctx.stroke();
    }
    const ix = r.x + 7, iy = r.y + (r.h - 38) / 2;
    roundRectPath(ix, iy, 38, 38, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(n ? n.icon : (complete ? 'check' : 'lock'), ix + 19, iy + 19, 28, st === 'locked' ? 0.5 : 1);
    const tx = r.x + 52, tw = r.w - 52 - 8;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tagW = fitText(TREE_BRANCH_SHORT[r.branch].toUpperCase(), r.x + r.w - 8, r.y + 13, 74, 10, { weight: 'bold', color: hexToRgba(color, 0.95), minPx: 7 });
    ctx.textAlign = 'left';
    if (n) {
      fitText(nodeTitle(n), tx, r.y + 15, tw - tagW - 8, 14, { weight: 'bold', color: st === 'locked' ? '#7a8298' : UI.text, minPx: 9 });
      let extraW = 0;
      if (r.buyable > 1)
        extraW = drawChip('+' + (r.buyable - 1), r.x + r.w - 6, r.y + r.h - 25, 18, { align: 'right', px: 11, bg: hexToRgba(color, 0.2), border: hexToRgba(color, 0.6), color: '#fff' }) + 6;
      drawCostRow(nodeCost(n), tx, r.y + r.h - 15, tw - extraW, 13);
    } else {
      fitText(complete ? 'Branch complete' : 'Nothing unlocked yet', tx, r.y + 15, tw - tagW - 8, 14, { weight: 'bold', color: complete ? UI.good : UI.textMute });
      fitText(`${r.owned} / ${r.total} upgrades`, tx, r.y + r.h - 15, tw, 12, { color: UI.textDim });
    }
    const flash = quickFlash[r.branch];
    if (flash !== undefined) {
      const t = (G.uiTime - flash) / 0.6;
      if (t >= 1) delete quickFlash[r.branch];
      else {
        roundRectPath(r.x, r.y, r.w, r.h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
    addRegion({ id, x: r.x, y: r.y, w: r.w, h: r.h, onClick: () => activateQuickRow(r), tip: () => {
      if (!n) return [TREE_BRANCH_LABELS[r.branch], complete ? '✔ Every upgrade of this branch is owned' : 'Unlock other branches first'];
      const lines = buildTechTooltip(n);
      lines.push(st === 'ready' ? '✔ Click to buy now' : 'Click to open it in the tree');
      return lines;
    } });
  }

  Object.assign(NS, { quickPanelLayout, drawQuickPanel });

})();
