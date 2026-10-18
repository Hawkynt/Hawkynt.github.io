/*
 * The Tech Tree screen: branch tabs, the card layout, connectors, buying and keyboard navigation.
 * Owns G.treeBranch, G.treeSelected, G.treeFrom, G.treeFlash.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.config;
  const Prog = SZ.PlatformerProgress;
  const Spr = SZ.PlatformerSprites;
  const Fx = SZ.PlatformerFx;
  const Storage = NS.module('storage');
  const Session = NS.module('session');
  const World = NS.module('world');
  const Menu = NS.module('menu');
  const Controls = NS.module('controls');
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { drawSprite, drawGlow, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;
  const fxView = G.fxView;
  const hitAreas = G.hitAreas;

  function openTree(from) {
    G.treeFrom = from;
    if (!G.treeSelected)
      G.treeSelected = Prog.TREE[0].id;
    Session.setScreen('tree');
  }

  function closeTree() {
    Session.refreshStats();
    if (G.treeFrom === 'pause' && G.run) {
      G.screen = 'pause';
      Controls.syncTouch();
    } else if (G.treeFrom === 'results') {
      G.screen = 'results';
    } else {
      Session.setScreen(G.treeFrom === 'map' ? 'map' : 'title');
    }
  }

  function treeDepth(node) {
    let d = 0;
    for (const r of node.req)
      d = Math.max(d, 1 + treeDepth(Prog.TREE_BY_ID[r[0]]));
    return d;
  }

  function treeLayout() {
    const branch = Prog.BRANCH_ORDER[G.treeBranch];
    const nodes = Prog.TREE.filter(n => n.branch === branch);
    const cols = [];
    for (const n of nodes) {
      const d = treeDepth(n);
      (cols[d] = cols[d] || []).push(n);
    }
    const GX = cols.length >= 4 ? 46 : 70, GY = 22, CH = 118;
    const CW = Math.min(300, Math.floor((1200 - (cols.length - 1) * GX) / cols.length));
    const totalW = cols.length * CW + (cols.length - 1) * GX;
    const x0 = VIEW_W / 2 - totalW / 2;
    const cards = [];
    cols.forEach((list, ci) => {
      const totalH = list.length * CH + (list.length - 1) * GY;
      const y0 = 190 + (440 - totalH) / 2;
      list.forEach((n, ri) => cards.push({ node: n, x: x0 + ci * (CW + GX), y: y0 + ri * (CH + GY), w: CW, h: CH, col: ci, row: ri }));
    });
    return cards;
  }

  function buyTreeNode(id) {
    const st = Prog.nodeState(G.save, id);
    if (st !== 'available') {
      sfx('error', { volume: 0.5 });
      if (st === 'expensive')
        Session.showToast('Not enough coins or gems yet', '#ffb0a0');
      return;
    }
    Prog.buy(G.save, id);
    Storage.writeSave();
    Session.refreshStats();
    G.treeFlash = { id: id, at: G.time };
    sfx('levelup');
    const n = Prog.TREE_BY_ID[id];
    Session.showToast(n.name + ' ' + Prog.level(G.save, id) + ' unlocked!', Prog.BRANCHES[n.branch].color);
    const card = treeLayout().find(c => c.node.id === id);
    if (card) {
      Fx.starBurst(fxView, card.x + card.w / 2, card.y + card.h / 2);
      Fx.confetti(fxView, card.x + card.w / 2, card.y + 20, 20);
    }
    if (n.skin && G.save.skin === 'classic') {
      G.save.skin = n.skin;
      Storage.writeSave();
    }
    if (n.trail) {
      G.save.trail = n.trail;
      Storage.writeSave();
    }
  }

  function moveTree(dc, dr) {
    const cards = treeLayout();
    const cur = cards.find(c => c.node.id === G.treeSelected) || cards[0];
    let best = null, bd = Infinity;
    for (const c of cards) {
      if (c === cur)
        continue;
      const dx = c.col - cur.col, dy = (c.y - cur.y) / 140;
      if (dc && Math.sign(dx) !== dc) continue;
      if (dr && (dx !== 0 || Math.sign(dy) !== dr)) continue;
      const d = Math.abs(dx) * 3 + Math.abs(dy);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      G.treeSelected = best.node.id;
      sfx('click', { volume: 0.4 });
    } else if (dc) {
      G.treeBranch = (G.treeBranch + dc + 5) % 5;
      G.treeSelected = treeLayout()[0].node.id;
      sfx('click', { volume: 0.4 });
    }
  }

  function drawTree() {
    const branch = Prog.BRANCHES[Prog.BRANCH_ORDER[G.treeBranch]];
    if (G.treeFrom === 'pause' && G.run) {
      World.drawWorld(0);
      Menu.veil(0.78);
    } else {
      Menu.menuBackdrop(Math.floor(G.time / 14) % 5, 0.7);
    }
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: branch.color });
    ui.drawHeadline('Tech Tree', 190, 56, 300, 46, '#ffffff', branch.color);
    const tp = Prog.treeProgress(G.save);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(tp.have + ' / ' + tp.total + ' upgrades  -  effects apply at once', 380, 56, 380, 14, { weight: 'bold', color: ui.UI.textDim });
    Menu.currencyChips(1236, 35);
    /* branch tabs */
    for (let i = 0; i < 5; ++i) {
      const b = Prog.BRANCHES[Prog.BRANCH_ORDER[i]];
      const x = 90 + i * 224, y = 106, w = 204, h = 46;
      const active = i === G.treeBranch;
      const nodes = Prog.TREE.filter(n => n.branch === b.id);
      const have = nodes.reduce((a, n) => a + Prog.level(G.save, n.id), 0), total = nodes.reduce((a, n) => a + n.costs.length, 0);
      Menu.registerHit('tab' + i, x, y, w, h, ((k) => () => { G.treeBranch = k; G.treeSelected = treeLayout()[0].node.id; })(i));
      hitAreas[hitAreas.length - 1].tab = true;
      if (active)
        drawGlow(x + w / 2, y + h / 2, w * 1.5, b.color, 0.4);
      ui.drawPanel(x, y, w, h, { radius: 12, noStuds: true, glow: active, accent: b.color,
        top: ui.hexToRgba(ui.shade(b.color, -0.5), active ? 0.96 : 0.6), bottom: ui.hexToRgba(ui.shade(b.color, -0.85), active ? 0.96 : 0.6) });
      drawIcon(b.icon, b.color, x + 26, y + h / 2, 26);
      ctx.textAlign = 'left';
      ui.fitText(b.name, x + 46, y + h / 2 - 6, 110, 16, { weight: 'bold', color: active ? '#ffffff' : '#c8d2ea' });
      ui.fitText(have + ' / ' + total, x + 46, y + h / 2 + 12, 110, 11, { color: ui.UI.textDim });
    }
    const cards = treeLayout();
    if (!cards.some(c => c.node.id === G.treeSelected))
      G.treeSelected = cards[0].node.id;
    for (const card of cards)
      if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h && G.pointerMoved)
        G.treeSelected = card.node.id;
    /* connectors */
    const byId = {};
    for (const c of cards)
      byId[c.node.id] = c;
    for (const c of cards) {
      for (const [rid, rl] of c.node.req) {
        const from = byId[rid];
        if (!from)
          continue;
        const met = Prog.level(G.save, rid) >= rl;
        const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = c.x, y2 = c.y + c.h / 2, mx = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = met ? ui.hexToRgba(branch.color, 0.25) : 'rgba(0,0,0,0.4)';
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = met ? branch.color : '#3a4058';
        ctx.stroke();
        if (met) {
          const k = (G.time * 0.6) % 1;
          const bx = (1 - k) * (1 - k) * (1 - k) * x1 + 3 * (1 - k) * (1 - k) * k * mx + 3 * (1 - k) * k * k * mx + k * k * k * x2;
          const by = (1 - k) * (1 - k) * (1 - k) * y1 + 3 * (1 - k) * (1 - k) * k * y1 + 3 * (1 - k) * k * k * y2 + k * k * k * y2;
          drawGlow(bx, by, 26, branch.color, 0.9);
        }
      }
    }
    for (const card of cards)
      drawTreeCard(card, branch);
    /* the selected card's detail and buy button */
    const sel = byId[G.treeSelected];
    if (sel) {
      const n = sel.node, lv = Prog.level(G.save, n.id), st = Prog.nodeState(G.save, n.id);
      const y = Math.min(v.y1, VIEW_H) - 110;
      ui.drawPanel(90, y, 1100, 84, { accent: branch.color, radius: 14 });
      drawIcon(branch.icon, branch.color, 132, y + 42, 44);
      ctx.textAlign = 'left';
      ui.fitText(n.name + (n.costs.length > 1 ? '  ' + lv + ' / ' + n.costs.length : ''), 170, y + 26, 560, 20, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.fitText(n.desc[Math.min(lv, n.costs.length - 1)], 170, y + 56, 600, 15, { color: '#d0daf0' });
      const label = st === 'maxed' ? 'Owned' : 'Buy ' + costText(n.costs[lv]);
      Menu.drawButton('buy', label, 900, y + 14, 270, 56, { action: () => buyTreeNode(n.id), disabled: st !== 'available', accent: branch.color, key: 'Enter' });
    }
    ui.drawKeyHints([{ key: 'Arrows', label: 'Select' }, { key: 'Tab', label: 'Branch' }, { key: 'Enter', label: 'Buy' }, { key: 'Esc', label: 'Back' }], VIEW_W / 2, 172, 600, 0.95);
  }

  function costText(cost) {
    return cost.coins + ' coins' + (cost.gems ? ' + ' + cost.gems + (cost.gems === 1 ? ' gem' : ' gems') : '');
  }

  function drawTreeCard(card, branch) {
    const n = card.node, lv = Prog.level(G.save, n.id), st = Prog.nodeState(G.save, n.id);
    const sel = n.id === G.treeSelected;
    ctx.save();
    if (st === 'locked')
      ctx.globalAlpha = 0.5;
    if (sel)
      drawGlow(card.x + card.w / 2, card.y + card.h / 2, card.w * 1.4, branch.color, 0.45 + 0.1 * Math.sin(G.time * 3));
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: st === 'maxed' ? ui.UI.good : branch.color, glow: sel });
    if (st === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.45 + 0.35 * Math.sin(G.time * 4));
      ctx.stroke();
    }
    ui.drawPanel(card.x + 12, card.y + 14, 52, 52, { radius: 26, noStuds: true, accent: branch.color, top: ui.hexToRgba(ui.shade(branch.color, -0.4), 0.95), bottom: ui.hexToRgba(ui.shade(branch.color, -0.85), 0.95) });
    if (n.skin) {
      const skin = Prog.SKINS.find(s => s.id === n.skin);
      drawSprite(Spr.hero(skin, 'idle', Math.floor(G.time * 4) % 4), card.x + 38, card.y + 66, false, 0.7, 0.7);
    } else if (n.trail) {
      drawIcon('star', branch.color, card.x + 38, card.y + 40, 30);
    } else {
      drawIcon(nodeIcon(n), branch.color, card.x + 38, card.y + 40, 30);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(n.name, card.x + 76, card.y + 26, card.w - 140, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.drawChip(lv + ' / ' + n.costs.length, card.x + card.w - 12, card.y + 14, 22, { align: 'right', px: 12, color: st === 'maxed' ? ui.UI.good : ui.UI.textDim });
    ui.drawTextBlock(n.desc[Math.min(lv, n.costs.length - 1)], card.x + 76, card.y + 40, card.w - 90, 40, 13, { color: ui.UI.textDim });
    for (let l = 0; l < n.costs.length; ++l) {
      ui.roundRectPath(card.x + 76 + l * 22, card.y + card.h - 22, 18, 8, 3);
      ctx.fillStyle = l < lv ? branch.color : 'rgba(255,255,255,0.08)';
      ctx.fill();
    }
    ctx.textAlign = 'right';
    if (st === 'maxed') {
      ui.fitText('MAX', card.x + card.w - 14, card.y + card.h - 18, 80, 13, { weight: 'bold', color: ui.UI.good });
    } else if (st === 'locked') {
      const miss = n.req.filter(r => Prog.level(G.save, r[0]) < r[1]).map(r => Prog.TREE_BY_ID[r[0]].name);
      ui.fitText('needs ' + miss.join(', '), card.x + card.w - 14, card.y + card.h - 18, 190, 12, { color: ui.UI.warn });
    } else {
      const c = n.costs[lv];
      ui.fitText(costText(c), card.x + card.w - 14, card.y + card.h - 18, 190, 13, { weight: 'bold', color: st === 'expensive' ? ui.UI.bad : ui.UI.gold });
    }
    if (G.treeFlash && G.treeFlash.id === n.id && G.time - G.treeFlash.at < 0.35) {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - (G.time - G.treeFlash.at) / 0.35)).toFixed(3) + ')';
      ctx.fill();
    }
    ctx.restore();
    const idx = Menu.registerHit('card' + n.id, card.x, card.y, card.w, card.h, () => {
      if (G.treeSelected === n.id) buyTreeNode(n.id);
      else G.treeSelected = n.id;
    });
    hitAreas[idx].card = true;
  }

  function nodeIcon(n) {
    return {
      wallJump: 'boot', airControl: 'boot', dash: 'bolt', doubleJump: 'boot',
      hearts: 'heart', mercy: 'shield', mender: 'flag', shield: 'shield',
      magnet: 'magnet', coinBonus: 'coin', lucky: 'coin', radar: 'gem',
      fire: 'flame', shockwave: 'bolt', slayer: 'skull'
    }[n.id] || 'star';
  }

  Object.assign(NS.module('tree'), {
    openTree,
    closeTree,
    treeLayout,
    buyTreeNode,
    moveTree,
    drawTree
  });
})();
