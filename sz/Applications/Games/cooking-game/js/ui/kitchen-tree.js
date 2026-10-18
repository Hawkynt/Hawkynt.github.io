;(function() {
  'use strict';

  /* The Kitchen screen: tab and card layout of the upgrade tree, keyboard
     selection, buying celebrations and drawing tabs, pipes and cards.
     Owns G.treeBranch, G.treeSelected, G.treeLayout and G.treeBuyFlash. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { TREE, TREE_BRANCHES, TREE_INDEX, TREE_BRANCH_LIST } = NS.Tree;
  const { ctx, ui } = NS.view;
  const { fx, sfx } = NS.juice;
  const { treeLevel, nodeState, countTreeMaxed } = NS.persist;
  const { drawLock, cachedSprite } = NS.sprites;
  const { drawMenuBackdrop, drawCoinChip } = NS.menu;

  /* Card grid of the Kitchen screen */
  const TREE_CARD_W = 300, TREE_CARD_H = 110, TREE_COL_GAP = 48, TREE_ROW_GAP = 24;

  /* ── Kitchen screen layout: tabs plus the card grid of the active branch ── */

  /* Column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (let i = 0; i < node.req.length; ++i) {
      const parent = TREE_INDEX[node.req[i][0]];
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

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

    const branch = TREE_BRANCH_LIST[G.treeBranch];
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

  /* a bought upgrade bursts with coins, stars and confetti */
  function celebrateBuy(card) {
    const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
    fx.emit('coin', cx, cy, 10, { speed: 360, angle: -Math.PI / 2, spread: 2.4 });
    fx.emit('star', cx, cy, 14, { color: '#ffd23f', speed: 260 });
    fx.emit('confetti', cx, cy, 24, { speed: 420, angle: -Math.PI / 2, spread: 2.2 });
    fx.emit('glow', cx, cy, 1, { color: '#ffd890', size: 360 });
    fx.text(cx, card.y - 6, 'Installed!', { color: '#9af07a', size: 26 });
  }

  function treeCardById(id) {
    if (!G.treeLayout) return null;
    return G.treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[G.treeBranch].id;
    const first = G.treeLayout ? G.treeLayout.cards.find(c => c.node.branch === branchId) : null;
    G.treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!G.treeLayout) G.treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[G.treeBranch].id;
    const cur = treeCardById(G.treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
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
      G.treeBranch = (G.treeBranch + (ci < 0 ? -1 : 1) + TREE_BRANCH_LIST.length) % TREE_BRANCH_LIST.length;
      G.treeLayout = buildTreeLayout();
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    G.treeSelected = col[ri].node.id;
    sfx('click', { volume: 0.4 });
  }

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  /* a round medallion with a picture for each branch */
  function drawBranchIcon(branchId, cx, cy, size, color) {
    const r = size / 2;
    const img = cachedSprite('bicon|' + branchId + '|' + size + '|' + color, size + 4, size + 6, (c) => {
      c.fillStyle = 'rgba(20,8,0,0.45)';
      c.beginPath();
      c.arc(r + 2, r + 5, r, 0, Math.PI * 2);
      c.fill();
      const rim = c.createLinearGradient(0, 2, 0, size + 2);
      rim.addColorStop(0, '#fff0b0');
      rim.addColorStop(0.5, '#d8a03a');
      rim.addColorStop(1, '#7a4a10');
      c.fillStyle = rim;
      c.beginPath();
      c.arc(r + 2, r + 2, r, 0, Math.PI * 2);
      c.fill();
      const face = c.createRadialGradient(r - 2, r - 4, 2, r + 2, r + 2, r);
      face.addColorStop(0, ui.shade(color, 0.4));
      face.addColorStop(1, ui.shade(color, -0.45));
      c.fillStyle = face;
      c.beginPath();
      c.arc(r + 2, r + 2, r - 4, 0, Math.PI * 2);
      c.fill();
    });
    ctx.drawImage(img, cx - r - 2, cy - r - 2, size + 4, size + 6);
    const icon = { stations: 'stove', gear: 'grill', service: 'plate', charm: null, pantry: 'board' }[branchId];
    if (icon) SZ.FoodArt.drawStepIcon(ctx, icon, cx, cy, size * 0.62);
    else {
      ui.drawStar(cx, cy, size * 0.6, true);
    }
  }

  function drawUpgradesScreen() {
    drawMenuBackdrop('hotel', 0.6);
    const layout = buildTreeLayout();
    G.treeLayout = layout;

    if (!G.treeSelected || !layout.cards.some(c => c.node.id === G.treeSelected))
      selectFirstInBranch();

    if (G.mouseX >= 0) {
      for (const card of layout.cards) {
        if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
          G.treeSelected = card.node.id;
          break;
        }
      }
    }

    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Kitchen', 140, 58, 240, 48, ui.UI.gold, '#ff8a1a');
    ctx.textAlign = 'left';
    ui.fitText('Upgrade your kitchen with the coins you earn', 270, 60, 520, 15, { color: ui.UI.textDim, weight: 'bold' });
    drawCoinChip(1236, 30, G.save.coins);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ui.fitText(countTreeMaxed() + ' / ' + TREE.length + ' installed', 1236, 82, 320, 13, { color: ui.UI.textDim, weight: 'bold' });
    ctx.textAlign = 'left';

    for (const tab of layout.tabs) {
      const active = tab.index === G.treeBranch;
      const hot = G.mouseX >= tab.x && G.mouseX <= tab.x + tab.w && G.mouseY >= tab.y && G.mouseY <= tab.y + tab.h;
      ctx.save();
      if (!active) ctx.globalAlpha *= hot ? 0.95 : 0.8;
      ui.drawPanel(tab.x, tab.y - (active ? 4 : 0), tab.w, tab.h + (active ? 4 : 0), { radius: 9, noStuds: true, accent: tab.branch.color, glow: active, top: active ? ui.shade(tab.branch.color, -0.35) : undefined, bottom: active ? ui.shade(tab.branch.color, -0.7) : undefined });
      drawBranchIcon(tab.branch.id, tab.x + 26, tab.y + tab.h / 2 - (active ? 2 : 0), 30, tab.branch.color);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(tab.branch.name, tab.x + 48, tab.y + tab.h / 2 - (active ? 2 : 0), tab.w - 110, 16, { weight: 'bold', color: active ? '#ffffff' : ui.UI.textDim, outline: 'rgba(30,10,0,0.7)' });
      ctx.textAlign = 'right';
      ui.fitText(tab.maxed + '/' + tab.total, tab.x + tab.w - 14, tab.y + tab.h / 2 - (active ? 2 : 0), 60, 14, { weight: 'bold', color: tab.maxed === tab.total ? ui.UI.good : ui.UI.textDim });
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* brass pipes between cards; a met requirement glows in branch colour */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(midX, y1);
          ctx.lineTo(midX, y2);
          ctx.lineTo(x2, y2);
        };
        ctx.lineJoin = 'round';
        path();
        ctx.strokeStyle = '#2a1408';
        ctx.lineWidth = 10;
        ctx.stroke();
        path();
        ctx.strokeStyle = met ? '#e0b048' : '#6a5038';
        ctx.lineWidth = 6;
        ctx.stroke();
        path();
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.9) : 'rgba(255,230,190,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (met) {
          /* a bead of light running along the pipe */
          const len = Math.abs(midX - x1) + Math.abs(y2 - y1) + Math.abs(x2 - midX);
          let d = (G.animT * 120) % len;
          let px, py;
          if (d < midX - x1) { px = x1 + d; py = y1; }
          else if ((d -= midX - x1) < Math.abs(y2 - y1)) { px = midX; py = y1 + Math.sign(y2 - y1) * d; }
          else { d -= Math.abs(y2 - y1); px = midX + d; py = y2; }
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ui.drawGlow(px, py, 30, layout.branch.color);
          ctx.restore();
        }
      }
    }

    for (const card of layout.cards)
      drawTreeNodeCard(card);

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';
    const selected = node.id === G.treeSelected;

    ctx.save();
    if (selected) {
      const s = 1.03 + Math.sin(G.animT * 5) * 0.008;
      ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
      ctx.scale(s, s);
      ctx.translate(-(card.x + card.w / 2), -(card.y + card.h / 2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ui.drawGlow(card.x + card.w / 2, card.y + card.h / 2, card.w * 1.5, maxed ? '#6fe08a' : '#ffd23f');
      ctx.restore();
    }
    if (locked)
      ctx.globalAlpha *= 0.94;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color, glow: selected,
      top: locked ? '#3a3028' : undefined, bottom: locked ? '#1e1812' : undefined });

    drawBranchIcon(node.branch, card.x + 40, card.y + 44, 52, locked ? '#5a5048' : branch.color);
    if (locked) drawLock(card.x + 40, card.y + 46, 26);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ui.fitText(node.name, card.x + 76, card.y + 26, card.w - 140, 19, { weight: 'bold', color: ui.UI.text, outline: 'rgba(30,10,0,0.6)' });
    ui.drawTextBlock(node.desc, card.x + 76, card.y + 38, card.w - 92, 34, 13, { color: ui.UI.textDim, minPx: 11 });

    /* level pips */
    for (let l = 0; l < max; ++l) {
      const px = card.x + 76 + l * 22;
      const py = card.y + card.h - 22;
      ui.roundRectPath(px, py, 18, 10, 3);
      ctx.fillStyle = l < level ? branch.color : 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = l < level ? '#fff6d0' : 'rgba(255,220,160,0.3)';
      ctx.stroke();
    }
    ctx.textAlign = 'right';
    ui.fitText((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 16, card.y + 24, 60, 13, { weight: 'bold', color: ui.UI.textDim });

    if (maxed) {
      ui.drawChip('✓ MAX', card.x + card.w - 14, card.y + card.h - 32, 24, { align: 'right', px: 13, color: '#eaffea', bg: 'rgba(40,140,50,0.9)', border: '#9af07a' });
    } else if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(TREE_INDEX[node.req[i][0]].name + ' ' + romanNumeral(node.req[i][1]));
      }
      ctx.textAlign = 'right';
      ui.fitText('Needs ' + missing.join(', '), card.x + card.w - 14, card.y + card.h - 20, card.w - 150, 12, { weight: 'bold', color: ui.UI.warn });
    } else {
      const afford = card.state !== 'expensive';
      const bw = 92, bh = 27, bx = card.x + card.w - 14 - bw, by = card.y + card.h - 10 - bh;
      const pulse = afford && selected ? Math.sin(G.animT * 6) * 0.04 : 0;
      ctx.save();
      ctx.translate(bx + bw / 2, by + bh / 2);
      ctx.scale(1 + pulse, 1 + pulse);
      ctx.translate(-(bx + bw / 2), -(by + bh / 2));
      ui.drawButtonFace(bx, by, bw, bh, '$' + node.costs[level], { color: afford ? 'gold' : 'grey', hot: selected && afford, px: 15, radius: 9 });
      ctx.restore();
    }

    if (G.treeBuyFlash && G.treeBuyFlash.id === node.id) {
      const f = 1 - (G.animT - G.treeBuyFlash.at) / 0.4;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 10);
        ctx.fillStyle = 'rgba(255,250,220,' + (0.7 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  NS.treeScreen = { buildTreeLayout, celebrateBuy, treeCardById, selectFirstInBranch,
    moveTreeSelection, drawUpgradesScreen };

})();
