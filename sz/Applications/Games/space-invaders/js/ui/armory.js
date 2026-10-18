/* Armory tech tree screen: branch tabs, card layout, connectors, buying by key or click.
   Owns the selected branch and card, the layout and the buy flash. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { TREE, TREE_BRANCHES, TREE_BRANCH_LIST, treeNodeById } = NS.data;
  const { playSfx } = NS.audio;
  const { treeLevel, nodeState, buyNode, countTreeMaxed } = NS.progress;
  const { ctx, fillVisible, ui } = NS.view;
  const { romanNumeral } = NS.widgets;
  const { setScreen, openHelp } = NS.screens;

  let treeBranch = 0;
  let treeSelected = null;
  let treeLayout = null;
  let treeBuyFlash = null;

  const TREE_CARD_W = 300;
  const TREE_CARD_H = 120;
  const TREE_COL_GAP = 90;
  const TREE_ROW_GAP = 26;

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
    const tabW = (1232 - (TREE_BRANCH_LIST.length - 1) * 8) / TREE_BRANCH_LIST.length;
    for (let i = 0; i < TREE_BRANCH_LIST.length; ++i) {
      const b = TREE_BRANCH_LIST[i];
      const nodes = TREE.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCH_LIST[treeBranch];
    const cols = [];
    for (const node of TREE) {
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
          state: nodeState(node),
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout) return null;
    return treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(c => c.node.branch === branchId) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Shared by tab clicks, Tab, 1-5 and arrow wrap: rebuild the layout for the
     new branch before selecting its first card */
  function switchBranch(index) {
    const n = TREE_BRANCH_LIST.length;
    treeBranch = ((index % n) + n) % n;
    treeLayout = buildTreeLayout();
    selectFirstInBranch();
    playSfx('click', { volume: 0.4 });
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout) treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      playSfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId) continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      switchBranch(treeBranch + (ci < 0 ? -1 : 1));
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    treeSelected = col[ri].node.id;
    playSfx('click', { volume: 0.4 });
  }

  function drawArmory() {
    const layout = buildTreeLayout();
    treeLayout = layout;

    if (!treeSelected || !layout.cards.some(c => c.node.id === treeSelected))
      selectFirstInBranch();

    if (G.mouseX >= 0) {
      for (const card of layout.cards) {
        if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    ctx.fillStyle = 'rgba(3,4,10,0.72)';
    fillVisible();

    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Armory', 130, 58, 220, 40, ui.UI.gold);
    ui.drawChip(G.save.credits + ' CR', 1236, 44, 30, { align: 'right', color: ui.UI.gold });
    ctx.textAlign = 'right';
    ui.fitText(countTreeMaxed() + ' / ' + TREE.length + ' upgrades complete', 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    for (const tab of layout.tabs) {
      const active = tab.index === treeBranch;
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
      ui.fitText(tab.branch.name + ' ' + tab.maxed + '/' + tab.total, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* connectors under the cards */
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

    for (const card of layout.cards) {
      if (card.node.id !== treeSelected) continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(G.gameTime * 0.004));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

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

    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText(node.costs[level] + ' CR', card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(treeNodeById(node.req[i][0]).name + ' ' + romanNumeral(node.req[i][1]));
      }
      ctx.textAlign = 'center';
      ui.fitText('Requires ' + missing.join(', '), card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (G.gameTime / 1000 - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Armory tech tree: branches, card selection and buying */
  function onArmoryKey(e) {
    e.preventDefault();
    if (e.code === 'Escape') {
      setScreen(G.prevScreen);
    } else if (e.code === 'Tab') {
      switchBranch(treeBranch + 1);
    } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
      const b = Number(e.code.slice(5)) - 1;
      if (b < TREE_BRANCH_LIST.length)
        switchBranch(b);
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      moveTreeSelection(-1, 0);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      moveTreeSelection(1, 0);
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      moveTreeSelection(0, -1);
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      moveTreeSelection(0, 1);
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      const node = treeNodeById(treeSelected);
      if (node && buyNode(node))
        treeBuyFlash = { id: node.id, at: G.gameTime / 1000 };
    } else if (e.code === 'KeyH') {
      openHelp();
    }
  }

  /* Armory clicks: a tab switches branch, a card buys its next level */
  function onArmoryPointer() {
    if (!treeLayout) treeLayout = buildTreeLayout();
    for (const tab of treeLayout.tabs) {
      if (G.mouseX >= tab.x && G.mouseX <= tab.x + tab.w && G.mouseY >= tab.y && G.mouseY <= tab.y + tab.h) {
        switchBranch(tab.index);
        return;
      }
    }
    for (const card of treeLayout.cards) {
      if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
        treeSelected = card.node.id;
        if (buyNode(card.node))
          treeBuyFlash = { id: card.node.id, at: G.gameTime / 1000 };
        return;
      }
    }
  }

  Object.assign(NS.armory, {
    drawArmory, onArmoryKey, onArmoryPointer
  });
})();
