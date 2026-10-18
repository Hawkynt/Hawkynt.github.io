/* The tech tree screen: five branch columns of nodes with prerequisite links, level pips,
   state colours (maxed, available, too expensive, locked) and costs; a detail panel with the
   current and next level, buying and equipping styles. Purchases take effect at once - also
   mid-mission when opened from the pause menu. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { BRANCHES, TREE, TREE_BY_ID } = NS.treeData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const COL_W = 236, X0 = 50, Y0 = 168, ROW_H = 96, R = 27;

  function nodePos(n) {
    const bi = BRANCHES.findIndex(b => b.id === n.branch);
    const cx = X0 + bi * COL_W;
    const x = n.branch === 'style' ? cx + 36 + n.lane * 82 : cx + 58 + n.lane * 120;
    return { x: x, y: Y0 + n.row * ROW_H };
  }

  function branchColor(id) {
    for (let i = 0; i < BRANCHES.length; ++i)
      if (BRANCHES[i].id === id) return BRANCHES[i].color;
    return UI.accent;
  }

  function buy(id) {
    const save = G.save;
    const n = TREE_BY_ID[id];
    if (!rules.buyNode(save, id)) {
      sfx('error');
      return false;
    }
    NS.save.refreshStats();
    if (G.player && G.treeReturn === 'paused') NS.player.applyStats();
    NS.save.writeSave();
    NS.statusBar.update();
    G.ui.treeFlash = 0.6;
    G.ui.treeFlashId = id;
    const p = nodePos(n);
    NS.fx.ring(p.x, p.y, R, R * 3, 0.5, branchColor(n.branch), 5);
    NS.fx.sparks(p.x, p.y, 0, TAU, 24, branchColor(n.branch), 300, 0.5);
    sfx('levelup');
    return true;
  }

  function equip(n) {
    if (rules.equipStyle(G.save, n.style, n.value)) {
      if (G.player) NS.player.applyLooks(G.player);
      NS.save.writeSave();
      sfx('select');
    }
  }

  function draw() {
    const save = G.save;
    const sel = TREE_BY_ID[G.ui.treeSel] || TREE[0];
    const v = NS.view.visible();
    ctx.fillStyle = G.treeReturn === 'paused' ? 'rgba(2,4,12,0.8)' : 'rgba(2,4,12,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('TECH TREE', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.text(G.treeReturn === 'paused' ? 'Mission paused - upgrades apply the moment you buy them' : 'Permanent upgrades, bought with scrap', 60, 74, 14, UI.textDim);
    kit.credits(save.credits, 1220, 46, 24, 'right');

    /* branch columns */
    for (let b = 0; b < BRANCHES.length; ++b) {
      const br = BRANCHES[b];
      const x = X0 + b * COL_W;
      ctx.fillStyle = K.rgba(br.color, 0.06);
      kit.roundRect(x, 96, COL_W - 14, 404, 12);
      ctx.fill();
      ctx.strokeStyle = K.rgba(br.color, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      kit.icon(br.icon, x + 24, 118, 18, br.color);
      kit.text(br.name.toUpperCase(), x + 42, 118, 15, br.color, { weight: 'bold' });
      let have = 0, all = 0;
      for (let i = 0; i < TREE.length; ++i)
        if (TREE[i].branch === br.id) { have += rules.nodeLevel(save, TREE[i].id); all += TREE[i].costs.length; }
      kit.text(have + '/' + all, x + COL_W - 28, 118, 12, UI.textDim, { align: 'right' });
    }

    /* prerequisite links */
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      const p = nodePos(n);
      for (let k = 0; k < n.req.length; ++k) {
        const q = nodePos(TREE_BY_ID[n.req[k][0]]);
        const met = rules.nodeLevel(save, n.req[k][0]) >= n.req[k][1];
        ctx.strokeStyle = met ? K.rgba(branchColor(n.branch), 0.8) : 'rgba(120,130,160,0.25)';
        ctx.lineWidth = met ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y + R);
        ctx.bezierCurveTo(q.x, q.y + R + 20, p.x, p.y - R - 20, p.x, p.y - R);
        ctx.stroke();
      }
    }

    /* nodes */
    for (let i = 0; i < TREE.length; ++i) drawNode(TREE[i], sel, save);

    drawDetail(sel, save);
    NS.fxRender.draw({ x0: -200, y0: -200, x1: 1500, y1: 900 });
    const back = G.treeReturn;
    W.button('back', back === 'paused' ? 'Resume Mission' : 'Back', 60, 650, 240, 46, {
      action: () => scr.setScreen(back), accent: back === 'paused' ? UI.good : UI.accent,
    });
  }

  function drawNode(n, sel, save) {
    const p = nodePos(n);
    const state = rules.nodeState(save, n.id);
    const lvl = rules.nodeLevel(save, n.id);
    const col = branchColor(n.branch);
    const isSel = sel.id === n.id;
    const hot = W.area(n.id, p.x - R - 6, p.y - R - 6, R * 2 + 12, R * 2 + 28, () => {
      if (G.ui.treeSel === n.id) {
        if (n.style && lvl > 0) equip(n);
        else buy(n.id);
      } else
        G.ui.treeSel = n.id;
    });
    if (hot) G.ui.treeSel = n.id;
    const owned = lvl > 0;
    const equipped = n.style && save.style[n.style] === n.value;
    if (state === 'available') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4 + i(n)) * 0.15;
      K.blit(ctx, K.glow(col), p.x, p.y, 1.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const gr = ctx.createRadialGradient(p.x - 8, p.y - 10, 2, p.x, p.y, R);
    gr.addColorStop(0, state === 'locked' ? '#1a1e2a' : owned ? K.shade(col, -0.35) : '#2a3450');
    gr.addColorStop(1, state === 'locked' ? '#06080e' : '#080c18');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * (hot ? 1.08 : 1), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = state === 'maxed' ? UI.gold : state === 'locked' ? 'rgba(120,130,160,0.4)' : isSel ? '#ffffff' : col;
    ctx.lineWidth = isSel ? 3.5 : 2.5;
    ctx.stroke();
    if (isSel) {
      ctx.strokeStyle = K.rgba('#ffffff', 0.5);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -G.time * 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    kit.icon(n.icon, p.x, p.y, 24, state === 'locked' ? '#4a5470' : owned ? '#ffffff' : col);
    /* level pips around the rim */
    const max = n.costs.length;
    if (max > 1) {
      for (let k = 0; k < max; ++k) {
        const a = -Math.PI * (0.22 + 0.56 * (k + 0.5) / max);
        ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * (R + 1), p.y + Math.sin(a) * (R + 1), 3.2, 0, TAU);
        ctx.fill();
      }
    }
    if (state === 'locked') kit.lock(p.x + R * 0.7, p.y - R * 0.7, 14);
    if (equipped) kit.text('ON', p.x + R * 0.8, p.y - R * 0.8, 10, UI.good, { weight: 'bold', align: 'center' });
    if (G.ui.treeFlash > 0 && G.ui.treeFlashId === n.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.ui.treeFlash;
      K.blit(ctx, K.glow('#ffffff'), p.x, p.y, 1.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const label = state === 'maxed' ? 'MAX' : String(rules.nodeCost(save, n.id));
    kit.text(label, p.x, p.y + R + 12, 12, state === 'maxed' ? UI.gold : state === 'expensive' ? UI.bad : state === 'locked' ? UI.textMute : UI.text, { align: 'center', weight: 'bold' });
  }

  function i(n) {
    return n.row * 1.3 + n.lane;
  }

  function drawDetail(n, save) {
    const x = 330, y = 512, w = 890, h = 128;
    const col = branchColor(n.branch);
    const lvl = rules.nodeLevel(save, n.id);
    const max = n.costs.length;
    const state = rules.nodeState(save, n.id);
    kit.panel(x, y, w, h, { accent: col, glow: true });
    kit.icon(n.icon, x + 44, y + 44, 36, col);
    kit.text(n.name, x + 84, y + 30, 22, '#ffffff', { weight: 'bold' });
    kit.text(max > 1 ? 'Level ' + lvl + ' / ' + max : (lvl ? 'Owned' : 'Not owned'), x + 84, y + 56, 13, UI.textDim);
    kit.text('Now:  ' + (lvl ? rules.nodeText(n, lvl) : 'nothing yet'), x + 300, y + 30, 14, lvl ? UI.text : UI.textMute);
    if (lvl < max) kit.text('Next: ' + rules.nodeText(n, lvl + 1), x + 300, y + 56, 14, UI.good);
    if (state === 'locked') {
      const parts = n.req.map(r => TREE_BY_ID[r[0]].name + (TREE_BY_ID[r[0]].costs.length > 1 ? ' ' + r[1] : ''));
      kit.text('Requires ' + parts.join(' and '), x + 300, y + 86, 13, UI.bad);
    }
    const bx = x + w - 260, by = y + 70;
    if (state !== 'maxed') {
      W.button('buy', state === 'locked' ? 'Locked' : 'Buy  -  ' + rules.nodeCost(save, n.id), bx, by, 240, 44, {
        disabled: state !== 'available', accent: UI.gold, action: () => buy(n.id),
      });
    } else if (n.style) {
      const on = save.style[n.style] === n.value;
      W.button('equip', on ? 'Unequip' : 'Equip', bx, by, 240, 44, { accent: UI.good, action: () => equip(n) });
    } else
      kit.text('Fully upgraded', bx + 120, by + 22, 16, UI.gold, { align: 'center', weight: 'bold' });
    if (n.style && state !== 'maxed') kit.text('Style: buy once, then equip or unequip any time', x + 84, y + 100, 12, UI.textMute);
  }

  /* B buys the selected node from the keyboard */
  function onKey(e) {
    if (e.code === 'KeyB') {
      buy(G.ui.treeSel);
      return true;
    }
    return false;
  }

  Object.assign(NS.tree, {
    draw, buy, onKey, nodePos
  });
})();
