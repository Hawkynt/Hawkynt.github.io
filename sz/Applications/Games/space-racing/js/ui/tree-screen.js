/*
 * Workshop tech-tree screen: branch tabs, card layout, keyboard selection and the
 * node cards. Owns G.treeLayout / G.treeSelected / G.treeBranch; buys via Progress.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TREE_CARD_H, TREE_CARD_W, TREE_COL_GAP, TREE_ROW_GAP } = NS.constants;
  const { TREE, CUPS } = NS.defs;
  const { romanNumeral } = NS.util;
  const { ctx, ui } = NS.runtime;
  const { treeLevel, treeNodeById, nodeState } = NS.progress;

  /* Column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (let i = 0; i < node.req.length; ++i) {
      const parent = treeNodeById(node.req[i][0]);
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  /* Tabs plus the card grid of the active branch, centered in the card area */
  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE.branches.length - 1) * 8) / TREE.branches.length;
    for (let i = 0; i < TREE.branches.length; ++i) {
      const b = TREE.branches[i];
      const nodes = TREE.nodes.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE.branches[G.treeBranch];
    const cols = [];
    for (const node of TREE.nodes) {
      if (node.branch !== branch.id) continue;
      const d = treeDepth(node);
      if (!cols[d]) cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c]) rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c]) continue;
      for (let r = 0; r < cols[c].length; ++r) {
        const node = cols[c][r];
        cards.push({
          node: node,
          col: c,
          row: r,
          x: startX + c * (TREE_CARD_W + TREE_COL_GAP),
          y: startY + r * (TREE_CARD_H + gap),
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          state: nodeState(node)
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!G.treeLayout) return null;
    return G.treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE.branches[G.treeBranch].id;
    const first = G.treeLayout ? G.treeLayout.cards.find(c => c.node.branch === branchId) : null;
    G.treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!G.treeLayout) G.treeLayout = buildTreeLayout();
    const branchId = TREE.branches[G.treeBranch].id;
    const cur = treeCardById(G.treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      SZ.GameAudio.play('click', { volume: 0.5 });
      return;
    }
    const cols = {};
    for (const card of G.treeLayout.cards) {
      if (card.node.branch !== branchId) continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      G.treeBranch = (G.treeBranch + (ci < 0 ? -1 : 1) + TREE.branches.length) % TREE.branches.length;
      G.treeLayout = buildTreeLayout();
      selectFirstInBranch();
      SZ.GameAudio.play('click', { volume: 0.5 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    G.treeSelected = col[ri].node.id;
    SZ.GameAudio.play('click', { volume: 0.5 });
  }

  function drawTreeScreen() {
    const layout = buildTreeLayout();
    G.treeLayout = layout;

    // keep a valid selection for the active branch
    if (!G.treeSelected || !layout.cards.some(c => c.node.id === G.treeSelected))
      selectFirstInBranch();

    // hover selects the card under the cursor
    if (G.mouseX >= 0) {
      for (const card of layout.cards) {
        if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
          G.treeSelected = card.node.id;
          break;
        }
      }
    }

    ctx.fillStyle = '#070a16';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (G.trackArt) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      G.trackArt.drawBackground(ctx, G.camX, G.camY, G.camZoom, G.globalTime, CANVAS_W, CANVAS_H);
      ctx.restore();
    }

    // header: title, credits, progress
    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Workshop', 130, 58, 220, 40, ui.UI.gold);
    ui.drawChip(`${G.save.credits} CR`, 1236, 44, 30, { align: 'right', color: '#ffd75a' });
    let complete = 0;
    for (const node of TREE.nodes)
      if (treeLevel(node.id) >= node.costs.length)
        ++complete;
    ctx.textAlign = 'right';
    ui.fitText(`${complete} / ${TREE.nodes.length} upgrades complete`, 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    // branch tabs
    for (const tab of layout.tabs) {
      const active = tab.index === G.treeBranch;
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = '#0d1020';
      ctx.fill();
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = ui.hexToRgba(tab.branch.color, active ? 0.55 : 0.25);
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = tab.branch.color;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(`${tab.branch.name} ${tab.maxed}/${tab.total}`, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // connectors under the cards
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.8) : '#3a4058';
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    for (const card of layout.cards)
      drawTreeNodeCard(card);

    // selection outline
    for (const card of layout.cards) {
      if (card.node.id !== G.treeSelected) continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 690, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE.branches.find(b => b.id === node.branch);
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    // buyable cards breathe with a pulsing outline
    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(G.globalTime * 4));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip(`${level ? romanNumeral(level) : '0'} / ${romanNumeral(max)}`, card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

    // level pips
    for (let l = 0; l < max; ++l) {
      const px = card.x + 16 + l * 20;
      const py = card.y + card.h - 18;
      ui.roundRectPath(px, py, 16, 8, 2);
      ctx.fillStyle = l < level ? branch.color : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (l >= level) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    }

    // cost or MAX, bottom right
    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText(`${node.costs[level]} CR`, card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    // locked cards say what is still missing
    if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(`${treeNodeById(node.req[i][0]).name} ${romanNumeral(node.req[i][1])}`);
      }
      if (node.trophy && !G.save.trophies[node.trophy]) {
        const cup = CUPS.find(c => c.id === node.trophy);
        missing.push(`${cup ? cup.name : node.trophy} trophy`);
      }
      ctx.textAlign = 'center';
      ui.fitText(`Requires ${missing.join(', ')}`, card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    // white flash over a just-bought card
    if (G.treeBuyFlash && G.treeBuyFlash.id === node.id) {
      const f = 1 - (G.globalTime - G.treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = `rgba(255,255,255,${(0.55 * f).toFixed(3)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  Object.assign(NS.module('treeScreen'), {
    buildTreeLayout, selectFirstInBranch, moveTreeSelection, drawTreeScreen
  });
})();
