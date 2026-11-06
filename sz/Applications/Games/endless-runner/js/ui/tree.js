/* The tech tree screen: five branch columns of levelled nodes joined by glowing links (lit once
   the node above has a level), each node showing its level pips and state - bought out, open,
   too expensive, locked - and the detail card of the selected node with its current and next
   effect, the price and the Buy button. Purchases apply at once, also from the pause menu.
   Arrow keys move, B or Enter buys. Draws and registers hit areas; owns the selection. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const K = NS.artKit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { BRANCHES, NODES, NODE_BY_ID } = NS.treeData;
  const { sfx } = NS.audio;
  const fx = NS.fx;
  const { ctx } = NS.view;

  const COL_W = 228, ROW_H = 84, X0 = 70, Y0 = 118, NW = 196, NH = 62;

  function nodePos(n) {
    return { x: X0 + n.branch * COL_W, y: Y0 + n.row * ROW_H };
  }

  function buy(id) {
    const res = rules.canBuy(G.save, id);
    if (res !== 'ok') {
      sfx('error');
      G.ui.treeMsg = res === 'coins' ? 'Not enough coins' : res === 'locked' ? 'Buy the node above first' : 'Fully upgraded';
      G.ui.treeMsgT = 1.6;
      return false;
    }
    rules.buy(G.save, id);
    NS.save.refreshStats();
    NS.save.writeSave();
    NS.progress.checkAchievements();
    sfx('levelup');
    G.ui.treePulse = 1;
    return true;
  }

  function node(n) {
    const p = nodePos(n);
    const lvl = G.save.tree[n.id] || 0;
    const state = rules.canBuy(G.save, n.id);
    const br = BRANCHES[n.branch];
    const sel = G.ui.treeSel === n.id;
    const hot = W.area('node:' + n.id, p.x, p.y, NW, NH, () => { if (G.ui.treeSel === n.id) buy(n.id); else { G.ui.treeSel = n.id; sfx('click'); } });
    if (hot && !sel && G.input.mouseMoved) G.ui.treeSel = n.id;
    const locked = state === 'locked';
    kit.panel(p.x, p.y, NW, NH, {
      radius: 10, accent: lvl >= n.max ? UI.gold : br.color, glow: sel || hot, alpha: locked ? 0.55 : 0.95, brackets: false,
      top: sel ? 'rgba(52,40,100,0.97)' : undefined,
    });
    kit.icon(br.icon, p.x + 26, p.y + NH / 2, 26, locked ? UI.textMute : br.color);
    kit.fitText(n.name, p.x + 48, p.y + 20, NW - 56, 15, { weight: 'bold', color: locked ? UI.textMute : '#ffffff' });
    for (let i = 0; i < n.max; ++i) {
      ctx.fillStyle = i < lvl ? br.color : 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x + 48 + i * 18, p.y + 36, 14, 6);
    }
    const label = lvl >= n.max ? 'MAX' : locked ? 'locked' : rules.nodeCost(G.save, n.id) + '';
    kit.text(label, p.x + NW - 10, p.y + 50, 12, lvl >= n.max ? UI.gold : state === 'coins' ? UI.bad : UI.textDim, { align: 'right', weight: 'bold' });
  }

  function links() {
    for (let i = 0; i < NODES.length; ++i) {
      const n = NODES[i];
      if (!n.req) continue;
      for (let k = 0; k < n.req.length; ++k) {
        const a = nodePos(NODE_BY_ID[n.req[k]]), b = nodePos(n);
        const lit = (G.save.tree[n.req[k]] || 0) > 0;
        ctx.strokeStyle = lit ? K.rgba(BRANCHES[n.branch].color, 0.8) : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = lit ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(a.x + NW / 2, a.y + NH);
        ctx.lineTo(b.x + NW / 2, b.y);
        ctx.stroke();
      }
    }
  }

  function detail(v) {
    const n = NODE_BY_ID[G.ui.treeSel] || NODES[0];
    const lvl = G.save.tree[n.id] || 0;
    const br = BRANCHES[n.branch];
    const y = Y0 + 5 * ROW_H + 10;
    kit.panel(X0, y, 5 * COL_W - 32, 104, { radius: 12, accent: br.color });
    kit.text(n.name, X0 + 20, y + 24, 22, br.color, { weight: 'bold' });
    kit.text(br.name + ' - level ' + lvl + ' / ' + n.max, X0 + 20, y + 50, 14, UI.textDim);
    kit.text('Now: ' + (lvl ? n.desc(lvl) : 'not bought'), X0 + 20, y + 74, 15, '#ffffff');
    if (lvl < n.max) kit.text('Next: ' + n.desc(lvl + 1), X0 + 20, y + 94, 15, UI.good);
    const state = rules.canBuy(G.save, n.id);
    if (lvl < n.max)
      W.button('buy', 'Buy  ' + rules.nodeCost(G.save, n.id), X0 + 5 * COL_W - 280, y + 28, 230, 52,
        { action: () => buy(n.id), disabled: state !== 'ok', accent: UI.gold, icon: 'coin', px: 18 });
    if (G.ui.treeMsgT > 0) kit.text(G.ui.treeMsg, X0 + 5 * COL_W - 165, y + 94, 14, UI.bad, { align: 'center' });
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(8,6,22,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Tech Tree', X0, 44, 32, '#ffffff', { weight: 'bold' });
    kit.amount('coins', G.save.coins, X0 + 220, 46, 24);
    kit.text('Spent ' + rules.treeSpent(G.save), X0 + 400, 46, 14, UI.textDim);
    for (let b = 0; b < BRANCHES.length; ++b) {
      kit.icon(BRANCHES[b].icon, X0 + b * COL_W + 18, 92, 20, BRANCHES[b].color);
      kit.text(BRANCHES[b].name, X0 + b * COL_W + 34, 92, 16, BRANCHES[b].color, { weight: 'bold' });
    }
    links();
    for (let i = 0; i < NODES.length; ++i) node(NODES[i]);
    detail(v);
    W.button('back', 'Back', v.x1 - 190, 22, 160, 46, { action: () => scr.back('tree'), icon: 'back' });
    if (G.ui.treeMsgT > 0) G.ui.treeMsgT -= 1 / 60;
    if (G.ui.treePulse > 0) {
      const n = NODE_BY_ID[G.ui.treeSel];
      const p = nodePos(n);
      ctx.strokeStyle = K.rgba(UI.gold, G.ui.treePulse);
      ctx.lineWidth = 4;
      kit.roundRect(p.x - 10 * (1 - G.ui.treePulse), p.y - 10 * (1 - G.ui.treePulse), NW + 20 * (1 - G.ui.treePulse), NH + 20 * (1 - G.ui.treePulse), 12);
      ctx.stroke();
      G.ui.treePulse = Math.max(0, G.ui.treePulse - 1 / 30);
    }
  }

  function onKey(e) {
    const n = NODE_BY_ID[G.ui.treeSel] || NODES[0];
    let b = n.branch, r = n.row;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': b = (b + 4) % 5; break;
      case 'ArrowRight': case 'KeyD': b = (b + 1) % 5; break;
      case 'ArrowUp': case 'KeyW': r = Math.max(0, r - 1); break;
      case 'ArrowDown': case 'KeyS': r = Math.min(4, r + 1); break;
      case 'KeyB': case 'Enter': case 'NumpadEnter': case 'Space':
        if (!e.repeat) buy(n.id);
        return true;
      default: return false;
    }
    const next = NODES.find(q => q.branch === b && q.row === r);
    if (next) { G.ui.treeSel = next.id; sfx('click', { volume: 0.4 }); }
    return true;
  }

  Object.assign(NS.tree, {
    draw, onKey, buy
  });
})();
